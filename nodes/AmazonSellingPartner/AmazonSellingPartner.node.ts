import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';

import {
	generatedResourceOptions,
	generatedOperations,
	generatedFields,
} from './generated/Generated.description';
import { executeGeneratedOperation } from './operations/Generated.operations';
import { customOperations, customFields } from './descriptions/Custom.description';
import { executeCustomOperation } from './operations/Custom.operations';

export class AmazonSellingPartner implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Amazon Selling Partner',
		name: 'amazonSellingPartner',
		icon: 'file:amazonSpApi.svg',
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Amazon Selling Partner API',
		defaults: {
			name: 'Amazon Selling Partner',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'amazonSpApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: '={{$credentials.spApiEndpoint || $self["getSpApiEndpoint"]($credentials.awsRegion, $credentials.environment)}}',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
				'User-Agent': 'n8n-amazon-sp-api/1.0.0',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Custom',
						value: 'custom',
						description: 'Make a custom SP-API request',
					},
					...generatedResourceOptions,
				],
				default: 'custom',
			},
			...generatedOperations,
			...generatedFields,
			...customOperations,
			...customFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		try {
			for (let i = 0; i < items.length; i++) {
				switch (resource) {
					case 'custom': {
						const customResults = await executeCustomOperation.call(this, operation, i);
						returnData.push(...customResults);
						break;
					}
					default: {
						const generatedResults = await executeGeneratedOperation.call(
							this,
							resource,
							operation,
							i,
						);
						returnData.push(...generatedResults);
						break;
					}
				}
			}

			return [this.helpers.returnJsonArray(returnData)];
		} catch (error) {
			if (error instanceof NodeOperationError) {
				throw error;
			}
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			throw new NodeOperationError(this.getNode(), `Amazon SP-API error: ${errorMessage}`);
		}
	}


} 
