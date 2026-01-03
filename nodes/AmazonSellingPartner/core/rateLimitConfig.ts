export interface RateLimitConfig {
	rate: number; // requests per second
	burst: number; // maximum burst capacity
	description?: string;
}

// Rate limit groups based on Amazon SP-API documentation
export const RATE_LIMIT_GROUPS: Record<string, RateLimitConfig> = {
	// Orders API - Detail operations (getOrder, getOrderItems, getOrderAddress, etc.)
	'orders-detail': {
		rate: 0.5,
		burst: 30,
		description: 'Order detail operations: getOrder, getOrderItems, getOrderAddress, getOrderBuyerInfo, etc.'
	},
	
	// Orders API - List operations (getOrders)
	'orders-list': {
		rate: 0.0167, // 1 request per 60 seconds
		burst: 20,
		description: 'Order list operations: getOrders'
	},
	
	// Orders API - Update operations
	'orders-update': {
		rate: 2.0,
		burst: 10,
		description: 'Order update operations: confirmShipment, updateShipmentStatus'
	},
	
	// Reports API - All operations
	'reports': {
		rate: 0.0167, // 1 request per 60 seconds
		burst: 15,
		description: 'Reports API operations: createReport, getReport, getReportDocument'
	},
	
	// Data Kiosk (GraphQL) groups
	'dataKiosk-queries-create': { rate: 0.0167, burst: 15, description: 'POST /dataKiosk/2023-11-15/queries' },
	'dataKiosk-queries-list': { rate: 0.0222, burst: 10, description: 'GET /dataKiosk/2023-11-15/queries' },
	'dataKiosk-queries-get': { rate: 2.0, burst: 15, description: 'GET /dataKiosk/2023-11-15/queries/{id}' },
	'dataKiosk-queries-cancel': { rate: 0.0222, burst: 10, description: 'DELETE /dataKiosk/2023-11-15/queries/{id}' },
	'dataKiosk-documents': { rate: 0.0167, burst: 15, description: 'GET /dataKiosk/2023-11-15/documents/{id}' },
	
	// Default fallback for unclassified endpoints
	'default': {
		rate: 0.5,
		burst: 10,
		description: 'Default rate limit for unclassified endpoints'
	}
};

// Endpoint pattern to group mapping
export const ENDPOINT_TO_GROUP: Array<{ method: '*' | 'GET' | 'POST' | 'DELETE'; pattern: RegExp; group: string }> = [
	// Orders API patterns
	{ method: '*', pattern: /^\/orders\/v0\/orders\/[^\/]+\/orderItems/, group: 'orders-detail' },
	{ method: '*', pattern: /^\/orders\/v0\/orders\/[^\/]+\/orderAddress/, group: 'orders-detail' },
	{ method: '*', pattern: /^\/orders\/v0\/orders\/[^\/]+\/buyerInfo/, group: 'orders-detail' },
	{ method: '*', pattern: /^\/orders\/v0\/orders\/[^\/]+\/orderItemsBuyerInfo/, group: 'orders-detail' },
	{ method: '*', pattern: /^\/orders\/v0\/orders\/[^\/]+\/regulatedInfo/, group: 'orders-detail' },
	{ method: '*', pattern: /^\/orders\/v0\/orders\/[^\/]+$/, group: 'orders-detail' }, // getOrder
	{ method: '*', pattern: /^\/orders\/v0\/orders\/?(\?.*)?$/, group: 'orders-list' }, // getOrders
	{ method: '*', pattern: /^\/orders\/v0\/orders\/[^\/]+\/shipment/, group: 'orders-update' },
	{ method: '*', pattern: /^\/orders\/v0\/orders\/[^\/]+\/shipmentConfirmation$/, group: 'orders-update' },
	{ method: '*', pattern: /^\/orders\/v0\/orders\/[^\/]+\/shipmentStatus$/, group: 'orders-update' },
	
	// Reports API patterns
	{ method: '*', pattern: /^\/reports\/2021-06-30\/reports\/?(\?.*)?$/, group: 'reports' }, // createReport, getReports
	{ method: '*', pattern: /^\/reports\/2021-06-30\/reports\/[^\/]+$/, group: 'reports' }, // getReport
	{ method: '*', pattern: /^\/reports\/2021-06-30\/documents\/[^\/]+$/, group: 'reports' }, // getReportDocument
	
	// Data Kiosk GraphQL patterns
	{ method: 'POST', pattern: /^\/dataKiosk\/2023-11-15\/queries$/, group: 'dataKiosk-queries-create' },
	{ method: 'GET', pattern: /^\/dataKiosk\/2023-11-15\/queries(\?.*)?$/, group: 'dataKiosk-queries-list' },
	{ method: 'GET', pattern: /^\/dataKiosk\/2023-11-15\/queries\/[^\/]+$/, group: 'dataKiosk-queries-get' },
	{ method: 'DELETE', pattern: /^\/dataKiosk\/2023-11-15\/queries\/[^\/]+$/, group: 'dataKiosk-queries-cancel' },
	{ method: 'GET', pattern: /^\/dataKiosk\/2023-11-15\/documents\/[^\/]+$/, group: 'dataKiosk-documents' },
	
	// Add more patterns as needed for other APIs
];

/**
 * Get the rate limit group for a given endpoint
 */
export function getEndpointGroup(method: string, endpoint: string): string {
	for (const { method: m, pattern, group } of ENDPOINT_TO_GROUP) {
		if ((m === '*' || m === method) && pattern.test(endpoint)) {
			return group;
		}
	}
	return 'default';
}

/**
 * Get rate limit configuration for a group, with environment variable overrides
 */
export function getRateLimitConfig(group: string): RateLimitConfig {
	const baseConfig = RATE_LIMIT_GROUPS[group] || RATE_LIMIT_GROUPS['default'];
	
	// Allow environment variable overrides
	const envOverride = process.env.RATE_LIMIT_OVERRIDE_JSON;
	if (envOverride) {
		try {
			const overrides = JSON.parse(envOverride);
			if (overrides[group]) {
				return {
					...baseConfig,
					...overrides[group]
				};
			}
		} catch (error) {
			console.warn('Failed to parse RATE_LIMIT_OVERRIDE_JSON:', error);
		}
	}
	
	return baseConfig;
}

/**
 * Validate rate limit configuration
 */
export function validateRateLimitConfig(config: RateLimitConfig): boolean {
	return (
		typeof config.rate === 'number' &&
		config.rate > 0 &&
		typeof config.burst === 'number' &&
		config.burst > 0 &&
		config.burst >= 1 // Must allow at least 1 request
	);
} 