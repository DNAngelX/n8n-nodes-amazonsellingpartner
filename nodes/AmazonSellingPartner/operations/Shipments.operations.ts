import { IExecuteFunctions, INodeExecutionData, NodeOperationError } from 'n8n-workflow';
import { SpApiRequest } from '../helpers/SpApiRequest';
import { securityValidator } from '../core/SecurityValidator';

export async function executeShipmentsOperation(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	switch (operation) {
		case 'confirmShipment':
			return await confirmShipment.call(this, itemIndex);
		case 'updateShipmentStatus':
			return await updateShipmentStatus.call(this, itemIndex);
		default:
			throw new NodeOperationError(this.getNode(), `Unknown shipments operation: ${operation}`);
	}
}

async function confirmShipment(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const orderId = this.getNodeParameter('orderId', index) as string;
	const marketplaceId = this.getNodeParameter('marketplaceId', index) as string;
	const carrierCode = this.getNodeParameter('carrierCode', index) as string;
	const trackingNumber = this.getNodeParameter('trackingNumber', index) as string;
	const shipDate = this.getNodeParameter('shipDate', index, new Date().toISOString()) as string;
	const items = this.getNodeParameter('itemsUi.orderItems', index) as Array<{
		orderItemId: string;
		quantity: number;
	}>;

	// Validation
	const validationResult = securityValidator.validateMarketplaceIds([marketplaceId], this.getNode().id);
	if (!validationResult.isValid) {
		throw new NodeOperationError(this.getNode(), `Invalid Marketplace ID: ${validationResult.errors[0]}`);
	}
	if (!/^\d{3}-\d{7}-\d{7}$/.test(orderId)) {
		throw new NodeOperationError(this.getNode(), 'Invalid Order ID format. Must be in 3-7-7 format.');
	}

	const body = {
		marketplaceId,
		packageDetail: {
			packageReferenceId: `n8n-${this.getExecutionId()}-${index}`, // Idempotency token
			carrierCode,
			trackingNumber,
			shipDate,
			items: items.map((it) => ({ orderItemId: it.orderItemId, quantity: it.quantity })),
		},
	};

	const response = await SpApiRequest.makeRequest(this, {
		method: 'POST',
		endpoint: `/orders/v0/orders/${orderId}/shipmentConfirmation`,
		body,
	});

	return this.helpers.returnJsonArray({
		orderId,
		marketplaceId,
		payload: response.data,
	});
}

async function updateShipmentStatus(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const orderId = this.getNodeParameter('orderId', index) as string;
	const marketplaceId = this.getNodeParameter('marketplaceId', index) as string;
	const status = this.getNodeParameter('status', index) as string;

	// Validation
	const validationResult = securityValidator.validateMarketplaceIds([marketplaceId], this.getNode().id);
	if (!validationResult.isValid) {
		throw new NodeOperationError(this.getNode(), `Invalid Marketplace ID: ${validationResult.errors[0]}`);
	}
	if (!/^\d{3}-\d{7}-\d{7}$/.test(orderId)) {
		throw new NodeOperationError(this.getNode(), 'Invalid Order ID format. Must be in 3-7-7 format.');
	}

	const body = {
		marketplaceId,
		shipmentStatus: status,
	};

	const response = await SpApiRequest.makeRequest(this, {
		method: 'POST',
		endpoint: `/orders/v0/orders/${orderId}/shipmentStatus`,
		body,
	});

	return this.helpers.returnJsonArray({
		orderId,
		marketplaceId,
		payload: response.data,
	});
} 