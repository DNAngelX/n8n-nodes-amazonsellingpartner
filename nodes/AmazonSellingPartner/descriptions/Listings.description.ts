import { INodeProperties } from 'n8n-workflow';

export const listingsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['listings'],
			},
		},
		options: [
			{
				name: 'List ASINs',
				value: 'listAsins',
				description: 'List all ASINs published in specified marketplaces',
				action: 'List asi ns',
			},
			{
				name: 'Get Listing Details',
				value: 'getListingDetails',
				description: 'Get detailed information for a specific ASIN/SKU',
				action: 'Get listing details',
			},
		],
		default: 'listAsins',
	},
];

export const listingsFields: INodeProperties[] = [
	// List ASINs operation fields
	{
		displayName: 'Marketplace IDs',
		name: 'marketplaceIds',
		type: 'multiOptions',
		required: true,
		displayOptions: {
			show: {
				resource: ['listings'],
				operation: ['listAsins'],
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
		description: 'Select the marketplaces to retrieve listings from',
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		displayOptions: {
			show: {
				resource: ['listings'],
				operation: ['listAsins'],
			},
		},
		default: {},
		options: [
			{
				displayName: 'Included Data',
				name: 'includedData',
				type: 'multiOptions',
				options: [
					{ name: 'Summaries', value: 'summaries', description: 'Basic listing information' },
					{ name: 'Attributes', value: 'attributes', description: 'Detailed product attributes' },
					{ name: 'Issues', value: 'issues', description: 'Listing issues and warnings' },
					{ name: 'Offers', value: 'offers', description: 'Offer information including price' },
					{ name: 'Fulfillment Availability', value: 'fulfillmentAvailability', description: 'Stock and fulfillment details' },
					{ name: 'Procurement', value: 'procurement', description: 'Procurement information' },
				],
				default: ['summaries', 'attributes', 'offers'],
				description: 'Types of data to include in the response',
			},
			{
				displayName: 'Page Size',
				name: 'pageSize',
				type: 'number',
				typeOptions: {
					minValue: 1,
					maxValue: 20,
				},
				default: 20,
				description: 'Number of listings to return per page (1-20)',
			},
			{
				displayName: 'Return All Results',
				name: 'returnAll',
				type: 'boolean',
				default: true,
				description: 'Whether to return all results or only up to a given limit',
			},
			{
				displayName: 'Max Results Limit',
				name: 'maxResultsLimit',
				type: 'number',
				typeOptions: {
					minValue: 1,
					maxValue: 10000,
				},
				default: 1000,
				description: 'Maximum total number of results to return (safety limit)',
			},
			{
				displayName: 'SKU Filter',
				name: 'skuFilter',
				type: 'string',
				default: '',
				description: 'Filter listings by SKU pattern (supports wildcards)',
			},
			{
				displayName: 'Status Filter',
				name: 'statusFilter',
				type: 'multiOptions',
				options: [
					{ name: 'Buyable', value: 'BUYABLE' },
					{ name: 'Discoverable', value: 'DISCOVERABLE' },
					{ name: 'Deleted', value: 'DELETED' },
				],
				default: [],
				description: 'Filter listings by status',
			},
			{
				displayName: 'Issue Locale',
				name: 'issueLocale',
				type: 'options',
				options: [
					{ name: 'English (US)', value: 'en_US' },
					{ name: 'English (UK)', value: 'en_GB' },
					{ name: 'German', value: 'de_DE' },
					{ name: 'French', value: 'fr_FR' },
					{ name: 'Italian', value: 'it_IT' },
					{ name: 'Spanish', value: 'es_ES' },
					{ name: 'Japanese', value: 'ja_JP' },
					{ name: 'Chinese (Simplified)', value: 'zh_CN' },
				],
				default: 'en_US',
				description: 'Locale for issue descriptions',
			},
		],
	},
	// Get Listing Details operation fields
	{
		displayName: 'Listing Identifier Type',
		name: 'identifierType',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['listings'],
				operation: ['getListingDetails'],
			},
		},
		options: [
			{ name: 'SKU', value: 'sku', description: 'Search by Seller SKU' },
			{ name: 'ASIN', value: 'asin', description: 'Search by ASIN' },
		],
		default: 'sku',
		description: 'Type of identifier to use for lookup',
	},
	{
		displayName: 'SKU',
		name: 'sku',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['listings'],
				operation: ['getListingDetails'],
				identifierType: ['sku'],
			},
		},
		default: '',
		description: 'The seller SKU of the listing to retrieve',
	},
	{
		displayName: 'ASIN',
		name: 'asin',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['listings'],
				operation: ['getListingDetails'],
				identifierType: ['asin'],
			},
		},
		default: '',
		description: 'The ASIN of the listing to retrieve',
	},
	{
		displayName: 'Marketplace IDs',
		name: 'marketplaceIds',
		type: 'multiOptions',
		required: true,
		displayOptions: {
			show: {
				resource: ['listings'],
				operation: ['getListingDetails'],
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
		description: 'Select the marketplaces to retrieve listing details from',
	},
	{
		displayName: 'Detail Options',
		name: 'detailOptions',
		type: 'collection',
		placeholder: 'Add Option',
		displayOptions: {
			show: {
				resource: ['listings'],
				operation: ['getListingDetails'],
			},
		},
		default: {},
		options: [
			{
				displayName: 'Included Data',
				name: 'includedData',
				type: 'multiOptions',
				options: [
					{ name: 'Summaries', value: 'summaries', description: 'Basic listing information' },
					{ name: 'Attributes', value: 'attributes', description: 'Detailed product attributes' },
					{ name: 'Issues', value: 'issues', description: 'Listing issues and warnings' },
					{ name: 'Offers', value: 'offers', description: 'Offer information including price' },
					{ name: 'Fulfillment Availability', value: 'fulfillmentAvailability', description: 'Stock and fulfillment details' },
					{ name: 'Procurement', value: 'procurement', description: 'Procurement information' },
				],
				default: ['summaries', 'attributes', 'offers', 'issues'],
				description: 'Types of data to include in the response',
			},
			{
				displayName: 'Issue Locale',
				name: 'issueLocale',
				type: 'options',
				options: [
					{ name: 'English (US)', value: 'en_US' },
					{ name: 'English (UK)', value: 'en_GB' },
					{ name: 'German', value: 'de_DE' },
					{ name: 'French', value: 'fr_FR' },
					{ name: 'Italian', value: 'it_IT' },
					{ name: 'Spanish', value: 'es_ES' },
					{ name: 'Japanese', value: 'ja_JP' },
					{ name: 'Chinese (Simplified)', value: 'zh_CN' },
				],
				default: 'en_US',
				description: 'Locale for issue descriptions',
			},
		],
	},
]; 