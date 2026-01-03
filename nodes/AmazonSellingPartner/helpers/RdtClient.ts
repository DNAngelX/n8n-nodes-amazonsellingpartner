import axios, { AxiosResponse } from 'axios';
import { ICredentialDataDecryptedObject, NodeOperationError } from 'n8n-workflow';
import { LwaClient } from './LwaClient';

export interface RestrictedResource {
	method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	path: string;
	dataElements?: string[];
}

interface RdtTokenResponse {
	restrictedDataToken: string;
	expiresIn: number;
}

export class RdtClient {
	private static readonly RDT_ENDPOINT = '/tokens/2021-03-01/restrictedDataToken';

	static async getRestrictedAccessToken(
		credentials: ICredentialDataDecryptedObject,
		restrictedResources: RestrictedResource[]
	): Promise<string> {
		try {
			// Get LWA access token first
			const lwaToken = await LwaClient.getAccessToken(credentials);

			// Build the base URL for the RDT request
			const baseUrl = this.getBaseUrl(credentials);
			const rdtUrl = new URL(this.RDT_ENDPOINT, baseUrl);

			// Prepare the request body
			const requestBody = {
				restrictedResources,
			};

			// Make the RDT request
			const response: AxiosResponse<RdtTokenResponse> = await axios.post(
				rdtUrl.toString(),
				requestBody,
				{
					headers: {
						'Content-Type': 'application/json',
						'User-Agent': 'n8n-amazon-sp-api/1.0.0',
						'x-amz-access-token': lwaToken,
					},
					timeout: 30000,
				}
			);

			return response.data.restrictedDataToken;
		} catch (error) {
			const isAxiosErr = (axios as any).isAxiosError?.(error) || (error as any)?.isAxiosError;
			if (isAxiosErr && (error as any).response) {
				const { status, data } = (error as any).response;
				throw new NodeOperationError(
					{} as any,
					`RDT authentication failed (${status}): ${data.error_description || data.error || 'Unknown error'}`,
					{
						description: 'Check your LWA credentials and restricted resource configuration',
					}
				);
			}
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			throw new NodeOperationError({} as any, `RDT request failed: ${errorMessage}`);
		}
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
