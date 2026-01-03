import { INodeProperties } from 'n8n-workflow';

export const analyticsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['analytics'],
			},
		},
		options: [
			{
				name: 'Validate Access',
				value: 'validateAccess',
				description: 'Test access to Reports API (Data Kiosk moved to its own resource)',
				action: 'Validate analytics access',
			},
		],
		default: 'validateAccess',
	},
];

export const analyticsFields: INodeProperties[] = [
	// NOTE: All fields removed; Analytics now only supports validateAccess operation
	// Data Kiosk functionality moved to dedicated resource
];
