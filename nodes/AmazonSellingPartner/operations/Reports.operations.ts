import axios from 'axios';
import {
	IBinaryData,
	IExecuteFunctions,
	INodeExecutionData,
	NodeOperationError,
	IDataObject,
} from 'n8n-workflow';
import { parse as parseCsv } from 'csv-parse/sync';
import { gunzip } from 'zlib';
import { promisify } from 'util';
import { SpApiRequest } from '../helpers/SpApiRequest';
import { securityValidator } from '../core/SecurityValidator';
import { auditLogger } from '../core/AuditLogger';

interface ReportCreationResponse {
	reportId: string;
}

interface ReportStatusResponse {
	reportId: string;
	reportType: string;
	processingStatus: 'DONE' | 'IN_PROGRESS' | 'IN_QUEUE' | 'CANCELLED' | 'DONE_NO_DATA' | 'FATAL';
	createdTime: string;
	processingStartTime?: string;
	processingEndTime?: string;
	reportDocumentId?: string;
}

interface ReportDocumentDetails {
	reportDocumentId: string;
	url: string;
	compressionAlgorithm?: 'GZIP';
	encryptionDetails?: {
		encryptionStandard: string;
		initializationVector: string;
		key: string;
	};
}

interface RefundEvent {
	postedDate?: string;
	marketplaceId?: string;
	chargeInstrument?: {
		currencyCode: string;
		amount: number;
	};
	refundChargeTransactions?: Array<{ amount: { currencyCode: string; amount: number }; chargeType: string }>;
	payload?: any;
}

type ParsedReportRow = Record<string, string>;

const REPORT_TYPE_MAP: Record<string, string> = {
	salesTrafficByAsin: 'GET_SALES_AND_TRAFFIC_REPORT',
	returnsByAsinFba: 'GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA',
	returnsByAsinMfn: 'GET_FLAT_FILE_RETURNS_DATA_BY_RETURN_DATE',
};

const gunzipAsync = promisify(gunzip);

function normalizeDate(dateStr?: string): string | undefined {
	if (!dateStr) {
		return undefined;
	}
	const parsed = new Date(dateStr);
	if (Number.isNaN(parsed.getTime())) {
		return undefined;
	}
	return parsed.toISOString();
}

function mapSalesTrafficRow(row: ParsedReportRow) {
	const isoDate = normalizeDate(row['date'] || row['detailed-page-sales-dataset.date']);
	return {
		date: isoDate ?? row['date'] ?? row['detailed-page-sales-dataset.date'] ?? '',
		asin: row['asin'] || row['child-asins.asin'] || row['sku-child.asin'],
		sku: row['sku'] || row['child-asins.sku'] || row['sku-child.sku'],
		parentAsin: row['parent-asins.parent-asin'],
		marketplaceId: row['marketplace'] || row['marketplace-name'],
		orderedUnits: Number(row['units'] || row['ordered-units'] || row['ordered']) || 0,
		orderedProductSales: {
			amount: Number(row['ordered-product-sales'] || row['ordered-revenue']) || 0,
			currencyCode: row['ordered-product-sales-currency-code'] || row['currency-code'] || 'USD',
		},
		sessions: row['sessions'] ? Number(row['sessions']) : undefined,
		pageViews: row['page-views'] ? Number(row['page-views']) : undefined,
		buyBoxPercentage: row['buy-box-percentage'] ? Number(row['buy-box-percentage']) : undefined,
	};
}

function mapReturnsRow(row: ParsedReportRow, channel: 'FBA' | 'MFN') {
	return {
		date:
			normalizeDate(
				row['return-date'] ||
				row['return_datetime'] ||
				row['posted-date'] ||
				row['return-date-time'],
			) ?? row['return-date'] ?? row['return_datetime'] ?? row['posted-date'] ?? row['return-date-time'] ?? '',
		asin: row['asin'] || row['child-asins.asin'] || row['seller-sku'],
		sku: row['seller-sku'] || row['sku'],
		marketplaceId: row['marketplace-id'] || row['marketplace'],
		returnedUnits: Number(row['quantity'] || row['quantity-returned'] || row['number-of-returned-units']) || 0,
		fulfillmentChannel: channel,
		reason: row['return-reason'] || row['reason'] || row['return-reason-description'],
		reimbursementType: row['reimbursement-type'],
	};
}

function sumRefundEvents(events: RefundEvent[]) {
	const totals: Record<string, { amount: number; currencyCode: string }> = {};
	events.forEach(event => {
		const chargeTransactions = event.refundChargeTransactions || [];
		chargeTransactions.forEach(charge => {
			const marketplaceId = event.marketplaceId || 'UNKNOWN';
			if (!totals[marketplaceId]) {
				totals[marketplaceId] = {
					amount: 0,
					currencyCode: charge.amount.currencyCode,
				};
			}
			totals[marketplaceId].amount += Number(charge.amount.amount || 0);
		});
	});
	return totals;
}

async function downloadReportDocument(
	executeFunctions: IExecuteFunctions,
	reportDocumentId: string,
	returnRaw: boolean,
	binaryPropertyName: string,
) {
	const response = await SpApiRequest.makeRequest<ReportDocumentDetails>(executeFunctions, {
		method: 'GET',
		endpoint: `/reports/2021-06-30/documents/${reportDocumentId}`,
	});

	const { url, compressionAlgorithm } = response.data;
	const documentResponse = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });

	let dataBuffer = Buffer.from(documentResponse.data);

	if (compressionAlgorithm === 'GZIP') {
		dataBuffer = await gunzipAsync(dataBuffer);
	}

	if (!dataBuffer || dataBuffer.length === 0) {
		throw new NodeOperationError(executeFunctions.getNode(), 'Failed to download report document');
	}

	return {
		buffer: dataBuffer,
		binaryData: returnRaw
			? {
				propertyName: binaryPropertyName,
				data: dataBuffer.toString('base64'),
				mimeType: compressionAlgorithm === 'GZIP' ? 'application/gzip' : 'text/plain',
				fileName: `${reportDocumentId}.${compressionAlgorithm === 'GZIP' ? 'gz' : 'txt'}`,
			}
			: undefined,
	};
}

async function createReportAndPoll(
	executeFunctions: IExecuteFunctions,
	reportType: string,
	dataStartTime: string,
	dataEndTime: string,
	marketplaceIds: string[],
	advancedOptions: any,
	options?: Record<string, any>
) {
	const node = executeFunctions.getNode();

	const createResponse = await SpApiRequest.makeRequest<ReportCreationResponse>(executeFunctions, {
		method: 'POST',
		endpoint: '/reports/2021-06-30/reports',
		body: {
			reportType,
			dataStartTime,
			dataEndTime,
			marketplaceIds,
			reportOptions: options,
		},
	});

	const reportId = createResponse.data.reportId;
	const maxPollTimeMs = (advancedOptions?.maxPollTimeMinutes ?? 10) * 60 * 1000;
	const pollIntervalMs = (advancedOptions?.pollIntervalSeconds ?? 30) * 1000;
	const start = Date.now();

	while (Date.now() - start < maxPollTimeMs) {
		await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

		const statusResponse = await SpApiRequest.makeRequest<ReportStatusResponse>(executeFunctions, {
			method: 'GET',
			endpoint: `/reports/2021-06-30/reports/${reportId}`,
		});

		const status = statusResponse.data;
		switch (status.processingStatus) {
			case 'DONE':
			case 'DONE_NO_DATA':
				return status.reportDocumentId;
			case 'CANCELLED':
			case 'FATAL':
				throw new NodeOperationError(node, `Report ${reportType} failed with status ${status.processingStatus}`);
		}
	}

	throw new NodeOperationError(node, `Report ${reportType} timed out after ${advancedOptions?.maxPollTimeMinutes ?? 10} minutes`);
}

function parseReport(buffer: Buffer) {
	try {
		const content = buffer.toString('utf8').trim();
		
		// First, try to detect if this is JSON content
		if (content.startsWith('{') || content.startsWith('[')) {
			try {
				const jsonData = JSON.parse(content);
				// If it's an array, return it directly
				if (Array.isArray(jsonData)) {
					return jsonData;
				}
				// If it's an object, wrap it in an array
				return [jsonData];
			} catch (jsonError) {
				// If JSON parsing fails, fall through to CSV/TSV parsing
				// This handles cases where content starts with { but isn't valid JSON
			}
		}
		
		// Auto-detect delimiter by checking the first line
		// Amazon SP-API reports are typically tab-separated
		const firstLineEnd = content.indexOf('\n');
		const firstLine = firstLineEnd > 0 ? content.substring(0, firstLineEnd) : content;
		
		// Count tabs and commas in the header to determine delimiter
		const tabCount = (firstLine.match(/\t/g) || []).length;
		const commaCount = (firstLine.match(/,/g) || []).length;
		
		// Determine delimiter: use whichever appears more frequently
		// Default to tab if counts are equal (Amazon SP-API typically uses tabs)
		const delimiter = tabCount >= commaCount ? '\t' : ',';
		
		return parseCsv(content, {
			columns: true,
			skip_empty_lines: true,
			delimiter: delimiter,
			relax_column_count: true, // Allow inconsistent column counts
		});
	} catch (error) {
		throw new Error(`Failed to parse report: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

function validateDateRange(start: string, end: string, nodeId: string) {
	const validation = securityValidator.validateDateRange(start, end, nodeId);
	if (!validation.isValid) {
		throw new Error(validation.errors.join(', '));
	}
}

export async function executeReportsOperation(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const nodeId = this.getNode().id;
	const dateFrom = this.getNodeParameter('dateFrom', itemIndex) as string;
	const dateTo = this.getNodeParameter('dateTo', itemIndex) as string;
	const marketplaceIds = this.getNodeParameter('marketplaceIds', itemIndex) as string[];
	const granularity = this.getNodeParameter('granularity', itemIndex) as string;

	auditLogger.logEvent({
		nodeId,
		action: 'operation_start',
		resource: 'reports',
		details: { operation, itemIndex },
		severity: 'low',
		source: 'user',
		outcome: 'success',
	});

	const marketplaceValidation = securityValidator.validateMarketplaceIds(marketplaceIds, nodeId);
	if (!marketplaceValidation.isValid) {
		throw new NodeOperationError(this.getNode(), marketplaceValidation.errors.join(', '));
	}

	try {
		validateDateRange(dateFrom, dateTo, nodeId);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error instanceof Error ? error.message : String(error));
	}

	switch (operation) {
		case 'salesTrafficByAsin':
			return await handleSalesTraffic.call(this, itemIndex, {
				reportType: REPORT_TYPE_MAP.salesTrafficByAsin,
				reportOptions: buildSalesTrafficOptions.call(this, itemIndex, granularity),
			});
		case 'returnsByAsinFba':
			return await handleReturns.call(this, itemIndex, REPORT_TYPE_MAP.returnsByAsinFba, 'FBA');
		case 'returnsByAsinMfn':
			return await handleReturns.call(this, itemIndex, REPORT_TYPE_MAP.returnsByAsinMfn, 'MFN');
		case 'consolidatedSalesAndReturnsByAsin':
			return await handleConsolidated.call(this, itemIndex);
		case 'refundsByAsin':
			return await handleRefunds.call(this, itemIndex);
		default:
			throw new NodeOperationError(this.getNode(), `Unknown reports operation: ${operation}`);
	}
}

function buildSalesTrafficOptions(this: IExecuteFunctions, itemIndex: number, granularity: string) {
	const aggregationLevel = this.getNodeParameter('aggregationLevel', itemIndex, 'CHILD') as string;
	const includeSessions = this.getNodeParameter('includeSessions', itemIndex, true) as boolean;
	return {
		'asinGranularity': aggregationLevel,
		'dateGranularity': granularity,
		'includeASIN': 'true',
		'includeChildASIN': aggregationLevel === 'PARENT' ? 'false' : 'true',
		'includeSessions': includeSessions ? 'true' : 'false',
	};
}

async function handleSalesTraffic(
	this: IExecuteFunctions,
	itemIndex: number,
	options: { reportType: string; reportOptions: Record<string, string> },
) {
	const dateFrom = this.getNodeParameter('dateFrom', itemIndex) as string;
	const dateTo = this.getNodeParameter('dateTo', itemIndex) as string;
	const marketplaceIds = this.getNodeParameter('marketplaceIds', itemIndex) as string[];

	const advancedOptions = this.getNodeParameter('advancedOptions', itemIndex, {}) as IDataObject;
	const reportDocumentId = await createReportAndPoll(
		this,
		options.reportType,
		dateFrom,
		dateTo,
		marketplaceIds,
		this.getNodeParameter('advancedOptions', itemIndex, {}) as IDataObject,
		options.reportOptions,
	);

	const { buffer, binaryData } = await downloadReportDocument(
		this,
		reportDocumentId!,
		Boolean(advancedOptions?.returnRawDocument),
		(advancedOptions?.binaryPropertyName as string) || 'data',
	);

	const rows = parseReport(buffer) as ParsedReportRow[];
	const mapped = rows.map((row) => mapSalesTrafficRow(row)) as IDataObject[];

	return mapped.map(row => {
		const item: INodeExecutionData = {
			json: row,
			pairedItem: { item: itemIndex },
		};
		if (binaryData) {
			item.binary = {
				[binaryData.propertyName]: {
					data: binaryData.data,
					fileName: binaryData.fileName,
					mimeType: binaryData.mimeType,
				} as IBinaryData,
			};
		}
		return item;
	});
}

async function handleReturns(
	this: IExecuteFunctions,
	itemIndex: number,
	reportType: string,
	channel: 'FBA' | 'MFN',
) {
	const dateFrom = this.getNodeParameter('dateFrom', itemIndex) as string;
	const dateTo = this.getNodeParameter('dateTo', itemIndex) as string;
	const marketplaceIds = this.getNodeParameter('marketplaceIds', itemIndex) as string[];

	const advancedOptions = this.getNodeParameter('advancedOptions', itemIndex, {}) as IDataObject;
	const reportDocumentId = await createReportAndPoll(
		this,
		reportType,
		dateFrom,
		dateTo,
		marketplaceIds,
		this.getNodeParameter('advancedOptions', itemIndex, {}) as IDataObject,
	);

	const { buffer, binaryData } = await downloadReportDocument(
		this,
		reportDocumentId!,
		Boolean(advancedOptions?.returnRawDocument),
		(advancedOptions?.binaryPropertyName as string) || 'data',
	);

	const rows = parseReport(buffer) as ParsedReportRow[];
	const mapped = rows.map(row => mapReturnsRow(row, channel)) as IDataObject[];

	return mapped.map(row => {
		const item: INodeExecutionData = {
			json: row,
			pairedItem: { item: itemIndex },
		};
		if (binaryData) {
			item.binary = {
				[binaryData.propertyName]: {
					data: binaryData.data,
					fileName: binaryData.fileName,
					mimeType: binaryData.mimeType,
				} as IBinaryData,
			};
		}
		return item;
	});
}

async function handleConsolidated(this: IExecuteFunctions, itemIndex: number) {
	const includeRefunds = this.getNodeParameter('includeRefunds', itemIndex, false) as boolean;
	const emitRawSubdatasets = this.getNodeParameter('emitRawSubdatasets', itemIndex, false) as boolean;

	const operations = [
		handleSalesTraffic.call(this, itemIndex, {
			reportType: REPORT_TYPE_MAP.salesTrafficByAsin,
			reportOptions: buildSalesTrafficOptions.call(this, itemIndex, this.getNodeParameter('granularity', itemIndex) as string),
		}),
		handleReturns.call(this, itemIndex, REPORT_TYPE_MAP.returnsByAsinFba, 'FBA'),
		handleReturns.call(this, itemIndex, REPORT_TYPE_MAP.returnsByAsinMfn, 'MFN'),
	];

	if (includeRefunds) {
		operations.push(handleRefunds.call(this, itemIndex));
	}

	const [sales, fbaReturns, mfnReturns, refunds] = await Promise.all(operations);

	const consolidatedMap = new Map<string, {
		date: string;
		marketplaceId?: string;
		asin?: string;
		sku?: string;
		orderedUnits: number;
		orderedProductSales: { amount: number; currencyCode: string };
		fbaReturnedUnits: number;
		mfnReturnedUnits: number;
		refundsAmount?: number;
		currencyCode?: string;
	}>();

	const keyFn = (row: IDataObject) => `${row.date}|${row.marketplaceId}|${row.asin || row.sku || ''}`;

	sales.forEach(item => {
		const salesRow = item.json as IDataObject;
		const asphaltUnits = Number(salesRow.orderedUnits || 0);
		const productSales = salesRow.orderedProductSales as IDataObject | undefined;
		const key = keyFn(salesRow);
		consolidatedMap.set(key, {
			date: salesRow.date as string,
			marketplaceId: salesRow.marketplaceId as string | undefined,
			asin: salesRow.asin as string | undefined,
			sku: salesRow.sku as string | undefined,
			orderedUnits: asphaltUnits,
			orderedProductSales: {
				amount: Number(productSales?.amount || 0),
				currencyCode: (productSales?.currencyCode as string) || 'USD',
			},
			fbaReturnedUnits: 0,
			mfnReturnedUnits: 0,
			refundsAmount: undefined,
			currencyCode: (productSales?.currencyCode as string) || 'USD',
		});
	});

	[fbaReturns, mfnReturns].forEach((dataset, index) => {
		dataset.forEach(item => {
			const returnsRow = item.json as IDataObject;
			
			// Skip entries with empty/missing critical fields
			if (!returnsRow.date || (!returnsRow.asin && !returnsRow.sku)) {
				return;
			}
			
			// Skip entries with zero returned units
			const returnedUnits = Number(returnsRow.returnedUnits || 0);
			if (returnedUnits === 0) {
				return;
			}
			
			const key = keyFn(returnsRow);
			const existing = consolidatedMap.get(key) || {
				date: returnsRow.date as string,
				marketplaceId: returnsRow.marketplaceId as string | undefined,
				asin: returnsRow.asin as string | undefined,
				sku: returnsRow.sku as string | undefined,
				orderedUnits: 0,
				orderedProductSales: { amount: 0, currencyCode: 'USD' },
				fbaReturnedUnits: 0,
				mfnReturnedUnits: 0,
				refundsAmount: undefined,
				currencyCode: 'USD',
			};
			const field = index === 0 ? 'fbaReturnedUnits' : 'mfnReturnedUnits';
			existing[field] += returnedUnits;
			consolidatedMap.set(key, existing);
		});
	});

	if (includeRefunds && refunds) {
		refunds.forEach(item => {
			const refundRow = item.json as IDataObject;
			const key = keyFn(refundRow);
			const existing = consolidatedMap.get(key);
			if (!existing) {
				consolidatedMap.set(key, {
					date: refundRow.date as string,
					marketplaceId: refundRow.marketplaceId as string | undefined,
					asin: undefined,
					sku: undefined,
					orderedUnits: 0,
					orderedProductSales: { amount: 0, currencyCode: (refundRow.currencyCode as string) || 'USD' },
					fbaReturnedUnits: 0,
					mfnReturnedUnits: 0,
					refundsAmount: Number(refundRow.refundsAmount || 0),
					currencyCode: (refundRow.currencyCode as string) || 'USD',
				});
			} else {
				existing.refundsAmount = Number(refundRow.refundsAmount || 0);
				existing.currencyCode = (refundRow.currencyCode as string) || existing.currencyCode || 'USD';
			}
		});
	}

	const consolidatedItems = Array.from(consolidatedMap.values()).map(value => ({
		json: value,
		pairedItem: { item: itemIndex },
	}));

	if (emitRawSubdatasets) {
		// Filter out empty/meaningless entries from raw subdatasets
		const filterValidEntries = (items: INodeExecutionData[]) => {
			return items.filter(item => {
				const row = item.json as IDataObject;
				// Keep entries that have a date AND (asin OR sku)
				// OR have non-zero units/amounts
				return (row.date && (row.asin || row.sku)) || 
				       Number(row.orderedUnits || 0) > 0 || 
				       Number(row.returnedUnits || 0) > 0 ||
				       Number(row.refundsAmount || 0) > 0;
			});
		};

		return [
			...consolidatedItems,
			...filterValidEntries(sales),
			...filterValidEntries(fbaReturns),
			...filterValidEntries(mfnReturns),
			...(refunds ? filterValidEntries(refunds) : []),
		] as INodeExecutionData[];
	}

	return consolidatedItems;
}

async function handleRefunds(this: IExecuteFunctions, itemIndex: number) {
	const dateFrom = this.getNodeParameter('dateFrom', itemIndex) as string;
	const dateTo = this.getNodeParameter('dateTo', itemIndex) as string;
	const marketplaceIds = this.getNodeParameter('marketplaceIds', itemIndex) as string[];

	const response = await SpApiRequest.makeRequest<{ payload: { RefundEventList?: RefundEvent[] } }>(this, {
		method: 'GET',
		endpoint: '/finances/v0/refunds',
		query: {
			postedAfter: dateFrom,
			postedBefore: dateTo,
		},
	});

	const refundEvents = response.data.payload?.RefundEventList || [];
	const totalsByMarketplace = sumRefundEvents(refundEvents);

	const items: INodeExecutionData[] = [];
	Object.entries(totalsByMarketplace).forEach(([marketplaceId, totals]) => {
		if (!marketplaceIds.includes(marketplaceId)) {
			return;
		}
		items.push({
			json: {
				date: dateTo,
				marketplaceId,
				refundsAmount: totals.amount,
				currencyCode: totals.currencyCode,
			},
			pairedItem: { item: itemIndex },
		});
	});

	return items;
}

