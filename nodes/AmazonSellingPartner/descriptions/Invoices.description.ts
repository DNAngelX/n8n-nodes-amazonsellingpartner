import { INodeProperties } from 'n8n-workflow';

export const invoicesOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['invoices'],
			},
		},
		options: [
			{
				name: 'Get GST Report',
				value: 'getGstReport',
				description: 'Download GST tax reports for Indian marketplace',
				action: 'Get GST report',
			},
			{
				name: 'Get VAT Invoice Report',
				value: 'getVatInvoiceReport',
				description: 'Download VAT Invoice Data Report (VIDR) for EU/UK marketplaces',
				action: 'Get VAT invoice report',
			},
			{
				name: 'Get VAT Invoice PDF Links',
				value: 'getVatInvoicePdfLinks',
				description: 'Get PDF download links from VAT calculation report',
				action: 'Get VAT invoice PDF links',
			},
		],
		default: 'getGstReport',
	},
];

export const invoicesFields: INodeProperties[] = [
	// GST Report operation fields
	{
		displayName: 'Report Type',
		name: 'reportType',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['invoices'],
				operation: ['getGstReport'],
			},
		},
		options: [
			{
				name: 'GST B2B Report',
				value: 'GST_MTR_B2B',
				description: 'Business-to-business GST tax report (scheduled only)',
			},
			{
				name: 'GST B2C Report',
				value: 'GST_MTR_B2C',
				description: 'Business-to-consumer GST tax report (scheduled only)',
			},
			{
				name: 'GST B2B Custom Report',
				value: 'GET_GST_MTR_B2B_CUSTOM',
				description: 'On-demand B2B GST tax report with date range',
			},
			{
				name: 'GST B2C Custom Report',
				value: 'GET_GST_MTR_B2C_CUSTOM',
				description: 'On-demand B2C GST tax report with date range',
			},
			{
				name: 'GST Stock Transfer Report',
				value: 'GST_MTR_STOCK_TRANSFER_REPORT',
				description: 'GST stock transfer report for inventory movements',
			},
			{
				name: 'On Demand Stock Transfer Report',
				value: 'GET_GST_STR_ADHOC',
				description: 'On-demand stock transfer report with date range',
			},
		],
		default: 'GET_GST_MTR_B2B_CUSTOM',
		description: 'Type of GST report to download',
	},
	{
		displayName: 'Marketplace ID',
		name: 'marketplaceId',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['invoices'],
				operation: ['getGstReport'],
			},
		},
		options: [
			{ name: 'Amazon.in (India)', value: 'A21TJRUUN4KGV' },
		],
		default: 'A21TJRUUN4KGV',
		description: 'Marketplace for the GST report',
	},
	
	// VAT Invoice Report operation fields
	{
		displayName: 'Report Type',
		name: 'reportType',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['invoices'],
				operation: ['getVatInvoiceReport'],
			},
		},
		options: [
			{
				name: 'Flat File VAT Invoice Data Report',
				value: 'GET_FLAT_FILE_VAT_INVOICE_DATA_REPORT',
				description: 'Tab-delimited flat file VAT invoice data',
			},
			{
				name: 'XML VAT Invoice Data Report',
				value: 'GET_XML_VAT_INVOICE_DATA_REPORT',
				description: 'XML format VAT invoice data',
			},
		],
		default: 'GET_FLAT_FILE_VAT_INVOICE_DATA_REPORT',
		description: 'Type of VAT invoice report to download',
	},
	{
		displayName: 'Marketplace ID',
		name: 'marketplaceId',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['invoices'],
				operation: ['getVatInvoiceReport'],
			},
		},
		options: [
			{ name: 'Amazon.co.uk (UK)', value: 'A1F83G8C2ARO7P' },
			{ name: 'Amazon.de (Germany)', value: 'A1PA6795UKMFR9' },
			{ name: 'Amazon.fr (France)', value: 'A13V1IB3VIYZZH' },
			{ name: 'Amazon.it (Italy)', value: 'APJ6JRA9NG5V4' },
			{ name: 'Amazon.es (Spain)', value: 'A1RKKUPIHCS9HS' },
			{ name: 'Amazon.nl (Netherlands)', value: 'A1805IZSGTT6HS' },
			{ name: 'Amazon.se (Sweden)', value: 'A2NODRKZP88ZB9' },
			{ name: 'Amazon.pl (Poland)', value: 'A1C3SOZRARQ6R3' },
		],
		default: 'A1F83G8C2ARO7P',
		description: 'EU/UK marketplace for the VAT report',
	},
	
	// VAT PDF Links operation fields
	{
		displayName: 'Marketplace ID',
		name: 'marketplaceId',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['invoices'],
				operation: ['getVatInvoicePdfLinks'],
			},
		},
		options: [
			{ name: 'Amazon.co.uk (UK)', value: 'A1F83G8C2ARO7P' },
			{ name: 'Amazon.de (Germany)', value: 'A1PA6795UKMFR9' },
			{ name: 'Amazon.fr (France)', value: 'A13V1IB3VIYZZH' },
			{ name: 'Amazon.it (Italy)', value: 'APJ6JRA9NG5V4' },
			{ name: 'Amazon.es (Spain)', value: 'A1RKKUPIHCS9HS' },
			{ name: 'Amazon.nl (Netherlands)', value: 'A1805IZSGTT6HS' },
			{ name: 'Amazon.se (Sweden)', value: 'A2NODRKZP88ZB9' },
			{ name: 'Amazon.pl (Poland)', value: 'A1C3SOZRARQ6R3' },
		],
		default: 'A1F83G8C2ARO7P',
		description: 'EU/UK marketplace for the VAT calculation report',
	},
	
	// Common date fields for custom reports
	{
		displayName: 'Start Date',
		name: 'startDate',
		type: 'dateTime',
		displayOptions: {
			show: {
				resource: ['invoices'],
				operation: ['getGstReport', 'getVatInvoiceReport'],
				reportType: ['GET_GST_MTR_B2B_CUSTOM', 'GET_GST_MTR_B2C_CUSTOM', 'GET_GST_STR_ADHOC', 'GET_FLAT_FILE_VAT_INVOICE_DATA_REPORT', 'GET_XML_VAT_INVOICE_DATA_REPORT'],
			},
		},
		default: '',
		description: 'Start date for the report data (ISO 8601 format)',
	},
	{
		displayName: 'End Date',
		name: 'endDate',
		type: 'dateTime',
		displayOptions: {
			show: {
				resource: ['invoices'],
				operation: ['getGstReport', 'getVatInvoiceReport'],
				reportType: ['GET_GST_MTR_B2B_CUSTOM', 'GET_GST_MTR_B2C_CUSTOM', 'GET_GST_STR_ADHOC', 'GET_FLAT_FILE_VAT_INVOICE_DATA_REPORT', 'GET_XML_VAT_INVOICE_DATA_REPORT'],
			},
		},
		default: '',
		description: 'End date for the report data (ISO 8601 format)',
	},
	
	// VAT Invoice Report options
	{
		displayName: 'Report Options',
		name: 'reportOptions',
		type: 'collection',
		placeholder: 'Add Option',
		displayOptions: {
			show: {
				resource: ['invoices'],
				operation: ['getVatInvoiceReport'],
			},
		},
		default: {},
		options: [
			{
				displayName: 'Pending Invoices Only',
				name: 'pendingInvoices',
				type: 'boolean',
				default: true,
				description: 'Whether to include only shipments with pending invoices',
			},
			{
				displayName: 'Include All Statuses',
				name: 'all',
				type: 'boolean',
				default: false,
				description: 'Whether to include shipments with all invoice statuses (requires date range)',
			},
		],
	},
	
	// Output options
	{
		displayName: 'Output Options',
		name: 'outputOptions',
		type: 'collection',
		placeholder: 'Add Option',
		displayOptions: {
			show: {
				resource: ['invoices'],
				operation: ['getGstReport', 'getVatInvoiceReport'],
			},
		},
		default: {},
		options: [
			{
				displayName: 'Return Binary File',
				name: 'returnBinary',
				type: 'boolean',
				default: true,
				description: 'Whether to return the raw file as binary data',
			},
			{
				displayName: 'Parse CSV to JSON',
				name: 'parseToJson',
				type: 'boolean',
				default: false,
				description: 'Whether to parse CSV/TSV content to JSON array (only for flat file reports)',
			},
			{
				displayName: 'Binary Property Name',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				description: 'Name of the binary property to store the file',
				displayOptions: {
					show: {
						returnBinary: [true],
					},
				},
			},
		],
	},
	
	// Polling options
	{
		displayName: 'Advanced Options',
		name: 'advancedOptions',
		type: 'collection',
		placeholder: 'Add Option',
		displayOptions: {
			show: {
				resource: ['invoices'],
				operation: ['getGstReport', 'getVatInvoiceReport'],
			},
		},
		default: {},
		options: [
			{
				displayName: 'Max Poll Time (Minutes)',
				name: 'maxPollTimeMinutes',
				type: 'number',
				default: 10,
				description: 'Maximum time to wait for report generation (1-30 minutes)',
				typeOptions: {
					minValue: 1,
					maxValue: 30,
				},
			},
			{
				displayName: 'Poll Interval (Seconds)',
				name: 'pollIntervalSeconds',
				type: 'number',
				default: 30,
				description: 'How often to check report status (10-300 seconds)',
				typeOptions: {
					minValue: 10,
					maxValue: 300,
				},
			},
		],
	},
]; 