import {
	IExecuteFunctions,
	INodeExecutionData,
	NodeOperationError,
} from 'n8n-workflow';
import { SpApiRequest } from '../helpers/SpApiRequest';
import { securityValidator } from '../core/SecurityValidator';

// Interface definitions based on Amazon SP-API Finance API v0 documentation

interface FinancialEventGroup {
	FinancialEventGroupId: string;
	ProcessingStatus: string;
	FundTransferStatus: string;
	OriginalTotal?: {
		CurrencyCode: string;
		CurrencyAmount: number;
	};
	ConvertedTotal?: {
		CurrencyCode: string;
		CurrencyAmount: number;
	};
	FundTransferDate?: string;
	TraceId?: string;
	AccountTail?: string;
	BeginningBalance?: {
		CurrencyCode: string;
		CurrencyAmount: number;
	};
	FinancialEventGroupStart?: string;
	FinancialEventGroupEnd?: string;
}

interface ListFinancialEventGroupsResponse {
	payload: {
		FinancialEventGroupList: FinancialEventGroup[];
		NextToken?: string;
	};
}

interface FinancialEvents {
	ShipmentEventList?: any[];
	RefundEventList?: any[];
	GuaranteeClaimEventList?: any[];
	ChargebackEventList?: any[];
	PayWithAmazonEventList?: any[];
	ServiceProviderCreditEventList?: any[];
	RetrochargeEventList?: any[];
	RentalTransactionEventList?: any[];
	ProductAdsPaymentEventList?: any[];
	ServiceFeeEventList?: any[];
	DebtRecoveryEventList?: any[];
	LoanServicingEventList?: any[];
	AdjustmentEventList?: any[];
	SAFETReimbursementEventList?: any[];
	SellerReviewEnrollmentPaymentEventList?: any[];
	FBALiquidationEventList?: any[];
	CouponPaymentEventList?: any[];
	ImagingServicesFeeEventList?: any[];
	NetworkComminglingTransactionEventList?: any[];
	AffordabilityExpenseEventList?: any[];
	AffordabilityExpenseReversalEventList?: any[];
	TrialShipmentEventList?: any[];
	ShipmentSettleEventList?: any[];
	TaxWithholdingEventList?: any[];
	RemovalShipmentEventList?: any[];
	RemovalShipmentAdjustmentEventList?: any[];
}

interface ListFinancialEventsResponse {
	payload: {
		FinancialEvents: FinancialEvents;
		NextToken?: string;
	};
}

export async function executeFinanceOperation(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const nodeId = this.getNode().id;

	if (operation === 'listFinancialEventGroups') {
		// Get parameters
		const financialEventGroupStartedAfter = this.getNodeParameter('financialEventGroupStartedAfter', itemIndex) as string;
		const financialEventGroupStartedBefore = this.getNodeParameter('financialEventGroupStartedBefore', itemIndex) as string;
		const additionalOptions = this.getNodeParameter('additionalOptions', itemIndex, {}) as any;

		// Security Validation for date range
		if (financialEventGroupStartedAfter && financialEventGroupStartedBefore) {
			const dateValidation = securityValidator.validateDateRange(
				financialEventGroupStartedAfter, 
				financialEventGroupStartedBefore, 
				nodeId
			);
			if (!dateValidation.isValid) {
				throw new NodeOperationError(this.getNode(), dateValidation.errors.join(', '));
			}
		}

		// Build query parameters
		const queryParams: Record<string, any> = {};

		if (financialEventGroupStartedAfter) {
			queryParams.FinancialEventGroupStartedAfter = financialEventGroupStartedAfter;
		}

		if (financialEventGroupStartedBefore) {
			queryParams.FinancialEventGroupStartedBefore = financialEventGroupStartedBefore;
		}

		if (additionalOptions.maxResultsPerPage) {
			const maxResults = additionalOptions.maxResultsPerPage;
			if (maxResults < 1 || maxResults > 100) {
				throw new NodeOperationError(this.getNode(), 'MaxResultsPerPage must be between 1 and 100');
			}
			queryParams.MaxResultsPerPage = maxResults;
		}

		const returnAll = additionalOptions.returnAll !== false;
		let nextToken: string | undefined;
		let allEventGroups: FinancialEventGroup[] = [];

		// Handle pagination
		do {
			if (nextToken) {
				queryParams.NextToken = nextToken;
			}

			try {
				const response = await SpApiRequest.makeRequest<ListFinancialEventGroupsResponse>(this, {
					method: 'GET',
					endpoint: '/finances/v0/financialEventGroups',
					query: queryParams,
				});

				const eventGroups = response.data.payload.FinancialEventGroupList || [];
				allEventGroups = allEventGroups.concat(eventGroups);

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
					`Failed to retrieve financial event groups: ${errorMessage}`
				);
			}
		} while (nextToken && returnAll);

		// Convert event groups to n8n items
		for (const eventGroup of allEventGroups) {
			returnData.push({
				json: eventGroup as any,
				pairedItem: {
					item: itemIndex,
				},
			});
		}

		// If no event groups found, return empty result with metadata
		if (allEventGroups.length === 0) {
			returnData.push({
				json: {
					message: 'No financial event groups found for the specified criteria',
					searchCriteria: {
						financialEventGroupStartedAfter,
						financialEventGroupStartedBefore,
						...additionalOptions,
					},
				},
				pairedItem: {
					item: itemIndex,
				},
			});
		}
	}

	if (operation === 'listFinancialEventsByGroupId') {
		// Get parameters
		const eventGroupId = this.getNodeParameter('eventGroupId', itemIndex) as string;
		const postedAfter = this.getNodeParameter('postedAfter', itemIndex) as string;
		const postedBefore = this.getNodeParameter('postedBefore', itemIndex) as string;
		const additionalOptions = this.getNodeParameter('additionalOptions', itemIndex, {}) as any;

		// Validate eventGroupId
		if (!eventGroupId) {
			throw new NodeOperationError(this.getNode(), 'Event Group ID is required');
		}

		// Security Validation for date range
		if (postedAfter && postedBefore) {
			const dateValidation = securityValidator.validateDateRange(postedAfter, postedBefore, nodeId);
			if (!dateValidation.isValid) {
				throw new NodeOperationError(this.getNode(), dateValidation.errors.join(', '));
			}
		}

		// Build query parameters
		const queryParams: Record<string, any> = {};

		if (postedAfter) {
			queryParams.PostedAfter = postedAfter;
		}

		if (postedBefore) {
			queryParams.PostedBefore = postedBefore;
		}

		if (additionalOptions.maxResultsPerPage) {
			const maxResults = additionalOptions.maxResultsPerPage;
			if (maxResults < 1 || maxResults > 100) {
				throw new NodeOperationError(this.getNode(), 'MaxResultsPerPage must be between 1 and 100');
			}
			queryParams.MaxResultsPerPage = maxResults;
		}

		const returnAll = additionalOptions.returnAll !== false;
		let nextToken: string | undefined;
		let allFinancialEvents: any[] = [];

		// Handle pagination
		do {
			if (nextToken) {
				queryParams.NextToken = nextToken;
			}

			try {
				const response = await SpApiRequest.makeRequest<ListFinancialEventsResponse>(this, {
					method: 'GET',
					endpoint: `/finances/v0/financialEventGroups/${eventGroupId}/financialEvents`,
					query: queryParams,
				});

				// Extract all financial events from the response
				const financialEvents = response.data.payload.FinancialEvents || {};
				const events = extractFinancialEvents(financialEvents);
				allFinancialEvents = allFinancialEvents.concat(events);

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
					`Failed to retrieve financial events for group: ${errorMessage}`
				);
			}
		} while (nextToken && returnAll);

		// Convert events to n8n items
		for (const event of allFinancialEvents) {
			returnData.push({
				json: { ...event, eventGroupId } as any,
				pairedItem: {
					item: itemIndex,
				},
			});
		}

		// If no events found, return empty result with metadata
		if (allFinancialEvents.length === 0) {
			returnData.push({
				json: {
					message: 'No financial events found for the specified group',
					eventGroupId,
					searchCriteria: {
						postedAfter,
						postedBefore,
						...additionalOptions,
					},
				},
				pairedItem: {
					item: itemIndex,
				},
			});
		}
	}

	if (operation === 'listFinancialEventsByOrderId') {
		// Get parameters
		const orderId = this.getNodeParameter('orderId', itemIndex) as string;
		const additionalOptions = this.getNodeParameter('additionalOptions', itemIndex, {}) as any;

		// Validate Order ID format
		if (!orderId || !/^\d{3}-\d{7}-\d{7}$/.test(orderId)) {
			throw new NodeOperationError(this.getNode(), 'Invalid Order ID format. Expected format: 3-7-7');
		}

		// Build query parameters
		const queryParams: Record<string, any> = {};

		if (additionalOptions.maxResultsPerPage) {
			const maxResults = additionalOptions.maxResultsPerPage;
			if (maxResults < 1 || maxResults > 100) {
				throw new NodeOperationError(this.getNode(), 'MaxResultsPerPage must be between 1 and 100');
			}
			queryParams.MaxResultsPerPage = maxResults;
		}

		const returnAll = additionalOptions.returnAll !== false;
		let nextToken: string | undefined;
		let allFinancialEvents: any[] = [];

		// Handle pagination
		do {
			if (nextToken) {
				queryParams.NextToken = nextToken;
			}

			try {
				const response = await SpApiRequest.makeRequest<ListFinancialEventsResponse>(this, {
					method: 'GET',
					endpoint: `/finances/v0/orders/${orderId}/financialEvents`,
					query: queryParams,
				});

				// Extract all financial events from the response
				const financialEvents = response.data.payload.FinancialEvents || {};
				const events = extractFinancialEvents(financialEvents);
				allFinancialEvents = allFinancialEvents.concat(events);

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
					`Failed to retrieve financial events for order: ${errorMessage}`
				);
			}
		} while (nextToken && returnAll);

		// Convert events to n8n items
		for (const event of allFinancialEvents) {
			returnData.push({
				json: { ...event, orderId } as any,
				pairedItem: {
					item: itemIndex,
				},
			});
		}

		// If no events found, return empty result with metadata
		if (allFinancialEvents.length === 0) {
			returnData.push({
				json: {
					message: 'No financial events found for the specified order',
					orderId,
				},
				pairedItem: {
					item: itemIndex,
				},
			});
		}
	}

	if (operation === 'listFinancialEvents') {
		// Get parameters
		const postedAfter = this.getNodeParameter('postedAfter', itemIndex) as string;
		const postedBefore = this.getNodeParameter('postedBefore', itemIndex) as string;
		const additionalOptions = this.getNodeParameter('additionalOptions', itemIndex, {}) as any;

		// Security Validation for date range
		if (postedAfter && postedBefore) {
			const dateValidation = securityValidator.validateDateRange(postedAfter, postedBefore, nodeId);
			if (!dateValidation.isValid) {
				throw new NodeOperationError(this.getNode(), dateValidation.errors.join(', '));
			}
		}

		// Build query parameters
		const queryParams: Record<string, any> = {};

		if (postedAfter) {
			queryParams.PostedAfter = postedAfter;
		}

		if (postedBefore) {
			queryParams.PostedBefore = postedBefore;
		}

		if (additionalOptions.maxResultsPerPage) {
			const maxResults = additionalOptions.maxResultsPerPage;
			if (maxResults < 1 || maxResults > 100) {
				throw new NodeOperationError(this.getNode(), 'MaxResultsPerPage must be between 1 and 100');
			}
			queryParams.MaxResultsPerPage = maxResults;
		}

		const returnAll = additionalOptions.returnAll !== false;
		let nextToken: string | undefined;
		let allFinancialEvents: any[] = [];

		// Handle pagination
		do {
			if (nextToken) {
				queryParams.NextToken = nextToken;
			}

			try {
				const response = await SpApiRequest.makeRequest<ListFinancialEventsResponse>(this, {
					method: 'GET',
					endpoint: '/finances/v0/financialEvents',
					query: queryParams,
				});

				// Extract all financial events from the response
				const financialEvents = response.data.payload.FinancialEvents || {};
				const events = extractFinancialEvents(financialEvents);
				allFinancialEvents = allFinancialEvents.concat(events);

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
					`Failed to retrieve financial events: ${errorMessage}`
				);
			}
		} while (nextToken && returnAll);

		// Convert events to n8n items
		for (const event of allFinancialEvents) {
			returnData.push({
				json: event as any,
				pairedItem: {
					item: itemIndex,
				},
			});
		}

		// If no events found, return empty result with metadata
		if (allFinancialEvents.length === 0) {
			returnData.push({
				json: {
					message: 'No financial events found for the specified criteria',
					searchCriteria: {
						postedAfter,
						postedBefore,
						...additionalOptions,
					},
				},
				pairedItem: {
					item: itemIndex,
				},
			});
		}
	}

	if (operation === 'listTransactions') {
		// Get parameters
		const postedAfter = this.getNodeParameter('postedAfter', itemIndex) as string;
		const postedBefore = this.getNodeParameter('postedBefore', itemIndex) as string;
		const marketplaceId = this.getNodeParameter('marketplaceId', itemIndex) as string;
		const additionalOptions = this.getNodeParameter('additionalOptions', itemIndex, {}) as any;

		// Validation
		if (!postedAfter) {
			throw new NodeOperationError(this.getNode(), 'Posted After date is required');
		}

		// Security Validation for date range
		if (postedAfter && postedBefore) {
			const dateValidation = securityValidator.validateDateRange(
				postedAfter, 
				postedBefore, 
				nodeId
			);
			if (!dateValidation.isValid) {
				throw new NodeOperationError(this.getNode(), dateValidation.errors.join(', '));
			}
		}

		// Build query parameters
		const queryParams: Record<string, any> = {
			postedAfter,
		};

		if (postedBefore) {
			queryParams.postedBefore = postedBefore;
		}

		if (marketplaceId) {
			queryParams.marketplaceId = marketplaceId;
		}

		if (additionalOptions.maxResultsPerPage) {
			const maxResults = additionalOptions.maxResultsPerPage;
			if (maxResults < 1 || maxResults > 100) {
				throw new NodeOperationError(this.getNode(), 'MaxResultsPerPage must be between 1 and 100');
			}
			queryParams.maxResultsPerPage = maxResults;
		}

		if (additionalOptions.nextToken) {
			queryParams.nextToken = additionalOptions.nextToken;
		}

		const returnAll = additionalOptions.returnAll !== false;
		let nextToken: string | undefined;
		let allTransactions: any[] = [];

		// Handle pagination
		do {
			if (nextToken) {
				queryParams.nextToken = nextToken;
			}

			try {
				const response = await SpApiRequest.makeRequest<any>(this, {
					method: 'GET',
					endpoint: '/finances/2024-06-19/transactions',
					query: queryParams,
				});

				const transactions = response.data.payload?.transactions || [];
				allTransactions = allTransactions.concat(transactions);

				nextToken = response.data.payload?.nextToken;

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
					`Failed to retrieve transactions: ${errorMessage}`
				);
			}
		} while (nextToken && returnAll);

		// Convert transactions to n8n items
		for (const transaction of allTransactions) {
			returnData.push({
				json: transaction,
				pairedItem: {
					item: itemIndex,
				},
			});
		}

		// If no transactions found, return empty result with metadata
		if (allTransactions.length === 0) {
			returnData.push({
				json: {
					message: 'No transactions found for the specified criteria',
					searchCriteria: {
						postedAfter,
						postedBefore,
						marketplaceId,
						...additionalOptions,
					},
				},
				pairedItem: {
					item: itemIndex,
				},
			});
		}
	}

	// Handle unsupported operations
	if (!['listFinancialEventGroups', 'listFinancialEventsByGroupId', 'listFinancialEventsByOrderId', 'listFinancialEvents', 'listTransactions'].includes(operation)) {
		throw new NodeOperationError(this.getNode(), `Operation "${operation}" is not supported`);
	}

	return returnData;
}

// Helper method to extract financial events from the complex response structure
function extractFinancialEvents(financialEvents: FinancialEvents): any[] {
	const events: any[] = [];

	// Extract events from all possible event lists
	const eventLists = [
		'ShipmentEventList',
		'RefundEventList', 
		'GuaranteeClaimEventList',
		'ChargebackEventList',
		'PayWithAmazonEventList',
		'ServiceProviderCreditEventList',
		'RetrochargeEventList',
		'RentalTransactionEventList',
		'ProductAdsPaymentEventList',
		'ServiceFeeEventList',
		'DebtRecoveryEventList',
		'LoanServicingEventList',
		'AdjustmentEventList',
		'SAFETReimbursementEventList',
		'SellerReviewEnrollmentPaymentEventList',
		'FBALiquidationEventList',
		'CouponPaymentEventList',
		'ImagingServicesFeeEventList',
		'NetworkComminglingTransactionEventList',
		'AffordabilityExpenseEventList',
		'AffordabilityExpenseReversalEventList',
		'TrialShipmentEventList',
		'ShipmentSettleEventList',
		'TaxWithholdingEventList',
		'RemovalShipmentEventList',
		'RemovalShipmentAdjustmentEventList',
	];

	for (const eventListName of eventLists) {
		const eventList = (financialEvents as any)[eventListName];
		if (eventList && Array.isArray(eventList)) {
			for (const event of eventList) {
				events.push({
					...event,
					eventType: eventListName.replace('EventList', ''),
					eventListType: eventListName,
				});
			}
		}
	}

	return events;
}
