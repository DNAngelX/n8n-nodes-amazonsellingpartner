import { INodeProperties } from 'n8n-workflow';

export const reportsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['reports'],
			},
		},
		options: [
			{
				name: 'Sales & Traffic by ASIN',
				value: 'salesTrafficByAsin',
				description: 'Download Sales & Traffic business report by ASIN/SKU',
				action: 'Get sales & traffic by ASIN',
			},
			{
				name: 'Returns by ASIN (FBA)',
				value: 'returnsByAsinFba',
				description: 'Download FBA customer returns report grouped by ASIN/SKU',
				action: 'Get FBA returns by ASIN',
			},
			{
				name: 'Returns by ASIN (MFN)',
				value: 'returnsByAsinMfn',
				description: 'Download MFN returns report grouped by ASIN/SKU',
				action: 'Get MFN returns by ASIN',
			},
			{
				name: 'Consolidated Sales & Returns',
				value: 'consolidatedSalesAndReturnsByAsin',
				description: 'Fetch sales and returns in parallel and emit side-by-side metrics',
				action: 'Get consolidated sales & returns by ASIN',
			},
			{
				name: 'Refunds by ASIN',
				value: 'refundsByAsin',
				description: 'Retrieve refund and charge adjustment totals by ASIN from Finances',
				action: 'Get refunds by ASIN',
			},
		],
		default: 'salesTrafficByAsin',
	},
];

export const reportsFields: INodeProperties[] = [
	// Common date range
	{
		displayName: 'Start Date',
		name: 'dateFrom',
		type: 'dateTime',
		required: true,
		displayOptions: {
			show: {
				resource: ['reports'],
				operation: [
					'salesTrafficByAsin',
					'returnsByAsinFba',
					'returnsByAsinMfn',
					'consolidatedSalesAndReturnsByAsin',
					'refundsByAsin',
				],
			},
		},
		default: '',
		description: 'Start of the reporting window (inclusive). Amazon expects ISO-8601 with timezone.',
	},
	{
		displayName: 'End Date',
		name: 'dateTo',
		type: 'dateTime',
		required: true,
		displayOptions: {
			show: {
				resource: ['reports'],
				operation: [
					'salesTrafficByAsin',
					'returnsByAsinFba',
					'returnsByAsinMfn',
					'consolidatedSalesAndReturnsByAsin',
					'refundsByAsin',
				],
			},
		},
		default: '',
		description: 'End of the reporting window (inclusive). Amazon expects ISO-8601 with timezone.',
	},
	{
		displayName: 'Granularity',
		name: 'granularity',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['reports'],
				operation: [
					'salesTrafficByAsin',
					'returnsByAsinFba',
					'returnsByAsinMfn',
					'consolidatedSalesAndReturnsByAsin',
					'refundsByAsin',
				],
			},
		},
		options: [
			{ name: 'Daily', value: 'DAY' },
			{ name: 'Weekly', value: 'WEEK' },
			{ name: 'Monthly', value: 'MONTH' },
		],
		default: 'DAY',
		description: 'Aggregation level for returned metrics. Must align with Amazon report configuration.',
	},
	{
		displayName: 'Marketplace IDs',
		name: 'marketplaceIds',
		type: 'multiOptions',
		required: true,
		displayOptions: {
			show: {
				resource: ['reports'],
				operation: [
					'salesTrafficByAsin',
					'returnsByAsinFba',
					'returnsByAsinMfn',
					'consolidatedSalesAndReturnsByAsin',
					'refundsByAsin',
				],
			},
		},
		options: [
			// North America
			{ name: 'Amazon.com (US)', value: 'ATVPDKIKX0DER' },
			{ name: 'Amazon.ca (Canada)', value: 'A2EUQ1WTGCTBG2' },
			{ name: 'Amazon.com.mx (Mexico)', value: 'A1AM78C64UM0Y8' },
			{ name: 'Amazon.com.br (Brazil)', value: 'A2Q3Y263D00KWC' },
			// Europe
			{ name: 'Amazon.co.uk (UK)', value: 'A1F83G8C2ARO7P' },
			{ name: 'Amazon.de (Germany)', value: 'A1PA6795UKMFR9' },
			{ name: 'Amazon.fr (France)', value: 'A13V1IB3VIYZZH' },
			{ name: 'Amazon.it (Italy)', value: 'APJ6JRA9NG5V4' },
			{ name: 'Amazon.es (Spain)', value: 'A1RKKUPIHCS9HS' },
			{ name: 'Amazon.nl (Netherlands)', value: 'A1805IZSGTT6HS' },
			{ name: 'Amazon.se (Sweden)', value: 'A2NODRKZP88ZB9' },
			{ name: 'Amazon.pl (Poland)', value: 'A1C3SOZRARQ6R3' },
			// Asia Pacific
			{ name: 'Amazon.co.jp (Japan)', value: 'A1VC38T7YXB528' },
			{ name: 'Amazon.com.au (Australia)', value: 'A39IBJ37TRP1C6' },
			{ name: 'Amazon.sg (Singapore)', value: 'A19VAU5U5O7RUS' },
			{ name: 'Amazon.ae (UAE)', value: 'A2VIGQ35RCS4UG' },
			{ name: 'Amazon.sa (Saudi Arabia)', value: 'A17E79C6D8DWNP' },
			{ name: 'Amazon.in (India)', value: 'A21TJRUUN4KGV' },
		],
		default: ['ATVPDKIKX0DER'],
		description: 'Select marketplaces included in the report request',
	},
	// Sales & Traffic specific
	{
		displayName: 'Aggregation Level',
		name: 'aggregationLevel',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['reports'],
				operation: ['salesTrafficByAsin'],
			},
		},
		options: [
			{ name: 'ASIN (Child)', value: 'CHILD' },
			{ name: 'ASIN (Parent)', value: 'PARENT' },
			{ name: 'Seller SKU', value: 'SKU' },
		],
		default: 'CHILD',
		description: 'Aggregation level for the Sales & Traffic report',
	},
	{
		displayName: 'Include Sessions Metrics',
		name: 'includeSessions',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['reports'],
				operation: ['salesTrafficByAsin'],
			},
		},
		default: true,
		description: 'Include traffic metrics (sessions/page views). Disabling reduces report size.',
	},
	// Consolidated options
	{
		displayName: 'Include Refunds',
		name: 'includeRefunds',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['reports'],
				operation: ['consolidatedSalesAndReturnsByAsin'],
			},
		},
		default: false,
		description: 'If true, also fetch refunds via Finances API. Adds latency due to additional calls.',
	},
	{
		displayName: 'Emit Raw Subdatasets',
		name: 'emitRawSubdatasets',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['reports'],
				operation: ['consolidatedSalesAndReturnsByAsin'],
			},
		},
		default: false,
		description: 'Also output individual Sales/Returns datasets as separate items in addition to consolidated rows',
	},
	// Refund options
	{
		displayName: 'Normalize Currency',
		name: 'normalizeCurrency',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['reports'],
				operation: ['refundsByAsin'],
			},
		},
		default: false,
		description: 'If true, convert refund amounts into the first selected marketplace currency',
	},
	// Advanced
	{
		displayName: 'Advanced Options',
		name: 'advancedOptions',
		type: 'collection',
		displayOptions: {
			show: {
				resource: ['reports'],
				operation: [
					'salesTrafficByAsin',
					'returnsByAsinFba',
					'returnsByAsinMfn',
					'consolidatedSalesAndReturnsByAsin',
					'refundsByAsin',
				],
			},
		},
		default: {},
		options: [
			{
				displayName: 'Max Poll Time (Minutes)',
				name: 'maxPollTimeMinutes',
				type: 'number',
				typeOptions: {
					minValue: 1,
					maxValue: 30,
				},
				default: 10,
				description: 'Maximum time to wait for report generation before failing',
			},
			{
				displayName: 'Poll Interval (Seconds)',
				name: 'pollIntervalSeconds',
				type: 'number',
				typeOptions: {
					minValue: 10,
					maxValue: 240,
				},
				default: 30,
				description: 'How often to check report generation status',
			},
			{
				displayName: 'Return Raw Document',
				name: 'returnRawDocument',
				type: 'boolean',
				default: false,
				description: 'If true, output the raw report document alongside parsed data',
			},
			{
				displayName: 'Binary Property Name',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				description: 'Binary property name when returning raw documents',
				displayOptions: {
					show: {
						returnRawDocument: [true],
					},
				},
			},
		],
	},
];

