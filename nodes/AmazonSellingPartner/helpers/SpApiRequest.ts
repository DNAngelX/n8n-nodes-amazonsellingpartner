import axios, { AxiosResponse } from 'axios';
import { URL } from 'url';
import {
	IExecuteFunctions,
	ICredentialDataDecryptedObject,
	NodeOperationError,
} from 'n8n-workflow';
import { LwaClient } from './LwaClient';
import { RdtClient, RestrictedResource } from './RdtClient';
import { RateLimiter } from '../core/RateLimiter';
import { ErrorHandler } from '../core/ErrorHandler';
import { metricsCollector } from '../core/MetricsCollector';
import { auditLogger } from '../core/AuditLogger';
import { securityValidator } from '../core/SecurityValidator';
import { getEndpointGroup } from '../core/rateLimitConfig';

interface SpApiRequestOptions {
	method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	endpoint: string;
	query?: Record<string, any>;
	body?: any;
	headers?: Record<string, string>;
	responseType?: 'json' | 'stream' | 'text';
	restrictedResources?: RestrictedResource[];
}

interface SpApiResponse<T = any> {
	data: T;
	headers: Record<string, string>;
	status: number;
}

export class SpApiRequest {
	private static rateLimiter = new RateLimiter();

	static async makeRequest<T = any>(
		executeFunctions: IExecuteFunctions,
		options: SpApiRequestOptions
	): Promise<SpApiResponse<T>> {
		const startTime = Date.now();
		const nodeId = executeFunctions.getNode().id;
		
		try {
			const credentials = await executeFunctions.getCredentials('amazonSpApi');
			
			// Security validation (LWA-only)
			const credentialValidation = this.validateCredentials(credentials);
			if (!credentialValidation.isValid) {
				auditLogger.logCredentialUsage(nodeId, 'amazonSpApi', false, {
					errors: credentialValidation.errors,
				});
				throw new NodeOperationError(
					executeFunctions.getNode(),
					`Invalid credentials: ${credentialValidation.errors.join(', ')}`
				);
			}

			// Validate environment isolation
			try {
				const environmentValidation = securityValidator.validateEnvironmentIsolation(credentials, nodeId);
				if (!environmentValidation.isValid) {
					throw new NodeOperationError(
						executeFunctions.getNode(),
						`Environment isolation violation: ${environmentValidation.errors.join(', ')}`
					);
				}
			} catch (error) {
				// If security validator is not available, continue with basic validation
				console.warn('Security validator not available, skipping environment validation');
			}

			// Validate API parameters
			if (options.query) {
				try {
					const paramValidation = securityValidator.validateApiParameters(options.query, nodeId);
					if (!paramValidation.isValid) {
						throw new NodeOperationError(
							executeFunctions.getNode(),
							`Invalid parameters: ${paramValidation.errors.join(', ')}`
						);
					}
					options.query = paramValidation.sanitizedData;
				} catch (error) {
					// If security validator is not available, continue without parameter validation
					console.warn('Security validator not available, skipping parameter validation');
				}
			}

			const baseUrl = this.getBaseUrl(credentials);
			
			// Build full URL
			const url = new URL(options.endpoint, baseUrl);
			if (options.query) {
				Object.entries(options.query).forEach(([key, value]) => {
					if (value !== undefined && value !== null && value !== '') {
						if (Array.isArray(value)) {
							value.forEach(v => url.searchParams.append(key, v));
						} else {
							url.searchParams.set(key, String(value));
						}
					}
				});
			}

			// Apply rate limiting using group-based rate limits (method-aware)
			const rateLimitGroup = getEndpointGroup(options.method, options.endpoint);
			await this.rateLimiter.waitForToken(rateLimitGroup);

			// Get access token (LWA or RDT based on restricted resources)
			let accessToken: string;
			let authType: string;
			
			if (options.restrictedResources && options.restrictedResources.length > 0) {
				accessToken = await RdtClient.getRestrictedAccessToken(credentials, options.restrictedResources);
				authType = 'RDT';
			} else {
				accessToken = await LwaClient.getAccessToken(credentials);
				authType = 'LWA';
			}
			
			auditLogger.logAuthentication(nodeId, authType, true, { endpoint: options.endpoint });

			// Prepare headers
			const acceptHeader = (options.responseType === 'stream' || options.responseType === 'text')
				? '*/*'
				: 'application/json';
			const headers = {
				'Accept': acceptHeader,
				'Content-Type': 'application/json',
				'User-Agent': 'n8n-amazon-sp-api/1.0.0',
				'x-amz-access-token': accessToken,
				...options.headers,
			};

			// AWS SigV4 signing disabled: enforce LWA-only authentication
			const finalHeaders = headers;

			// Log request details for debugging
			console.log('SP-API Request:', {
				method: options.method,
				url: url.toString(),
				endpoint: options.endpoint,
				baseUrl,
				hasAccessToken: !!accessToken,
				region: credentials.awsRegion,
				marketplace: credentials.primaryMarketplace,
			});

			// Configure axios request based on response type
			const axiosConfig: any = {
				method: options.method,
				url: url.toString(),
				headers: finalHeaders,
				data: options.body,
				timeout: 60000, // 60 seconds
				validateStatus: (status: number) => status < 500, // Don't throw on 4xx errors
			};

			// Set response type for non-JSON responses
			if (options.responseType === 'stream') {
				axiosConfig.responseType = 'stream';
			} else if (options.responseType === 'text') {
				axiosConfig.responseType = 'text';
			}

			// Make the request
			const response: AxiosResponse<T> = await axios(axiosConfig);

			const duration = Date.now() - startTime;

			// Update rate limiter with response headers
			this.rateLimiter.updateFromHeaders(rateLimitGroup, response.headers as Record<string, string>);

		// Handle non-success responses
		if (response.status >= 400) {
			// Log detailed error response for debugging
			console.error('SP-API Request Failed:', {
				status: response.status,
				statusText: response.statusText,
				url: url.toString(),
				endpoint: options.endpoint,
				method: options.method,
				baseUrl,
				responseData: response.data,
				requestHeaders: headers,
				responseHeaders: response.headers,
			});
			
			// Log failed API access
			auditLogger.logApiAccess(nodeId, options.endpoint, false, {
				status: response.status,
				duration,
				method: options.method,
			});
			metricsCollector.recordApiRequest(options.endpoint, duration, false, `HTTP_${response.status}`);
			
			throw await ErrorHandler.handleApiError(response);
		}

			// Log successful API access
			auditLogger.logApiAccess(nodeId, options.endpoint, true, {
				status: response.status,
				duration,
				method: options.method,
			});
			metricsCollector.recordApiRequest(options.endpoint, duration, true);

			return {
				data: response.data,
				headers: response.headers as Record<string, string>,
				status: response.status,
			};
		} catch (error) {
			const duration = Date.now() - startTime;
			
			// Log error
			auditLogger.logError(nodeId, error instanceof Error ? error : new Error('Unknown error'), {
				endpoint: options.endpoint,
				method: options.method,
				duration,
			});

			if (error instanceof NodeOperationError) {
				metricsCollector.recordApiRequest(options.endpoint, duration, false, 'NODE_OPERATION_ERROR');
				throw error;
			}

			if (axios.isAxiosError(error)) {
				metricsCollector.recordApiRequest(options.endpoint, duration, false, 'NETWORK_ERROR');
				throw await ErrorHandler.handleNetworkError(error);
			}

			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			metricsCollector.recordApiRequest(options.endpoint, duration, false, 'UNEXPECTED_ERROR');
			throw new NodeOperationError(
				executeFunctions.getNode(),
				`Unexpected error: ${errorMessage}`
			);
		}
	}

	private static validateCredentials(
		credentials: ICredentialDataDecryptedObject
	): { isValid: boolean; errors: string[] } {
		const errors: string[] = [];

		// Always validate LWA credentials
		if (!credentials.lwaClientId) {
			errors.push('LWA Client ID is required');
		}
		if (!credentials.lwaClientSecret) {
			errors.push('LWA Client Secret is required');
		}
		if (!credentials.lwaRefreshToken) {
			errors.push('LWA Refresh Token is required');
		}

		return {
			isValid: errors.length === 0,
			errors,
		};
	}

	private static getBaseUrl(credentials: ICredentialDataDecryptedObject): string {
		const advancedOptions = credentials.advancedOptions as any;
		const customEndpoint = credentials.spApiEndpoint || advancedOptions?.spApiEndpoint;
		
		if (customEndpoint) {
			return customEndpoint as string;
		}

		const region = credentials.awsRegion as string;
		const environment = credentials.environment as string;

		const endpoints: Record<string, string> = {
			'us-east-1': environment === 'sandbox' 
				? 'https://sandbox.sellingpartnerapi-na.amazon.com'
				: 'https://sellingpartnerapi-na.amazon.com',
			'eu-west-1': environment === 'sandbox'
				? 'https://sandbox.sellingpartnerapi-eu.amazon.com'
				: 'https://sellingpartnerapi-eu.amazon.com',
			'us-west-2': environment === 'sandbox'
				? 'https://sandbox.sellingpartnerapi-fe.amazon.com'
				: 'https://sellingpartnerapi-fe.amazon.com',
		};
		
		return endpoints[region] || endpoints['us-east-1'];
	}
} 