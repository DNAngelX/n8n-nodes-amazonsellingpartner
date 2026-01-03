import {
	IExecuteFunctions,
	INodeExecutionData,
	IDataObject,
	NodeOperationError,
} from 'n8n-workflow';
import { SpApiRequest } from '../helpers/SpApiRequest';

interface CustomRequestDefinition {
	method?: string;
	endpoint?: string;
	query?: IDataObject;
	body?: IDataObject | IDataObject[];
	headers?: IDataObject;
	responseType?: 'json' | 'text';
	includeMetadata?: boolean;
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

const ensureObject = (value: unknown, fieldName: string): IDataObject | undefined => {
	const parsed = parseJsonParameter(value, fieldName);
	if (parsed === undefined) {
		return undefined;
	}
	if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
		return parsed as IDataObject;
	}
	throw new NodeOperationError({} as any, `"${fieldName}" must be a JSON object.`);
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

const hasBodyContent = (value: IDataObject | IDataObject[] | undefined): boolean => {
	if (value === undefined) {
		return false;
	}
	if (Array.isArray(value)) {
		return value.length > 0;
	}
	return Object.keys(value).length > 0;
};

const mergeQueryObjects = (
	target: IDataObject | undefined,
	additions?: IDataObject,
): IDataObject | undefined => {
	if (!additions || !Object.keys(additions).length) {
		return target;
	}
	const aggregated: Record<string, string[]> = {};
	const pushValue = (key: string, value: unknown) => {
		if (value === undefined || value === null) {
			return;
		}
		if (!aggregated[key]) {
			aggregated[key] = [];
		}
		aggregated[key].push(String(value));
	};

	const addFromSource = (source?: IDataObject) => {
		if (!source) return;
		for (const [key, value] of Object.entries(source)) {
			if (Array.isArray(value)) {
				value.forEach((item) => pushValue(key, item));
			} else {
				pushValue(key, value);
			}
		}
	};

	addFromSource(target);
	addFromSource(additions);

	const result: IDataObject = {};
	for (const [key, values] of Object.entries(aggregated)) {
		result[key] = values.length === 1 ? values[0] : values;
	}
	return result;
};

const bodyToQueryParams = (input: IDataObject | IDataObject[]): IDataObject => {
	if (Array.isArray(input)) {
		throw new NodeOperationError(
			{} as any,
			'For GET/HEAD requests the body must be a JSON object.',
		);
	}

	const entries: Record<string, string[]> = {};

	const appendValue = (key: string, value: unknown) => {
		if (value === undefined || value === null || value === '') {
			return;
		}
		if (Array.isArray(value)) {
			value.forEach((item) => appendValue(`${key}[]`, item));
			return;
		}
		if (typeof value === 'object') {
			for (const [childKey, childValue] of Object.entries(value as IDataObject)) {
				const nextKey = key ? `${key}[${childKey}]` : childKey;
				appendValue(nextKey, childValue);
			}
			return;
		}
		const stringValue = String(value);
		if (!entries[key]) {
			entries[key] = [];
		}
		entries[key].push(stringValue);
	};

	for (const [key, value] of Object.entries(input)) {
		appendValue(key, value);
	}

	const queryObject: IDataObject = {};
	for (const [key, values] of Object.entries(entries)) {
		queryObject[key] = values.length === 1 ? values[0] : values;
	}

	return queryObject;
};

const normalizeEndpoint = (endpoint: string): string => {
	if (/^https?:\/\//i.test(endpoint)) {
		return endpoint;
	}
	return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
};

const sanitizeHeaders = (headers?: IDataObject): Record<string, string> | undefined => {
	if (!headers || !Object.keys(headers).length) {
		return undefined;
	}
	const blocked = new Set(['x-amz-access-token', 'authorization', 'host', 'content-length']);
	const output: Record<string, string> = {};
	for (const [key, value] of Object.entries(headers)) {
		const lowerKey = key.toLowerCase();
		if (blocked.has(lowerKey) || value === undefined || value === null) {
			continue;
		}
		output[key] = String(value);
	}
	return Object.keys(output).length ? output : undefined;
};

const toReturnItem = (
	result: { data: any; headers: Record<string, string>; status: number },
	includeMetadata: boolean,
): IDataObject => {
	if (!includeMetadata) {
		return typeof result.data === 'object' && result.data !== null
			? (result.data as IDataObject)
			: { data: result.data };
	}
	return {
		data: result.data,
		status: result.status,
		headers: result.headers,
	};
};

export async function executeCustomOperation(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	const executeSingle = async (definition: CustomRequestDefinition): Promise<void> => {
		const method = (definition.method ?? 'GET').toUpperCase();
		const endpoint = definition.endpoint;
		if (!endpoint) {
			throw new NodeOperationError(this.getNode(), 'Endpoint is required.');
		}

		const query = definition.query ?? undefined;
		const body = definition.body ?? undefined;
		const headers = sanitizeHeaders(definition.headers);

		let finalQuery = query;
		let finalBody = body;
		if (hasBodyContent(body) && ['GET', 'HEAD'].includes(method)) {
			const bodyQuery = bodyToQueryParams(body as IDataObject);
			finalQuery = mergeQueryObjects(finalQuery, bodyQuery);
			finalBody = undefined;
		}

		const responseType = definition.responseType === 'text' ? 'text' : 'json';
		const result = await SpApiRequest.makeRequest(this, {
			method: method as any,
			endpoint: normalizeEndpoint(endpoint),
			query: finalQuery as Record<string, any> | undefined,
			body: finalBody,
			headers,
			responseType,
		});

		const output = toReturnItem(result, Boolean(definition.includeMetadata));
		returnData.push({ json: output, pairedItem: { item: itemIndex } });
	};

	if (operation === 'customRequest') {
		const method = this.getNodeParameter('method', itemIndex) as string;
		const endpoint = this.getNodeParameter('endpoint', itemIndex) as string;
		const query = ensureObject(this.getNodeParameter('queryJson', itemIndex, {}), 'Query (JSON)');
		const body = ensureObjectOrArray(this.getNodeParameter('bodyJson', itemIndex, {}), 'Body (JSON)');
		const headers = ensureObject(this.getNodeParameter('headersJson', itemIndex, {}), 'Headers (JSON)');
		const responseType = this.getNodeParameter('responseType', itemIndex, 'json') as 'json' | 'text';
		const includeMetadata = this.getNodeParameter('includeMetadata', itemIndex, false) as boolean;

		await executeSingle({
			method,
			endpoint,
			query,
			body,
			headers,
			responseType,
			includeMetadata,
		});

		return returnData;
	}

	if (operation === 'jsonDefinition') {
		const requestJsonRaw = this.getNodeParameter('requestJson', itemIndex, {}) as unknown;
		const parsedRequestJson = parseJsonParameter(requestJsonRaw, 'Request Definition (JSON)');

		if (
			parsedRequestJson === undefined ||
			(typeof parsedRequestJson !== 'object' && !Array.isArray(parsedRequestJson))
		) {
			throw new NodeOperationError(this.getNode(), 'Request definition must be a JSON object or array.');
		}

		const requests = Array.isArray(parsedRequestJson)
			? (parsedRequestJson as IDataObject[])
			: [parsedRequestJson as IDataObject];

		for (const requestDef of requests) {
			const definition: CustomRequestDefinition = {
				method: requestDef.method as string | undefined,
				endpoint: requestDef.endpoint as string | undefined,
				query: ensureObject(requestDef.query, 'query'),
				body: ensureObjectOrArray(requestDef.body, 'body'),
				headers: ensureObject(requestDef.headers, 'headers'),
				responseType: requestDef.responseType as 'json' | 'text' | undefined,
				includeMetadata: Boolean(requestDef.includeMetadata),
			};

			await executeSingle(definition);
		}

		return returnData;
	}

	throw new NodeOperationError(this.getNode(), `Unknown custom operation: ${operation}`);
}
