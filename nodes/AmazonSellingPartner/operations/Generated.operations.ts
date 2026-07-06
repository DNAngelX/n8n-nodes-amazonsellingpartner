import {
	IExecuteFunctions,
	INodeExecutionData,
	IDataObject,
	NodeOperationError,
} from 'n8n-workflow';
import { SpApiRequest } from '../helpers/SpApiRequest';
import { generatedOperationMap } from '../generated/Generated.description';

interface GeneratedParamMeta {
	name: string;
	in: 'path' | 'query' | 'body';
	required: boolean;
	type: string;
	isArray: boolean;
	enumValues?: unknown[];
	format?: string;
}

interface GeneratedOperationMeta {
	method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	endpoint: string;
	params: GeneratedParamMeta[];
	hasBody: boolean;
}

const parseJsonParameter = (value: unknown, fieldName: string): unknown => {
	if (value === null || value === undefined || value === '') {
		return undefined;
	}
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			return undefined;
		}
		try {
			return JSON.parse(trimmed);
		} catch (error) {
			throw new NodeOperationError(
				{} as any,
				`Invalid JSON provided for "${fieldName}": ${(error as Error).message ?? error}`,
			);
		}
	}
	return value;
};

const ensureObjectOrArray = (
	value: unknown,
	fieldName: string,
): IDataObject | IDataObject[] | undefined => {
	const parsed = parseJsonParameter(value, fieldName);
	if (parsed === undefined) {
		return undefined;
	}
	if (typeof parsed === 'object' && parsed !== null) {
		return parsed as IDataObject | IDataObject[];
	}
	throw new NodeOperationError(
		{} as any,
		`"${fieldName}" must be a JSON object or array.`,
	);
};

const extractSellerIdFromPayload = (data: unknown): string | undefined => {
	if (!data) return undefined;
	if (Array.isArray(data)) {
		for (const entry of data) {
			const found = extractSellerIdFromPayload(entry);
			if (found) return found;
		}
		return undefined;
	}
	if (typeof data !== 'object') return undefined;

	const record = data as Record<string, unknown>;
	if (typeof record.sellerId === 'string') return record.sellerId;
	if (record.payload) {
		const found = extractSellerIdFromPayload(record.payload);
		if (found) return found;
	}
	if (Array.isArray(record.participations)) {
		for (const part of record.participations) {
			const found = extractSellerIdFromPayload(part);
			if (found) return found;
		}
	}
	return undefined;
};

const resolveSellerId = async (executeFunctions: IExecuteFunctions): Promise<string> => {
	const credentials = await executeFunctions.getCredentials('amazonSpApi');
	if (credentials.sellerId && typeof credentials.sellerId === 'string') {
		return credentials.sellerId;
	}

	const response = await SpApiRequest.makeRequest(executeFunctions, {
		method: 'GET',
		endpoint: '/sellers/v1/marketplaceParticipations',
	});

	const sellerId = extractSellerIdFromPayload(response.data);
	if (!sellerId) {
		throw new NodeOperationError(
			executeFunctions.getNode(),
			'Could not auto-extract seller ID. Provide Seller ID in credentials or ensure marketplace participations are accessible.',
		);
	}

	return sellerId;
};

const splitCommaSeparated = (value: string): string[] => value
	.split(',')
	.map((entry) => entry.trim())
	.filter((entry) => entry.length > 0);

const paginationParamPriority = ['pageToken', 'nextToken', 'nextPageToken', 'paginationToken'];

const findPaginationParamName = (params: GeneratedParamMeta[]): string | undefined => {
	for (const name of paginationParamPriority) {
		if (params.some((param) => param.in === 'query' && param.name === name)) {
			return name;
		}
	}
	return undefined;
};

const extractNextToken = (data: IDataObject | undefined): string | undefined => {
	if (!data) return undefined;
	const pagination = data.pagination as IDataObject | undefined;
	if (pagination && typeof pagination.nextToken === 'string') {
		return pagination.nextToken;
	}
	if (typeof data.nextToken === 'string') {
		return data.nextToken as string;
	}
	if (typeof data.nextPageToken === 'string') {
		return data.nextPageToken as string;
	}
	if (typeof data.paginationToken === 'string') {
		return data.paginationToken as string;
	}
	return undefined;
};

const extractItems = (data: IDataObject | undefined): IDataObject[] | undefined => {
	if (!data) return undefined;
	if (Array.isArray(data.items)) {
		return data.items as IDataObject[];
	}
	const payload = data.payload as IDataObject | undefined;
	if (payload && Array.isArray(payload.items)) {
		return payload.items as IDataObject[];
	}
	if (Array.isArray(data.payload)) {
		return data.payload as IDataObject[];
	}
	return undefined;
};

const hasTimezoneSuffix = (value: string): boolean => /[zZ]|[+-]\\d{2}:\\d{2}$/.test(value);

const normalizeDateTimeValue = (value: unknown): unknown => {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.toISOString();
	}
	if (typeof value !== 'string') {
		return value;
	}
	const trimmed = value.trim();
	if (!trimmed) return value;
	if (hasTimezoneSuffix(trimmed)) return trimmed;
	if (/^\\d{4}-\\d{2}-\\d{2}$/.test(trimmed)) {
		return `${trimmed}T00:00:00Z`;
	}
	if (/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,3})?)?$/.test(trimmed)) {
		return `${trimmed}Z`;
	}
	const parsed = new Date(trimmed);
	if (!Number.isNaN(parsed.getTime())) {
		return parsed.toISOString();
	}
	return trimmed;
};

const normalizeDateValue = (value: unknown): unknown => {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.toISOString().slice(0, 10);
	}
	if (typeof value !== 'string') {
		return value;
	}
	const trimmed = value.trim();
	if (!trimmed) return value;
	if (/^\\d{4}-\\d{2}-\\d{2}$/.test(trimmed)) {
		return trimmed;
	}
	const parsed = new Date(trimmed);
	if (!Number.isNaN(parsed.getTime())) {
		return parsed.toISOString().slice(0, 10);
	}
	return trimmed;
};

const normalizeQueryValue = (param: GeneratedParamMeta, value: unknown): unknown => {
	if (value === null || value === undefined || value === '') {
		return undefined;
	}
	const applyFormat = (input: unknown): unknown => {
		if (param.format === 'date-time') {
			return normalizeDateTimeValue(input);
		}
		if (param.format === 'date') {
			return normalizeDateValue(input);
		}
		return input;
	};
	if (param.isArray) {
		if (Array.isArray(value)) {
			const mapped = value.map(applyFormat).filter((entry) => entry !== undefined && entry !== null && entry !== '');
			return mapped.length ? mapped.join(',') : undefined;
		}
		if (typeof value === 'string') {
			const parsed = splitCommaSeparated(value);
			const mapped = parsed.map(applyFormat).filter((entry) => entry !== undefined && entry !== null && entry !== '');
			return mapped.length ? mapped.join(',') : undefined;
		}
		const single = applyFormat(value);
		return single === undefined || single === null || single === '' ? undefined : String(single);
	}
	value = applyFormat(value);
	if (param.type === 'boolean' && typeof value === 'string') {
		const lowered = value.toLowerCase();
		if (lowered === 'true') return true;
		if (lowered === 'false') return false;
	}
	if ((param.type === 'integer' || param.type === 'number') && typeof value === 'string') {
		const parsed = Number(value);
		if (Number.isNaN(parsed)) {
			throw new NodeOperationError(
				{} as any,
				`Invalid number provided for "${param.name}".`,
			);
		}
		return parsed;
	}
	return value;
};

const normalizeEndpoint = (endpoint: string, pathParams: Record<string, string>): string => {
	let resolved = endpoint;
	for (const [key, value] of Object.entries(pathParams)) {
		resolved = resolved.replace(new RegExp(`\\{${key}\\}`, 'g'), encodeURIComponent(value));
	}
	return resolved;
};

const toReturnItem = (result: { data: any }): IDataObject => {
	if (typeof result.data === 'object' && result.data !== null) {
		return result.data as IDataObject;
	}
	return { data: result.data };
};

export async function executeGeneratedOperation(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const operationMap = generatedOperationMap as unknown as Record<string, Record<string, GeneratedOperationMeta>>;
	const resourceOperations = operationMap[resource];
	if (!resourceOperations || !resourceOperations[operation]) {
		throw new NodeOperationError(this.getNode(), `Unknown operation: ${resource}.${operation}`);
	}

	const operationMeta = resourceOperations[operation];
	const credentials = await this.getCredentials('amazonSpApi');
	let additionalOptions: IDataObject = {};
	try {
		additionalOptions = this.getNodeParameter('additionalOptions', itemIndex, {}) as IDataObject;
	} catch (error) {
		additionalOptions = {};
	}
	const optionParams: IDataObject = { ...additionalOptions };
	const returnAll = optionParams.returnAll === true;
	const maxResultsValue = optionParams.maxResults;
	const maxResults = typeof maxResultsValue === 'number' ? maxResultsValue : Number(maxResultsValue || 0);
	delete optionParams.returnAll;
	delete optionParams.maxResults;

	const query: IDataObject = {};
	const pathParams: Record<string, string> = {};
	let body: IDataObject | IDataObject[] | undefined;

	for (const param of operationMeta.params) {
		if (param.in === 'body') {
			continue;
		}

		let value: unknown;
		if (param.required) {
			value = this.getNodeParameter(param.name, itemIndex, undefined) as unknown;
		} else {
			value = optionParams[param.name];
		}
		if ((value === '' || value === undefined || value === null) && param.name === 'sellerId') {
			value = await resolveSellerId(this);
		}
		if ((value === '' || value === undefined || value === null) && param.name === 'marketplaceId') {
			value = credentials.primaryMarketplace as string;
		}
		if ((value === '' || value === undefined || value === null) && param.name === 'marketplaceIds') {
			value = [credentials.primaryMarketplace as string];
		}

		const normalized = normalizeQueryValue(param, value);
		if (normalized === undefined || normalized === null || normalized === '') {
			if (param.required && param.in === 'path') {
				throw new NodeOperationError(
					this.getNode(),
					`Missing required path parameter: ${param.name}`,
				);
			}
			continue;
		}

		if (param.in === 'path') {
			pathParams[param.name] = String(normalized);
		} else if (param.in === 'query') {
			query[param.name] = normalized as IDataObject[keyof IDataObject];
		}
	}

	if (operationMeta.hasBody) {
		body = ensureObjectOrArray(
			this.getNodeParameter('bodyJson', itemIndex, undefined),
			'bodyJson',
		);
	}

	const endpoint = normalizeEndpoint(operationMeta.endpoint, pathParams);
	const responseType = this.getNodeParameter('responseType', itemIndex, 'json') as
		| 'json'
		| 'text'
		| 'stream';

	const paginationParamName = findPaginationParamName(operationMeta.params);
	const shouldPaginate = Boolean(returnAll && paginationParamName && responseType === 'json');

	let currentQuery: IDataObject = { ...query };
	let response = await SpApiRequest.makeRequest(this, {
		method: operationMeta.method,
		endpoint,
		query: currentQuery,
		body,
		responseType,
	});

	if (!shouldPaginate) {
		return [
			{
				json: toReturnItem(response),
				pairedItem: { item: itemIndex },
			},
		];
	}

	const items: INodeExecutionData[] = [];
	const pushItems = (entries?: IDataObject[]) => {
		if (!entries || !entries.length) return;
		for (const entry of entries) {
			items.push({ json: entry, pairedItem: { item: itemIndex } });
		}
	};

	let collected = 0;
	const initialItems = extractItems(response.data);
	if (initialItems) {
		pushItems(initialItems);
		collected += initialItems.length;
	} else {
		items.push({ json: toReturnItem(response), pairedItem: { item: itemIndex } });
	}

	let nextToken = extractNextToken(response.data as IDataObject);
	let safeguard = 0;
	while (nextToken) {
		if (maxResults > 0 && collected >= maxResults) {
			break;
		}
		safeguard += 1;
		if (safeguard > 200) {
			break;
		}
		currentQuery = { ...currentQuery, [paginationParamName as string]: nextToken };
		response = await SpApiRequest.makeRequest(this, {
			method: operationMeta.method,
			endpoint,
			query: currentQuery,
			body,
			responseType,
		});
		const pageItems = extractItems(response.data as IDataObject);
		if (pageItems) {
			const remaining = maxResults > 0 ? maxResults - collected : pageItems.length;
			const slice = maxResults > 0 ? pageItems.slice(0, remaining) : pageItems;
			pushItems(slice);
			collected += slice.length;
		} else {
			items.push({ json: toReturnItem(response), pairedItem: { item: itemIndex } });
		}
		nextToken = extractNextToken(response.data as IDataObject);
	}

	return items;
}
