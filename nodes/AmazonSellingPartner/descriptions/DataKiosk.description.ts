import { INodeProperties } from 'n8n-workflow';

export const dataKioskOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['dataKiosk'],
			},
		},
		options: [
			{ name: 'Create Query', value: 'createQuery', action: 'Create query' },
			{ name: 'Get Queries', value: 'getQueries', action: 'Get queries' },
			{ name: 'Get Query', value: 'getQuery', action: 'Get query' },
			{ name: 'Cancel Query', value: 'cancelQuery', action: 'Cancel query' },
			{ name: 'Get Document', value: 'getDocument', action: 'Get document' },
			{ name: 'Run Query and Download', value: 'runQueryAndDownload', action: 'Run query and download' },
		],
		default: 'createQuery',
	},
];

export const dataKioskFields: INodeProperties[] = [
	// Create Query
	{
		displayName: 'Query',
		name: 'query',
		type: 'string',
		required: true,
		displayOptions: { show: { resource: ['dataKiosk'], operation: ['createQuery','runQueryAndDownload'] } },
		default: `query {
  analytics_salesAndTraffic_2024_04_24 {
    salesAndTrafficTrends(
      asinAggregation: CHILD
      dateAggregation: DAY
      startDate: "2024-01-01"
      endDate: "2024-01-07"
      filters: { asins: [], marketplaceId: "ATVPDKIKX0DER" }
    ) {
      traffic {
        pageViews
        sessions
        unitSessionPercentage
      }
      sales {
        totalOrderItems
        orderedProductSales { amount currencyCode }
        unitsOrdered
      }
      marketplaceId
      startDate
      endDate
    }
  }
}`,
		description: 'GraphQL query using versioned schema (e.g., analytics_salesAndTraffic_2024_04_24). See <a href="https://sellercentral.amazon.com/datakiosk-schema-explorer" target="_blank">Schema Explorer</a> for available schemas and fields. Max 8000 chars after minification.',
		typeOptions: { rows: 10 },
	},
	{
		displayName: 'Minify GraphQL',
		name: 'minifyGraphql',
		type: 'boolean',
		displayOptions: { show: { resource: ['dataKiosk'], operation: ['createQuery','runQueryAndDownload'] } },
		default: true,
		description: 'Remove comments and unnecessary whitespace before sending',
	},
	{
		displayName: 'Pagination Token',
		name: 'paginationToken',
		type: 'string',
		typeOptions: { password: true },
		displayOptions: { show: { resource: ['dataKiosk'], operation: ['createQuery'] } },
		default: '',
		description: 'Token to fetch a specific page from a previous query',
	},

	// Get Queries
	{
		displayName: 'Processing Statuses',
		name: 'processingStatuses',
		type: 'multiOptions',
		displayOptions: { show: { resource: ['dataKiosk'], operation: ['getQueries'] } },
		options: [
			{ name: 'CANCELLED', value: 'CANCELLED' },
			{ name: 'DONE', value: 'DONE' },
			{ name: 'FATAL', value: 'FATAL' },
			{ name: 'IN_PROGRESS', value: 'IN_PROGRESS' },
			{ name: 'IN_QUEUE', value: 'IN_QUEUE' },
		],
		default: [],
		description: 'Filter queries by status',
	},
	{
		displayName: 'Page Size',
		name: 'pageSize',
		type: 'number',
		displayOptions: { show: { resource: ['dataKiosk'], operation: ['getQueries'] } },
		typeOptions: { minValue: 1, maxValue: 100 },
		default: 10,
		description: 'Max number of queries to return',
	},
	{
		displayName: 'Created Since',
		name: 'createdSince',
		type: 'dateTime',
		displayOptions: { show: { resource: ['dataKiosk'], operation: ['getQueries'] } },
		default: '',
		description: 'Earliest creation time to include',
	},
	{
		displayName: 'Created Until',
		name: 'createdUntil',
		type: 'dateTime',
		displayOptions: { show: { resource: ['dataKiosk'], operation: ['getQueries'] } },
		default: '',
		description: 'Latest creation time to include',
	},
	{
		displayName: 'Pagination Token',
		name: 'paginationToken',
		type: 'string',
		typeOptions: { password: true },
		displayOptions: { show: { resource: ['dataKiosk'], operation: ['getQueries'] } },
		default: '',
		description: 'Token to fetch a specific page of results',
	},

	// Get Query
	{
		displayName: 'Query ID',
		name: 'queryId',
		type: 'string',
		required: true,
		displayOptions: { show: { resource: ['dataKiosk'], operation: ['getQuery','cancelQuery'] } },
		default: '',
		description: 'Identifier for the query',
	},

	// Get Document
	{
		displayName: 'Document ID',
		name: 'documentId',
		type: 'string',
		required: true,
		displayOptions: { show: { resource: ['dataKiosk'], operation: ['getDocument'] } },
		default: '',
		description: 'Identifier for the Data Kiosk document',
	},
	{
		displayName: 'Output',
		name: 'output',
		type: 'options',
		displayOptions: { show: { resource: ['dataKiosk'], operation: ['getDocument','runQueryAndDownload'] } },
		options: [
			{ name: 'Binary', value: 'binary' },
			{ name: 'Text', value: 'text' },
		],
		default: 'binary',
		description: 'How to return the downloaded document',
	},
	{
		displayName: 'Binary Property',
		name: 'binaryPropertyName',
		type: 'string',
		displayOptions: { show: { resource: ['dataKiosk'], operation: ['getDocument','runQueryAndDownload'], '/output': ['binary'] } },
		default: 'dataKioskFile',
		description: 'Binary property name to store the file',
	},

	// Run Query & Download options
	{
		displayName: 'Poll Interval (Ms)',
		name: 'pollIntervalMs',
		type: 'number',
		displayOptions: { show: { resource: ['dataKiosk'], operation: ['runQueryAndDownload'] } },
		typeOptions: { minValue: 500, maxValue: 60000 },
		default: 2000,
		description: 'How often to poll the query status',
	},
	{
		displayName: 'Timeout (Ms)',
		name: 'timeoutMs',
		type: 'number',
		displayOptions: { show: { resource: ['dataKiosk'], operation: ['runQueryAndDownload'] } },
		typeOptions: { minValue: 10000, maxValue: 900000 },
		default: 300000,
		description: 'Maximum time to wait for the query to complete',
	},
	{
		displayName: 'Multi-Page Handling',
		name: 'multiPageHandling',
		type: 'options',
		displayOptions: { show: { resource: ['dataKiosk'], operation: ['runQueryAndDownload'] } },
		options: [
			{ name: 'Keep Pages Separate', value: 'keepPagesSeparate' },
			{ name: 'Stop After First Page', value: 'stopAfterFirst' },
		],
		default: 'keepPagesSeparate',
		description: 'How to handle paginated results',
	},
];


