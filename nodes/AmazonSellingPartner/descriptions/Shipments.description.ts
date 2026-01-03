import { INodeProperties } from 'n8n-workflow';

export const shipmentsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['shipments'],
			},
		},
		options: [
			{
				name: 'Confirm Shipment',
				value: 'confirmShipment',
				description: 'Send carrier & tracking info to Amazon',
				action: 'Confirm shipment',
			},
			{
				name: 'Update Shipment Status',
				value: 'updateShipmentStatus',
				description: 'Update the status of a shipment',
				action: 'Update shipment status',
			},
		],
		default: 'confirmShipment',
	},
];

export const shipmentsFields: INodeProperties[] = [
	/* -------------------------------------------------------------------------- */
	/*                                confirmShipment                             */
	/* -------------------------------------------------------------------------- */
	{
		displayName: 'Order ID',
		name: 'orderId',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['shipments'],
				operation: ['confirmShipment', 'updateShipmentStatus'],
			},
		},
		default: '',
		description: 'The Amazon-defined order identifier (3-7-7 format)',
	},
	{
		displayName: 'Marketplace ID',
		name: 'marketplaceId',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['shipments'],
				operation: ['confirmShipment', 'updateShipmentStatus'],
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
		default: 'ATVPDKIKX0DER',
		description: 'The marketplace to for the shipment operation',
	},
	{
		displayName: 'Carrier Code',
		name: 'carrierCode',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['shipments'],
				operation: ['confirmShipment'],
			},
		},
		default: 'UPS',
		description: 'The carrier code for the shipment (e.g., UPS, FedEx, USPS)',
	},
	{
		displayName: 'Tracking Number',
		name: 'trackingNumber',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['shipments'],
				operation: ['confirmShipment'],
			},
		},
		default: '',
		description: 'The tracking number for the shipment',
	},
	{
		displayName: 'Ship Date',
		name: 'shipDate',
		type: 'dateTime',
		displayOptions: {
			show: {
				resource: ['shipments'],
				operation: ['confirmShipment'],
			},
		},
		default: '',
		description: 'The date and time of the shipment (ISO 8601 format). Defaults to now.',
	},
	{
		displayName: 'Items',
		name: 'itemsUi',
		type: 'fixedCollection',
		placeholder: 'Add Item',
		displayOptions: {
			show: {
				resource: ['shipments'],
				operation: ['confirmShipment'],
			},
		},
		default: {
			orderItems: [{ orderItemId: '', quantity: 1 }],
		},
		options: [
			{
				displayName: 'Order Items',
				name: 'orderItems',
				values: [
					{
						displayName: 'Order Item ID',
						name: 'orderItemId',
						type: 'string',
						required: true,
						default: '',
					},
					{
						displayName: 'Quantity',
						name: 'quantity',
						type: 'number',
						required: true,
						default: 1,
						typeOptions: { minValue: 1 },
					},
				],
			},
		],
	},
	/* -------------------------------------------------------------------------- */
	/*                             updateShipmentStatus                           */
	/* -------------------------------------------------------------------------- */
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['shipments'],
				operation: ['updateShipmentStatus'],
			},
		},
		options: [
			{ name: 'Ready For Pickup', value: 'ReadyForPickup' },
			{ name: 'Picked Up', value: 'PickedUp' },
			{ name: 'At Destination', value: 'AtDestination' },
			{ name: 'Delivered', value: 'Delivered' },
		],
		default: 'ReadyForPickup',
		description: 'The status of the shipment',
	},
]; 