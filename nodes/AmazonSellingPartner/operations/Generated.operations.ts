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

const normalizeQueryValue = (param: GeneratedParamMeta, value: unknown): unknown => {
	if (value === null || value === undefined || value === '') {
		return undefined;
	}
	if (param.isArray) {
		if (Array.isArray(value)) {
			return value.length ? value : undefined;
		}
		if (typeof value === 'string') {
			const parsed = splitCommaSeparated(value);
			return parsed.length ? parsed : undefined;
		}
		return [value];
	}
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

	const query: IDataObject = {};
	const pathParams: Record<string, string> = {};
	let body: IDataObject | IDataObject[] | undefined;

	for (const param of operationMeta.params) {
		if (param.in === 'body') {
			continue;
		}

		let value = this.getNodeParameter(param.name, itemIndex, undefined) as unknown;
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

	const response = await SpApiRequest.makeRequest(this, {
		method: operationMeta.method,
		endpoint,
		query,
		body,
		responseType,
	});

	return [
		{
			json: toReturnItem(response),
			pairedItem: { item: itemIndex },
		},
	];
}
