import { INodeProperties } from 'n8n-workflow';

export const ordersOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['orders'],
			},
		},
		options: [
			{
				name: 'Get Orders',
				value: 'getOrders',
				description: 'Retrieve orders within a specified date range',
				action: 'Get orders',
			},
			{
				name: 'Get Order Details',
				value: 'getOrder',
				description: 'Retrieve details for a specific order by Order ID',
				action: 'Get order details',
			},
			{
				name: 'Get Order Items',
				value: 'getOrderItems',
				description: 'Retrieve line items for a specific order by Order ID',
				action: 'Get order items',
			},
		],
		default: 'getOrders',
	},
];

export const ordersFields: INodeProperties[] = [
	// Get Orders operation fields
	{
		displayName: 'Marketplace IDs',
		name: 'marketplaceIds',
		type: 'multiOptions',
		required: true,
		displayOptions: {
			show: {
				resource: ['orders'],
				operation: ['getOrders'],
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
		description: 'Select the marketplaces to retrieve orders from',
	},
	{
		displayName: 'Created After',
		name: 'createdAfter',
		type: 'dateTime',
		required: true,
		displayOptions: {
			show: {
				resource: ['orders'],
				operation: ['getOrders'],
			},
		},
		default: '',
		description: 'Orders created after this date and time (ISO 8601 format)',
	},
	{
		displayName: 'Created Before',
		name: 'createdBefore',
		type: 'dateTime',
		required: true,
		displayOptions: {
			show: {
				resource: ['orders'],
				operation: ['getOrders'],
			},
		},
		default: '',
		description: 'Orders created before this date and time (ISO 8601 format)',
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		displayOptions: {
			show: {
				resource: ['orders'],
				operation: ['getOrders'],
			},
		},
		default: {},
		options: [
			{
				displayName: 'Order Statuses',
				name: 'orderStatuses',
				type: 'multiOptions',
				options: [
					{ name: 'Pending', value: 'Pending' },
					{ name: 'Unshipped', value: 'Unshipped' },
					{ name: 'Partially Shipped', value: 'PartiallyShipped' },
					{ name: 'Shipped', value: 'Shipped' },
					{ name: 'Canceled', value: 'Canceled' },
					{ name: 'Unfulfillable', value: 'Unfulfillable' },
					{ name: 'Invoice Unconfirmed', value: 'InvoiceUnconfirmed' },
					{ name: 'Pending Availability', value: 'PendingAvailability' },
				],
				default: [],
				description: 'Filter orders by status',
			},
			{
				displayName: 'Fulfillment Channels',
				name: 'fulfillmentChannels',
				type: 'multiOptions',
				options: [
					{ name: 'Amazon Fulfillment (AFN)', value: 'AFN' },
					{ name: 'Merchant Fulfillment (MFN)', value: 'MFN' },
				],
				default: [],
				description: 'Filter orders by fulfillment channel',
			},
			{
				displayName: 'Payment Methods',
				name: 'paymentMethods',
				type: 'multiOptions',
				options: [
					{ name: 'COD (Cash on Delivery)', value: 'COD' },
					{ name: 'CVS (Convenience Store)', value: 'CVS' },
					{ name: 'Other', value: 'Other' },
				],
				default: [],
				description: 'Filter orders by payment method',
			},
			{
				displayName: 'Max Results Per Page',
				name: 'maxResultsPerPage',
				type: 'number',
				typeOptions: {
					minValue: 1,
					maxValue: 100,
				},
				default: 100,
				description: 'Maximum number of orders to return per page (1-100)',
			},
			{
				displayName: 'Return All Results',
				name: 'returnAll',
				type: 'boolean',
				default: true,
				description: 'Whether to return all results or only up to a given limit',
			},
		],
	},
	// Get Order Details operation fields
	{
		displayName: 'Order ID',
		name: 'orderId',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['orders'],
				operation: ['getOrder', 'getOrderItems'],
			},
		},
		default: '',
		description: 'The Amazon-defined order identifier (3-7-7 format)',
	},
	// Get Order Items operation fields
	{
		displayName: 'Return All Items',
		name: 'returnAll',
		type: 'boolean',
		default: true,
		displayOptions: {
			show: {
				resource: ['orders'],
				operation: ['getOrderItems'],
			},
		},
		description: 'Whether to return all results or only up to a given limit',
	},
]; 