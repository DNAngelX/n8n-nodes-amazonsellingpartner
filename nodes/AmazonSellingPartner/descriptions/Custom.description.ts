import { INodeProperties } from 'n8n-workflow';

export const customOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['custom'],
			},
		},
		options: [
			{
				name: 'Custom Request',
				value: 'customRequest',
				description: 'Send a custom SP-API request',
				action: 'Send a custom request',
			},
			{
				name: 'Request via JSON Definition',
				value: 'jsonDefinition',
				description: 'Provide a full JSON definition for the request',
				action: 'Send a request via JSON definition',
			},
		],
		default: 'customRequest',
	},
];

export const customFields: INodeProperties[] = [
	{
		displayName: 'HTTP Method',
		name: 'method',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['custom'],
				operation: ['customRequest'],
			},
		},
		options: [
			{ name: 'GET', value: 'GET' },
			{ name: 'POST', value: 'POST' },
			{ name: 'PUT', value: 'PUT' },
			{ name: 'PATCH', value: 'PATCH' },
			{ name: 'DELETE', value: 'DELETE' },
		],
		default: 'GET',
	},
	{
		displayName: 'Endpoint',
		name: 'endpoint',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['custom'],
				operation: ['customRequest'],
			},
		},
		default: '/catalog/2022-04-01/items',
		description: 'SP-API path starting with /. Full URLs are also supported.',
	},
	{
		displayName: 'Query (JSON)',
		name: 'queryJson',
		type: 'json',
		displayOptions: {
			show: {
				resource: ['custom'],
				operation: ['customRequest'],
			},
		},
		default: '{}',
		description: 'Query string parameters as JSON object',
	},
	{
		displayName: 'Body (JSON)',
		name: 'bodyJson',
		type: 'json',
		displayOptions: {
			show: {
				resource: ['custom'],
				operation: ['customRequest'],
			},
		},
		default: '{}',
		description: 'JSON body (for GET/HEAD it is merged into query)',
	},
	{
		displayName: 'Headers (JSON)',
		name: 'headersJson',
		type: 'json',
		displayOptions: {
			show: {
				resource: ['custom'],
				operation: ['customRequest'],
			},
		},
		default: '{}',
		description: 'Additional headers as JSON object',
	},
	{
		displayName: 'Response Type',
		name: 'responseType',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['custom'],
				operation: ['customRequest'],
			},
		},
		options: [
			{ name: 'JSON', value: 'json' },
			{ name: 'Text', value: 'text' },
		],
		default: 'json',
	},
	{
		displayName: 'Include Response Metadata',
		name: 'includeMetadata',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['custom'],
				operation: ['customRequest'],
			},
		},
		default: false,
		description: 'Include status code and headers in the output',
	},
	{
		displayName: 'Request Definition (JSON)',
		name: 'requestJson',
		type: 'json',
		displayOptions: {
			show: {
				resource: ['custom'],
				operation: ['jsonDefinition'],
			},
		},
		default: '{}',
		description: 'Fields: method, endpoint, query, body, headers, responseType, includeMetadata. You can also pass an array.',
	},
];
