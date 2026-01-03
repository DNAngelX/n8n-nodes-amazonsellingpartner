export interface AnalyticsMetric {
	id: string;
	displayName: string;
	description: string;
	category: 'traffic' | 'sales' | 'conversion' | 'buybox' | 'computed';
	dataType: 'number' | 'percentage' | 'currency';
	computedFormula?: string; // For client-side computed metrics
}

export interface SchemaVersion {
	version: string;
	displayName: string;
	description: string;
	supportedMetrics: string[];
	supportedDimensions: string[];
	maxDateRange: number; // days
}

// Schema versions supported
export const SCHEMA_VERSIONS: Record<string, SchemaVersion> = {
	'2024-04-24': {
		version: '2024-04-24',
		displayName: 'April 2024 (Current)',
		description: 'Latest schema with full metrics support',
		supportedMetrics: [
			'sessions', 'pageViews', 'pageViewsPerSession', 'sessionsPercent', 'pageViewsPercent',
			'unitsOrdered', 'unitsOrderedB2B', 'orderedProductSales', 'orderedProductSalesB2B',
			'unitSessionPercentage', 'unitSessionPercentageB2B', 'buyBoxPercentage',
			'aov', 'unitsPerSession', 'salesPerSession' // computed
		],
		supportedDimensions: ['asin', 'parentAsin', 'sku', 'marketplace', 'date'],
		maxDateRange: 90,
	},
};

// Available metrics with metadata
export const ANALYTICS_METRICS: Record<string, AnalyticsMetric> = {
	// Traffic metrics
	sessions: {
		id: 'sessions',
		displayName: 'Sessions',
		description: 'Number of visits to your product detail pages',
		category: 'traffic',
		dataType: 'number',
	},
	pageViews: {
		id: 'pageViews',
		displayName: 'Page Views',
		description: 'Number of times your product detail pages were viewed',
		category: 'traffic',
		dataType: 'number',
	},
	pageViewsPerSession: {
		id: 'pageViewsPerSession',
		displayName: 'Page Views per Session',
		description: 'Average page views per session',
		category: 'traffic',
		dataType: 'number',
	},
	sessionsPercent: {
		id: 'sessionsPercent',
		displayName: 'Sessions %',
		description: 'Percentage of total sessions for this ASIN',
		category: 'traffic',
		dataType: 'percentage',
	},
	pageViewsPercent: {
		id: 'pageViewsPercent',
		displayName: 'Page Views %',
		description: 'Percentage of total page views for this ASIN',
		category: 'traffic',
		dataType: 'percentage',
	},

	// Sales metrics
	unitsOrdered: {
		id: 'unitsOrdered',
		displayName: 'Units Ordered',
		description: 'Number of units ordered',
		category: 'sales',
		dataType: 'number',
	},
	unitsOrderedB2B: {
		id: 'unitsOrderedB2B',
		displayName: 'Units Ordered (B2B)',
		description: 'Number of units ordered by business customers',
		category: 'sales',
		dataType: 'number',
	},
	orderedProductSales: {
		id: 'orderedProductSales',
		displayName: 'Ordered Product Sales',
		description: 'Sales amount for ordered products',
		category: 'sales',
		dataType: 'currency',
	},
	orderedProductSalesB2B: {
		id: 'orderedProductSalesB2B',
		displayName: 'Ordered Product Sales (B2B)',
		description: 'Sales amount for ordered products from business customers',
		category: 'sales',
		dataType: 'currency',
	},

	// Conversion metrics
	unitSessionPercentage: {
		id: 'unitSessionPercentage',
		displayName: 'Unit Session Percentage',
		description: 'Percentage of sessions that resulted in an order',
		category: 'conversion',
		dataType: 'percentage',
	},
	unitSessionPercentageB2B: {
		id: 'unitSessionPercentageB2B',
		displayName: 'Unit Session Percentage (B2B)',
		description: 'Percentage of B2B sessions that resulted in an order',
		category: 'conversion',
		dataType: 'percentage',
	},

	// Buy Box metrics
	buyBoxPercentage: {
		id: 'buyBoxPercentage',
		displayName: 'Buy Box Percentage',
		description: 'Percentage of time your offer had the Buy Box',
		category: 'buybox',
		dataType: 'percentage',
	},

	// Computed metrics (calculated client-side)
	aov: {
		id: 'aov',
		displayName: 'Average Order Value',
		description: 'Average value per order (orderedProductSales / unitsOrdered)',
		category: 'computed',
		dataType: 'currency',
		computedFormula: 'orderedProductSales / unitsOrdered',
	},
	unitsPerSession: {
		id: 'unitsPerSession',
		displayName: 'Units per Session',
		description: 'Average units ordered per session (unitsOrdered / sessions)',
		category: 'computed',
		dataType: 'number',
		computedFormula: 'unitsOrdered / sessions',
	},
	salesPerSession: {
		id: 'salesPerSession',
		displayName: 'Sales per Session',
		description: 'Average sales per session (orderedProductSales / sessions)',
		category: 'computed',
		dataType: 'currency',
		computedFormula: 'orderedProductSales / sessions',
	},
};

// Metric categories for UI grouping
export const METRIC_CATEGORIES = {
	traffic: {
		displayName: 'Traffic Metrics',
		description: 'Page views, sessions, and traffic percentages',
		metrics: ['sessions', 'pageViews', 'pageViewsPerSession', 'sessionsPercent', 'pageViewsPercent'],
	},
	sales: {
		displayName: 'Sales Metrics',
		description: 'Units ordered and sales amounts',
		metrics: ['unitsOrdered', 'unitsOrderedB2B', 'orderedProductSales', 'orderedProductSalesB2B'],
	},
	conversion: {
		displayName: 'Conversion Metrics',
		description: 'Session to order conversion rates',
		metrics: ['unitSessionPercentage', 'unitSessionPercentageB2B'],
	},
	buybox: {
		displayName: 'Buy Box Metrics',
		description: 'Buy Box ownership percentage',
		metrics: ['buyBoxPercentage'],
	},
	computed: {
		displayName: 'Computed Metrics',
		description: 'Calculated metrics derived from base metrics',
		metrics: ['aov', 'unitsPerSession', 'salesPerSession'],
	},
};

// Date presets
export const DATE_PRESETS = {
	today: { displayName: 'Today', days: 0, offset: 0 },
	yesterday: { displayName: 'Yesterday', days: 1, offset: 1 },
	last7days: { displayName: 'Last 7 Days', days: 7, offset: 0 },
	last30days: { displayName: 'Last 30 Days', days: 30, offset: 0 },
	last90days: { displayName: 'Last 90 Days', days: 90, offset: 0 },
	mtd: { displayName: 'Month to Date', days: 'mtd', offset: 0 },
	qtd: { displayName: 'Quarter to Date', days: 'qtd', offset: 0 },
	ytd: { displayName: 'Year to Date', days: 'ytd', offset: 0 },
};

// Analytics modes
export const ANALYTICS_MODES = {
	dataKiosk: {
		value: 'dataKiosk',
		displayName: 'Data Kiosk (Primary)',
		description: 'Use Amazon Data Kiosk API for rich analytics data',
	},
	reports: {
		value: 'reports',
		displayName: 'Reports API (Fallback)',
		description: 'Use traditional Reports API for sales and traffic data',
	},
	auto: {
		value: 'auto',
		displayName: 'Auto (Try Data Kiosk, fallback to Reports)',
		description: 'Attempt Data Kiosk first, fallback to Reports if unavailable',
	},
};

// Endpoint builders
export function buildDataKioskEndpoint(schemaVersion: string, resource: string): string {
	return `/dataKiosk/${schemaVersion}/analytics/${resource}`;
}

export function buildAnalyticsEndpoint(schemaVersion: string, resource: string): string {
	return `/analytics/${schemaVersion}/${resource}`;
}

// Reports API mapping for fallback
export const REPORTS_FALLBACK_MAPPING = {
	salesAndTrafficByAsin: {
		reportType: 'GET_SALES_AND_TRAFFIC_REPORT',
		description: 'Sales and Traffic Business Report by ASIN',
		supportedMetrics: ['sessions', 'pageViews', 'unitsOrdered', 'orderedProductSales', 'unitSessionPercentage'],
	},
};

// Currency codes for normalization
export const SUPPORTED_CURRENCIES = [
	'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR', 'MXN', 'BRL', 'SEK', 'PLN', 'AED', 'SAR', 'SGD'
];

// Default settings
export const DEFAULT_SETTINGS = {
	schemaVersion: '2024-04-24',
	analyticsMode: 'auto',
	granularity: 'DAILY',
	pageSize: 100,
	maxResults: 10000,
	includeZeroActivity: false,
	outputFormat: 'json',
	csvDelimiter: ',',
	csvDecimalSeparator: '.',
	timezone: 'UTC',
};
