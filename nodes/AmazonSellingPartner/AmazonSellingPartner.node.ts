import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class AmazonSellingPartner implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Amazon Selling Partner',
		name: 'amazonSellingPartner',
		icon: { light: 'file:../../icons/amazon-sp.svg', dark: 'file:../../icons/amazon-sp.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Base node for Amazon Selling Partner API',
		defaults: {
			name: 'Amazon Selling Partner',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'amazonSellingPartnerApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Pass Through',
						value: 'passThrough',
						description: 'Return input items unchanged',
					},
				],
				default: 'passThrough',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const outputItems: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				await this.getCredentials('amazonSellingPartnerOAuth2Api');
				outputItems.push({
					json: { ...items[itemIndex].json },
					pairedItem: itemIndex,
				});
			} catch (error) {
				if (this.continueOnFail()) {
					outputItems.push({
						json: items[itemIndex].json,
						error,
						pairedItem: itemIndex,
					});
				} else {
					throw new NodeOperationError(this.getNode(), error as Error, {
						itemIndex,
					});
				}
			}
		}

		return [outputItems];
	}
}
