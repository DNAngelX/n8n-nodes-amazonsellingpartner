import * as aws4 from 'aws4';
import { URL } from 'url';
import { ICredentialDataDecryptedObject, NodeOperationError } from 'n8n-workflow';

export class SigV4Signer {
	static async signRequest(
		method: string,
		url: string,
		headers: Record<string, string>,
		body: string | undefined,
		credentials: ICredentialDataDecryptedObject
	): Promise<Record<string, string>> {
		try {
			const urlParts = new URL(url);
			
			// Get AWS credentials from either old location or advanced options
			const advancedOptions = credentials.advancedOptions as any;
			const awsAccessKeyId = credentials.awsAccessKeyId || advancedOptions?.awsAccessKeyId;
			const awsSecretAccessKey = credentials.awsSecretAccessKey || advancedOptions?.awsSecretAccessKey;
			const awsRegion = credentials.awsRegion;

			if (!awsAccessKeyId || !awsSecretAccessKey) {
				throw new Error('AWS credentials are required for SigV4 signing');
			}
			
			const requestOptions = {
				method,
				host: urlParts.hostname,
				path: urlParts.pathname + urlParts.search,
				headers: { ...headers },
				body,
				service: 'execute-api',
				region: awsRegion as string,
			};

			const awsCredentials = {
				accessKeyId: awsAccessKeyId as string,
				secretAccessKey: awsSecretAccessKey as string,
			};

			// Sign the request using aws4
			const signedRequest = aws4.sign(requestOptions, awsCredentials);
			
			return signedRequest.headers as Record<string, string>;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			throw new NodeOperationError(
				{} as any,
				`Failed to sign request: ${errorMessage}`,
				{
					description: 'Check your AWS credentials and region configuration',
				}
			);
		}
	}
} 