import { IExecuteFunctions, INodeExecutionData, NodeOperationError } from 'n8n-workflow';
import { SpApiRequest } from '../helpers/SpApiRequest';
import { ReportDownloader } from '../helpers/ReportDownloader';

interface ReportRequest {
	reportType: string;
	marketplaceIds: string[];
	dataStartTime?: string;
	dataEndTime?: string;
	reportOptions?: Record<string, any>;
}

interface ReportResponse {
	reportId: string;
}

interface ReportStatus {
	reportId: string;
	reportType: string;
	processingStatus: 'IN_QUEUE' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED' | 'FATAL';
	reportDocumentId?: string;
	createdTime: string;
	processingStartTime?: string;
	processingEndTime?: string;
}

interface ReportDocument {
	reportDocumentId: string;
	url: string;
	encryptionDetails?: {
		standard: string;
		initializationVector: string;
		key: string;
	};
	compressionAlgorithm?: string;
}

export async function getGstReport(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const reportType = this.getNodeParameter('reportType', index) as string;
	const marketplaceId = this.getNodeParameter('marketplaceId', index) as string;
	const outputOptions = this.getNodeParameter('outputOptions', index, {}) as any;
	const advancedOptions = this.getNodeParameter('advancedOptions', index, {}) as any;

	// Validate marketplace for GST reports
	if (marketplaceId !== 'A21TJRUUN4KGV') {
		throw new NodeOperationError(
			this.getNode(),
			'GST reports are only available for Amazon.in marketplace (A21TJRUUN4KGV)'
		);
	}

	// Build report request
	const reportRequest: ReportRequest = {
		reportType,
		marketplaceIds: [marketplaceId],
	};

	// Add date range for custom reports
	const customReportTypes = ['GET_GST_MTR_B2B_CUSTOM', 'GET_GST_MTR_B2C_CUSTOM', 'GET_GST_STR_ADHOC'];
	if (customReportTypes.includes(reportType)) {
		const startDate = this.getNodeParameter('startDate', index) as string;
		const endDate = this.getNodeParameter('endDate', index) as string;

		if (!startDate || !endDate) {
			throw new NodeOperationError(
				this.getNode(),
				'Start date and end date are required for custom GST reports'
			);
		}

		reportRequest.dataStartTime = new Date(startDate).toISOString();
		reportRequest.dataEndTime = new Date(endDate).toISOString();

		// Validate date range (max 31 days for GST reports)
		const daysDiff = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24);
		if (daysDiff > 31) {
			throw new NodeOperationError(
				this.getNode(),
				'Date range for GST reports cannot exceed 31 days'
			);
		}
	}

	return await processReportRequest.call(this, reportRequest, outputOptions, advancedOptions);
}

export async function getVatInvoiceReport(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const reportType = this.getNodeParameter('reportType', index) as string;
	const marketplaceId = this.getNodeParameter('marketplaceId', index) as string;
	const reportOptions = this.getNodeParameter('reportOptions', index, {}) as any;
	const outputOptions = this.getNodeParameter('outputOptions', index, {}) as any;
	const advancedOptions = this.getNodeParameter('advancedOptions', index, {}) as any;

	// Validate marketplace for VAT reports
	const euUkMarketplaces = ['A1F83G8C2ARO7P', 'A1PA6795UKMFR9', 'A13V1IB3VIYZZH', 'APJ6JRA9NG5V4', 'A1RKKUPIHCS9HS', 'A1805IZSGTT6HS', 'A2NODRKZP88ZB9', 'A1C3SOZRARQ6R3'];
	if (!euUkMarketplaces.includes(marketplaceId)) {
		throw new NodeOperationError(
			this.getNode(),
			'VAT invoice reports are only available for EU/UK marketplaces'
		);
	}

	// Build report request
	const reportRequest: ReportRequest = {
		reportType,
		marketplaceIds: [marketplaceId],
	};

	// Add date range if not using pending invoices only
	if (!reportOptions.pendingInvoices || reportOptions.all) {
		const startDate = this.getNodeParameter('startDate', index) as string;
		const endDate = this.getNodeParameter('endDate', index) as string;

		if (!startDate || !endDate) {
			throw new NodeOperationError(
				this.getNode(),
				'Start date and end date are required when not using pending invoices only'
			);
		}

		reportRequest.dataStartTime = new Date(startDate).toISOString();
		reportRequest.dataEndTime = new Date(endDate).toISOString();

		// Validate date range (max 30 days for VAT reports)
		const daysDiff = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24);
		if (daysDiff > 30) {
			throw new NodeOperationError(
				this.getNode(),
				'Date range for VAT invoice reports cannot exceed 30 days'
			);
		}
	}

	// Set report options
	if (reportOptions.pendingInvoices && !reportOptions.all) {
		reportRequest.reportOptions = { PendingInvoices: 'true' };
	} else if (reportOptions.all) {
		reportRequest.reportOptions = { All: 'true' };
	}

	return await processReportRequest.call(this, reportRequest, outputOptions, advancedOptions);
}

export async function getVatInvoicePdfLinks(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const marketplaceId = this.getNodeParameter('marketplaceId', index) as string;
	const outputOptions = this.getNodeParameter('outputOptions', index, {}) as any;
	const advancedOptions = this.getNodeParameter('advancedOptions', index, {}) as any;

	// VAT calculation report for PDF links
	const reportRequest: ReportRequest = {
		reportType: 'SC_VAT_TAX_REPORT',
		marketplaceIds: [marketplaceId],
	};

	return await processReportRequest.call(this, reportRequest, outputOptions, advancedOptions);
}

async function processReportRequest(
	this: IExecuteFunctions,
	reportRequest: ReportRequest,
	outputOptions: any,
	advancedOptions: any
): Promise<INodeExecutionData[]> {
	const maxPollTimeMinutes = advancedOptions.maxPollTimeMinutes || 10;
	const pollIntervalSeconds = advancedOptions.pollIntervalSeconds || 30;
	const maxPollTime = maxPollTimeMinutes * 60 * 1000; // Convert to milliseconds
	const pollInterval = pollIntervalSeconds * 1000; // Convert to milliseconds

	try {
		// Step 1: Create the report
		const reportResponse = await SpApiRequest.makeRequest<ReportResponse>(this, {
			method: 'POST',
			endpoint: '/reports/2021-06-30/reports',
			body: reportRequest,
		});

		const reportId = reportResponse.data.reportId;

		// Step 2: Poll for report completion
		const startTime = Date.now();
		let reportStatus: ReportStatus;

		do {
			if (Date.now() - startTime > maxPollTime) {
				throw new NodeOperationError(
					this.getNode(),
					`Report generation timed out after ${maxPollTimeMinutes} minutes. The report may still be processing in Amazon's system.`,
					{
						description: 'Try increasing the max poll time or check the report status later manually'
					}
				);
			}

			// Wait before polling (except first time)
			if (Date.now() - startTime > 0) {
				await new Promise(resolve => setTimeout(resolve, pollInterval));
			}

			const statusResponse = await SpApiRequest.makeRequest<ReportStatus>(this, {
				method: 'GET',
				endpoint: `/reports/2021-06-30/reports/${reportId}`,
			});

			reportStatus = statusResponse.data;

		} while (reportStatus.processingStatus === 'IN_QUEUE' || reportStatus.processingStatus === 'IN_PROGRESS');

		// Check final status
		if (reportStatus.processingStatus === 'CANCELLED') {
			throw new NodeOperationError(
				this.getNode(),
				'Report generation was cancelled by Amazon'
			);
		}

		if (reportStatus.processingStatus === 'FATAL') {
			throw new NodeOperationError(
				this.getNode(),
				'Report generation failed with a fatal error'
			);
		}

		if (!reportStatus.reportDocumentId) {
			throw new NodeOperationError(
				this.getNode(),
				'Report completed but no document ID was provided'
			);
		}

		// Step 3: Get report document details
		const documentResponse = await SpApiRequest.makeRequest<ReportDocument>(this, {
			method: 'GET',
			endpoint: `/reports/2021-06-30/documents/${reportStatus.reportDocumentId}`,
		});

		const document = documentResponse.data;

		// Step 4: Download and process the report
		const reportData = await ReportDownloader.downloadReportDocument(document, this.getNode().id);

		// Continue with processing...
		return await processReportData.call(this, reportStatus, reportRequest, reportData, outputOptions);

	} catch (error) {
		if (error instanceof NodeOperationError) {
			throw error;
		}

		throw new NodeOperationError(
			this.getNode(),
			`Failed to process invoice report: ${error instanceof Error ? error.message : 'Unknown error'}`,
			{
				description: 'Check your credentials and try again. Some reports may take longer to generate.'
			}
		);
	}
}

async function processReportData(
	this: IExecuteFunctions,
	reportStatus: ReportStatus,
	reportRequest: ReportRequest,
	reportData: Buffer,
	outputOptions: any
): Promise<INodeExecutionData[]> {
	// Determine output format
	const returnBinary = outputOptions.returnBinary !== false; // Default to true
	const parseToJson = outputOptions.parseToJson === true;
	const binaryPropertyName = outputOptions.binaryPropertyName || 'data';

	if (returnBinary && !parseToJson) {
		// Return as binary data
		const binaryData = await this.helpers.prepareBinaryData(
			reportData,
			`${reportRequest.reportType}_${new Date().toISOString().split('T')[0]}.${getFileExtension(reportRequest.reportType)}`,
			getContentType(reportRequest.reportType)
		);

		return [
			{
				json: {
					reportId: reportStatus.reportId,
					reportType: reportStatus.reportType,
					processingTime: reportStatus.processingEndTime ? 
						new Date(reportStatus.processingEndTime).getTime() - new Date(reportStatus.createdTime).getTime() : null,
					fileSize: reportData.length,
					success: true,
				},
				binary: {
					[binaryPropertyName]: binaryData,
				},
			},
		];
	} else if (parseToJson && (reportRequest.reportType.includes('FLAT_FILE') || reportRequest.reportType.includes('GST'))) {
		// Parse CSV/TSV to JSON
		const textData = reportData.toString('utf-8');
		const lines = textData.trim().split('\n');
		
		if (lines.length === 0) {
			return [{
				json: {
					reportId: reportStatus.reportId,
					reportType: reportStatus.reportType,
					message: 'Report is empty',
					data: [],
				},
			}];
		}

		// Determine delimiter (tab for most reports, comma for some)
		const delimiter = textData.includes('\t') ? '\t' : ',';
		const headers = lines[0].split(delimiter);
		const rows = lines.slice(1).map(line => {
			const values = line.split(delimiter);
			const row: Record<string, string> = {};
			headers.forEach((header, index) => {
				row[header.trim()] = values[index]?.trim() || '';
			});
			return row;
		});

		return [{
			json: {
				reportId: reportStatus.reportId,
				reportType: reportStatus.reportType,
				processingTime: reportStatus.processingEndTime ? 
					new Date(reportStatus.processingEndTime).getTime() - new Date(reportStatus.createdTime).getTime() : null,
				recordCount: rows.length,
				data: rows,
				success: true,
			},
		}];
	} else {
		// Return as text
		return [{
			json: {
				reportId: reportStatus.reportId,
				reportType: reportStatus.reportType,
				processingTime: reportStatus.processingEndTime ? 
					new Date(reportStatus.processingEndTime).getTime() - new Date(reportStatus.createdTime).getTime() : null,
				content: reportData.toString('utf-8'),
				fileSize: reportData.length,
				success: true,
			},
		}];
	}
}

function getFileExtension(reportType: string): string {
	if (reportType.includes('XML')) {
		return 'xml';
	}
	if (reportType.includes('FLAT_FILE') || reportType.includes('GST')) {
		return 'txt';
	}
	return 'txt';
}

function getContentType(reportType: string): string {
	if (reportType.includes('XML')) {
		return 'application/xml';
	}
	return 'text/plain';
}
