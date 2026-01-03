import {
    IExecuteFunctions,
    INodeExecutionData,
    NodeOperationError,
    IDataObject,
} from 'n8n-workflow';

import { SpApiRequest } from '../helpers/SpApiRequest';
import { downloadPresigned } from '../helpers/downloadPresigned';
import { minifyGraphql } from '../helpers/graphql';

const DATA_KIOSK_BASE = '/dataKiosk/2023-11-15';

interface CreateQueryResponse { queryId: string }
interface QueryPagination { nextToken?: string }
interface QueryStatus {
	queryId: string;
	query: string;
	createdTime: string;
	processingStatus: 'CANCELLED' | 'DONE' | 'FATAL' | 'IN_PROGRESS' | 'IN_QUEUE';
	processingStartTime?: string;
	processingEndTime?: string;
	dataDocumentId?: string;
	errorDocumentId?: string;
	pagination?: QueryPagination;
}

interface GetDocumentResponse { documentId: string; documentUrl: string }

export async function executeDataKioskOperation(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	switch (operation) {
		case 'createQuery':
			return await createQuery.call(this, itemIndex);
		case 'getQueries':
			return await getQueries.call(this, itemIndex);
		case 'getQuery':
			return await getQuery.call(this, itemIndex);
		case 'cancelQuery':
			return await cancelQuery.call(this, itemIndex);
		case 'getDocument':
			return await getDocument.call(this, itemIndex);
		case 'runQueryAndDownload':
			return await runQueryAndDownload.call(this, itemIndex);
		default:
			throw new NodeOperationError(this.getNode(), `Unknown dataKiosk operation: ${operation}`);
	}
}

async function createQuery(this: IExecuteFunctions, index: number): Promise<INodeExecutionData[]> {
	let query = this.getNodeParameter('query', index) as string;
	const minify = this.getNodeParameter('minifyGraphql', index, true) as boolean;
	const paginationToken = this.getNodeParameter('paginationToken', index, '') as string;

	if (minify) {
		query = minifyGraphql(query);
	}
	if (query.length > 8000) {
		throw new NodeOperationError(this.getNode(), 'GraphQL query exceeds 8000 characters after minification');
	}

	const body: Record<string, any> = { query };
	if (paginationToken) body.paginationToken = paginationToken;

    const res = await SpApiRequest.makeRequest<CreateQueryResponse>(this, {
		method: 'POST',
		endpoint: `${DATA_KIOSK_BASE}/queries`,
		body,
	});

    return [{ json: { queryId: res.data.queryId } as IDataObject }];
}

async function getQueries(this: IExecuteFunctions, index: number): Promise<INodeExecutionData[]> {
	const processingStatuses = this.getNodeParameter('processingStatuses', index, []) as string[];
	const pageSize = this.getNodeParameter('pageSize', index, 10) as number;
	const createdSince = this.getNodeParameter('createdSince', index, '') as string;
	const createdUntil = this.getNodeParameter('createdUntil', index, '') as string;
	const paginationToken = this.getNodeParameter('paginationToken', index, '') as string;

	const query: Record<string, any> = {};
	if (processingStatuses?.length) query.processingStatuses = processingStatuses;
	if (pageSize) query.pageSize = pageSize;
	if (createdSince) query.createdSince = createdSince;
	if (createdUntil) query.createdUntil = createdUntil;
	if (paginationToken) query.paginationToken = paginationToken;

    const res = await SpApiRequest.makeRequest<any>(this, {
		method: 'GET',
		endpoint: `${DATA_KIOSK_BASE}/queries`,
		query,
	});

    return [{ json: res.data as unknown as IDataObject }];
}

async function getQuery(this: IExecuteFunctions, index: number): Promise<INodeExecutionData[]> {
	const queryId = this.getNodeParameter('queryId', index) as string;
    const res = await SpApiRequest.makeRequest<QueryStatus>(this, {
		method: 'GET',
		endpoint: `${DATA_KIOSK_BASE}/queries/${encodeURIComponent(queryId)}`,
	});
    return [{ json: res.data as unknown as IDataObject }];
}

async function cancelQuery(this: IExecuteFunctions, index: number): Promise<INodeExecutionData[]> {
	const queryId = this.getNodeParameter('queryId', index) as string;
	await SpApiRequest.makeRequest<void>(this, {
		method: 'DELETE',
		endpoint: `${DATA_KIOSK_BASE}/queries/${encodeURIComponent(queryId)}`,
	});
	return [{ json: { success: true, queryId } }];
}

async function getDocument(this: IExecuteFunctions, index: number): Promise<INodeExecutionData[]> {
	const documentId = this.getNodeParameter('documentId', index) as string;
	const output = this.getNodeParameter('output', index, 'binary') as 'binary' | 'text';
	const binaryPropertyName = this.getNodeParameter('binaryPropertyName', index, 'dataKioskFile') as string;

	const meta = await SpApiRequest.makeRequest<GetDocumentResponse>(this, {
		method: 'GET',
		endpoint: `${DATA_KIOSK_BASE}/documents/${encodeURIComponent(documentId)}`,
	});

	const { buffer, contentType } = await downloadPresigned(meta.data.documentUrl);

	if (output === 'text') {
		return [{ json: { documentId, contentType, content: buffer.toString('utf-8') } }];
	}

	return [{
		json: { documentId, contentType },
		binary: {
			[binaryPropertyName]: {
				data: buffer.toString('base64'),
				fileName: `${documentId}.dat`,
				mimeType: contentType || 'application/octet-stream',
			},
		},
	}];
}

async function runQueryAndDownload(this: IExecuteFunctions, index: number): Promise<INodeExecutionData[]> {
	const metricsCollectorModule = await import('../core/MetricsCollector');
	const metricsCollector = metricsCollectorModule.metricsCollector;

	let query = this.getNodeParameter('query', index) as string;
	const minify = this.getNodeParameter('minifyGraphql', index, true) as boolean;
	const output = this.getNodeParameter('output', index, 'binary') as 'binary' | 'text';
	const binaryPropertyName = this.getNodeParameter('binaryPropertyName', index, 'dataKioskFile') as string;
	const pollIntervalMs = this.getNodeParameter('pollIntervalMs', index, 2000) as number;
	const timeoutMs = this.getNodeParameter('timeoutMs', index, 300000) as number;
	const multiPageHandling = this.getNodeParameter('multiPageHandling', index, 'keepPagesSeparate') as 'keepPagesSeparate' | 'stopAfterFirst';

	if (minify) query = minifyGraphql(query);
	if (query.length > 8000) {
		throw new NodeOperationError(this.getNode(), 'GraphQL query exceeds 8000 characters after minification');
	}

    const startedAt = Date.now();
	const items: INodeExecutionData[] = [];

	let paginationToken: string | undefined = undefined;
	let pageIndex = 0;

	const requestMetrics = (success: boolean, errorCode?: string) => {
		metricsCollector.recordApiRequest('dataKiosk', Date.now() - startedAt, success, errorCode);
	};

	do {
		// 1) Create query
		const createRes = await SpApiRequest.makeRequest<CreateQueryResponse>(this, {
			method: 'POST',
			endpoint: `${DATA_KIOSK_BASE}/queries`,
			body: paginationToken ? { query, paginationToken } : { query },
		});
		const queryId: string = createRes.data.queryId;

		// 2) Poll status
		let status: QueryStatus | undefined;
		do {
			if (Date.now() - startedAt > timeoutMs) {
				requestMetrics(false, 'TIMEOUT');
				throw new NodeOperationError(this.getNode(), 'Timeout while waiting for Data Kiosk query to complete');
			}
			await new Promise((r) => setTimeout(r, pollIntervalMs));
			const statusRes = await SpApiRequest.makeRequest<QueryStatus>(this, {
				method: 'GET',
				endpoint: `${DATA_KIOSK_BASE}/queries/${encodeURIComponent(queryId)}`,
			});
			status = statusRes.data;
		} while (status && (status.processingStatus === 'IN_QUEUE' || status.processingStatus === 'IN_PROGRESS'));

		if (!status) {
			requestMetrics(false, 'NO_STATUS');
			throw new NodeOperationError(this.getNode(), 'Unable to fetch query status');
		}

        if (status.processingStatus === 'FATAL') {
			if (status.errorDocumentId) {
				const docMeta = await SpApiRequest.makeRequest<GetDocumentResponse>(this, {
					method: 'GET',
					endpoint: `${DATA_KIOSK_BASE}/documents/${encodeURIComponent(status.errorDocumentId)}`,
				});
				const { buffer, contentType } = await downloadPresigned(docMeta.data.documentUrl);
				throw new NodeOperationError(this.getNode(), `Data Kiosk query failed. errorDocumentId=${status.errorDocumentId}, contentType=${contentType}, content=${buffer.toString('utf-8').slice(0, 500)}`);
			}
			throw new NodeOperationError(this.getNode(), 'Data Kiosk query failed with FATAL status');
		}

		if (status.processingStatus === 'CANCELLED') {
			throw new NodeOperationError(this.getNode(), 'Data Kiosk query was cancelled');
		}

		// 3) Download data document if present
        if (status.dataDocumentId) {
			const meta = await SpApiRequest.makeRequest<GetDocumentResponse>(this, {
				method: 'GET',
				endpoint: `${DATA_KIOSK_BASE}/documents/${encodeURIComponent(status.dataDocumentId)}`,
			});
			const { buffer, contentType } = await downloadPresigned(meta.data.documentUrl);

			if (output === 'text') {
				items.push({ json: {
					queryId: status.queryId,
					pageIndex,
					contentType,
					content: buffer.toString('utf-8'),
					processingStatus: status.processingStatus,
					processingStartTime: status.processingStartTime,
					processingEndTime: status.processingEndTime,
				}});
			} else {
				items.push({
					json: {
						queryId: status.queryId,
						pageIndex,
						contentType,
						processingStatus: status.processingStatus,
						processingStartTime: status.processingStartTime,
						processingEndTime: status.processingEndTime,
					},
					binary: {
						[binaryPropertyName]: {
							data: buffer.toString('base64'),
							fileName: `${status.queryId}_${pageIndex}.dat`,
							mimeType: contentType || 'application/octet-stream',
						},
					},
				});
			}
		}

		// 4) Handle pagination token from status
		paginationToken = status.pagination?.nextToken;
		pageIndex += 1;
		if (multiPageHandling === 'stopAfterFirst') break;
		requestMetrics(true);
    } while (paginationToken);

    return items;
}


