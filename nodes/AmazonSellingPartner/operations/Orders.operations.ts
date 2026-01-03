import {
	IExecuteFunctions,
	INodeExecutionData,
	NodeOperationError,
} from 'n8n-workflow';
import { SpApiRequest } from '../helpers/SpApiRequest';
import { securityValidator } from '../core/SecurityValidator';

interface Order {
	AmazonOrderId: string;
	PurchaseDate: string;
	LastUpdateDate: string;
	OrderStatus: string;
	FulfillmentChannel: string;
	SalesChannel: string;
	OrderChannel: string;
	ShipServiceLevel: string;
	OrderTotal: {
		CurrencyCode: string;
		Amount: string;
	};
	NumberOfItemsShipped: number;
	NumberOfItemsUnshipped: number;
	PaymentExecutionDetail: any[];
	PaymentMethod: string;
	PaymentMethodDetails: string[];
	MarketplaceId: string;
	ShipmentServiceLevelCategory: string;
	EasyShipShipmentStatus: string;
	CbaDisplayableShippingLabel: string;
	OrderType: string;
	EarliestShipDate: string;
	LatestShipDate: string;
	EarliestDeliveryDate: string;
	LatestDeliveryDate: string;
	IsBusinessOrder: boolean;
	IsPrime: boolean;
	IsPremiumOrder: boolean;
	IsGlobalExpressEnabled: boolean;
	ReplacedOrderId: string;
	IsReplacementOrder: boolean;
	PromiseResponseDueDate: string;
	IsEstimatedShipDateSet: boolean;
}

interface GetOrdersResponse {
	payload: {
		Orders: Order[];
		NextToken?: string;
		LastUpdatedBefore?: string;
		CreatedBefore?: string;
	};
}

interface GetOrderResponse {
	payload: Order;
}

interface OrderItem {
	ASIN: string;
	OrderItemId: string;
	SellerSKU?: string;
	Title: string;
	QuantityOrdered: number;
	QuantityShipped?: number;
	HsnCode?: string; // HSN (Harmonised System of Nomenclature) code for Indian marketplace
	ProductInfo?: {
		NumberOfItems?: number;
	};
	PointsGranted?: {
		PointsNumber?: number;
		PointsMonetaryValue?: {
			CurrencyCode?: string;
			Amount?: string;
		};
	};
	ItemPrice?: {
		CurrencyCode: string;
		Amount: string;
	};
	ShippingPrice?: {
		CurrencyCode: string;
		Amount: string;
	};
	ItemTax?: {
		CurrencyCode: string;
		Amount: string;
	};
	ShippingTax?: {
		CurrencyCode: string;
		Amount: string;
	};
	ShippingDiscount?: {
		CurrencyCode: string;
		Amount: string;
	};
	ShippingDiscountTax?: {
		CurrencyCode: string;
		Amount: string;
	};
	PromotionDiscount?: {
		CurrencyCode: string;
		Amount: string;
	};
	PromotionDiscountTax?: {
		CurrencyCode: string;
		Amount: string;
	};
	PromotionIds?: string[];
	CODFee?: {
		CurrencyCode: string;
		Amount: string;
	};
	CODFeeDiscount?: {
		CurrencyCode: string;
		Amount: string;
	};
	IsGift?: string; // Amazon returns this as string "false"/"true", not boolean
	ConditionNote?: string;
	ConditionId?: string;
	ConditionSubtypeId?: string;
	ScheduledDeliveryStartDate?: string;
	ScheduledDeliveryEndDate?: string;
	PriceDesignation?: string;
	TaxCollection?: {
		Model: string;
		ResponsibleParty: string;
	};
	SerialNumberRequired?: boolean;
	IsTransparency?: boolean;
	IossNumber?: string;
	StoreChainStoreId?: string;
	DeemedResellerCategory?: string;
	BuyerInfo?: {
		BuyerCustomizedInfo?: {
			CustomizedURL?: string;
		};
		GiftWrapPrice?: {
			CurrencyCode: string;
			Amount: string;
		};
		GiftWrapTax?: {
			CurrencyCode: string;
			Amount: string;
		};
		GiftMessageText?: string;
		GiftWrapLevel?: string;
	};
	BuyerRequestedCancel?: {
		IsBuyerRequestedCancel?: boolean;
		BuyerCancelReason?: string;
	};
	ItemApprovalContext?: {
		ApprovalType?: string;
		ApprovalStatus?: string;
		ApprovalSupportData?: {
			[key: string]: string;
		};
	};
	SerialNumbers?: string[];
	SubstitutionPreferences?: {
		SubstitutionType?: string;
		SubstitutionOptions?: Array<{
			ASIN?: string;
			QuantityRequested?: number;
			SellerSKU?: string;
			Title?: string;
			Measurement?: {
				Unit?: string;
				Value?: number;
			};
		}>;
	};
	Measurement?: {
		Unit?: string;
		Value?: number;
	};
}

interface GetOrderItemsResponse {
	payload: {
		AmazonOrderId: string;
		NextToken?: string;
		OrderItems: OrderItem[];
	};
}

export async function executeOrdersOperation(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const nodeId = this.getNode().id;

	if (operation === 'getOrders') {
		// Get parameters
		const marketplaceIds = this.getNodeParameter('marketplaceIds', itemIndex) as string[];
		const createdAfter = this.getNodeParameter('createdAfter', itemIndex) as string;
		const createdBefore = this.getNodeParameter('createdBefore', itemIndex) as string;
		const additionalOptions = this.getNodeParameter('additionalOptions', itemIndex, {}) as any;

		// Security Validation
		const marketplaceValidation = securityValidator.validateMarketplaceIds(marketplaceIds, nodeId);
		if (!marketplaceValidation.isValid) {
			throw new NodeOperationError(this.getNode(), marketplaceValidation.errors.join(', '));
		}

		const dateValidation = securityValidator.validateDateRange(createdAfter, createdBefore, nodeId);
		if (!dateValidation.isValid) {
			throw new NodeOperationError(this.getNode(), dateValidation.errors.join(', '));
		}

		// Build query parameters
		const queryParams: Record<string, any> = {
			MarketplaceIds: marketplaceIds,
			CreatedAfter: createdAfter,
			CreatedBefore: createdBefore,
		};

		// Add optional parameters from additionalOptions
		if (additionalOptions.orderStatuses?.length > 0) {
			queryParams.OrderStatuses = additionalOptions.orderStatuses;
		}

		if (additionalOptions.fulfillmentChannels?.length > 0) {
			queryParams.FulfillmentChannels = additionalOptions.fulfillmentChannels;
		}

		if (additionalOptions.paymentMethods?.length > 0) {
			queryParams.PaymentMethods = additionalOptions.paymentMethods;
		}

		if (additionalOptions.maxResultsPerPage !== undefined && additionalOptions.maxResultsPerPage !== null) {
			const maxResults = additionalOptions.maxResultsPerPage;
			if (maxResults < 1 || maxResults > 100) {
				throw new NodeOperationError(this.getNode(), 'MaxResultsPerPage must be between 1 and 100');
			}
			queryParams.MaxResultsPerPage = maxResults;
		}

		const returnAll = additionalOptions.returnAll !== false;
		let nextToken: string | undefined;
		let allOrders: Order[] = [];

		// Handle pagination
		do {
			if (nextToken) {
				queryParams.NextToken = nextToken;
			}

			try {
				const response = await SpApiRequest.makeRequest<GetOrdersResponse>(this, {
					method: 'GET',
					endpoint: '/orders/v0/orders',
					query: queryParams,
				});

				const orders = response.data.payload.Orders || [];
				allOrders = allOrders.concat(orders);

				nextToken = response.data.payload.NextToken;

				// If not returning all results, break after first page
				if (!returnAll) {
					break;
				}

			} catch (error) {
				if (error instanceof NodeOperationError) {
					throw error;
				}
				const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
				throw new NodeOperationError(
					this.getNode(),
					`Failed to retrieve orders: ${errorMessage}`
				);
			}
		} while (nextToken && returnAll);

		// Convert orders to n8n items
		for (const order of allOrders) {
			returnData.push({
				json: order as any, // Cast to any to satisfy IDataObject requirement
				pairedItem: {
					item: itemIndex,
				},
			});
		}

		// If no orders found, return empty result with metadata
		if (allOrders.length === 0) {
			returnData.push({
				json: {
					message: 'No orders found for the specified criteria',
					searchCriteria: {
						marketplaceIds,
						createdAfter,
						createdBefore,
						...additionalOptions,
					},
				},
				pairedItem: {
					item: itemIndex,
				},
			});
		}
	}

	// --- Get Order Details ---
	if (operation === 'getOrder') {
		const orderId = this.getNodeParameter('orderId', itemIndex) as string;

		if (!/^\d{3}-\d{7}-\d{7}$/.test(orderId)) {
			throw new NodeOperationError(this.getNode(), 'Invalid Order ID format');
		}

		try {
			const response = await SpApiRequest.makeRequest<GetOrderResponse>(this, {
				method: 'GET',
				endpoint: `/orders/v0/orders/${orderId}`,
			});

			returnData.push({
				json: response.data.payload as any,
				pairedItem: { item: itemIndex },
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			throw new NodeOperationError(
				this.getNode(),
				`Failed to retrieve order details: ${errorMessage}`
			);
		}
	}

	// --- Get Order Items ---
	if (operation === 'getOrderItems') {
		const orderId = this.getNodeParameter('orderId', itemIndex) as string;
		const returnAll = this.getNodeParameter('returnAll', itemIndex, true) as boolean;

		if (!/^\d{3}-\d{7}-\d{7}$/.test(orderId)) {
			throw new NodeOperationError(this.getNode(), 'Invalid Order ID format');
		}

		let nextToken: string | undefined;
		let allItems: OrderItem[] = [];
		let pageCount = 0;
		const maxPages = 30; // Safety guard for runaway pagination

		do {
			const query: Record<string, any> = {};
			if (nextToken) query.NextToken = nextToken;

			try {
				const response = await SpApiRequest.makeRequest<GetOrderItemsResponse>(this, {
					method: 'GET',
					endpoint: `/orders/v0/orders/${orderId}/orderItems`,
					query,
				});

				const items = response.data.payload.OrderItems || [];
				allItems = allItems.concat(items);
				nextToken = response.data.payload.NextToken;
				pageCount++;

				if (!returnAll || !nextToken || pageCount >= maxPages) {
					break;
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
				throw new NodeOperationError(
					this.getNode(),
					`Failed to retrieve order items: ${errorMessage}`
				);
			}
		} while (nextToken);

		for (const item of allItems) {
			returnData.push({
				json: item as any,
				pairedItem: { item: itemIndex },
			});
		}

		if (allItems.length === 0) {
			returnData.push({
				json: {
					message: 'No order items found for the specified order',
					orderId,
				},
				pairedItem: { item: itemIndex },
			});
		}
	}

	return returnData;
} 