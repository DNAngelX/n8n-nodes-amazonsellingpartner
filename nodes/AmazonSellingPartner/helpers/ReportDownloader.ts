import axios from 'axios';
import { createDecipheriv } from 'crypto';
import { gunzipSync } from 'zlib';
import { NodeOperationError } from 'n8n-workflow';

interface EncryptionDetails {
	standard: string;
	initializationVector: string;
	key: string;
}

interface ReportDocument {
	reportDocumentId: string;
	url: string;
	encryptionDetails?: EncryptionDetails;
	compressionAlgorithm?: string;
}

export class ReportDownloader {
	/**
	 * Download and optionally decrypt a report document
	 */
	static async downloadReportDocument(
		document: ReportDocument,
		nodeId?: string
	): Promise<Buffer> {
		try {
			// Download the document
			const response = await axios({
				method: 'GET',
				url: document.url,
				responseType: 'arraybuffer',
				timeout: 300000, // 5 minutes for large files
			});

			let data = Buffer.from(response.data);

			// Decrypt if encryption details are provided
			if (document.encryptionDetails) {
				data = this.decryptDocument(data, document.encryptionDetails);
			}

			// Decompress if needed
			if (document.compressionAlgorithm === 'GZIP') {
				try {
					data = gunzipSync(data);
				} catch (err: any) {
					throw new NodeOperationError(
						{ id: nodeId || 'unknown', name: 'ReportDownloader', type: 'helper' } as any,
						`Failed to decompress GZIP report: ${err?.message || 'Unknown error'}`
					);
				}
			}

			return data;
		} catch (error) {
			if (axios.isAxiosError(error)) {
				throw new NodeOperationError(
					{ id: nodeId || 'unknown', name: 'ReportDownloader', type: 'helper' } as any,
					`Failed to download report document: ${error.message}`,
					{
						description: 'Check if the document URL is still valid and accessible'
					}
				);
			}
			
			throw new NodeOperationError(
				{ id: nodeId || 'unknown', name: 'ReportDownloader', type: 'helper' } as any,
				`Unexpected error downloading report: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Decrypt document using AES-256-CBC
	 */
	private static decryptDocument(
		encryptedData: Buffer,
		encryptionDetails: EncryptionDetails
	): Buffer {
		try {
			if (encryptionDetails.standard !== 'AES') {
				throw new Error(`Unsupported encryption standard: ${encryptionDetails.standard}`);
			}

			const key = Buffer.from(encryptionDetails.key, 'base64');
			const iv = Buffer.from(encryptionDetails.initializationVector, 'base64');
			
			const decipher = createDecipheriv('aes-256-cbc', key, iv);
			
			const decrypted = Buffer.concat([
				decipher.update(encryptedData),
				decipher.final()
			]);

			return decrypted;
		} catch (error) {
			throw new NodeOperationError(
				{ id: 'unknown', name: 'ReportDownloader', type: 'helper' } as any,
				`Failed to decrypt report document: ${error instanceof Error ? error.message : 'Unknown error'}`,
				{
					description: 'The encryption key or initialization vector may be invalid'
				}
			);
		}
	}
} 