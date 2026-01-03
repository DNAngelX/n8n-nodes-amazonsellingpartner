import { EventEmitter } from 'events';

export interface Metric {
	name: string;
	value: number;
	timestamp: Date;
	tags?: Record<string, string>;
}

export interface HealthCheckResult {
	status: 'healthy' | 'unhealthy' | 'degraded';
	timestamp: Date;
	checks: {
		[key: string]: {
			status: 'pass' | 'fail' | 'warn';
			message?: string;
			duration?: number;
		};
	};
}

export interface UsageStats {
	totalRequests: number;
	successfulRequests: number;
	failedRequests: number;
	averageResponseTime: number;
	requestsByEndpoint: Record<string, number>;
	errorsByType: Record<string, number>;
	rateLimitHits: number;
	lastResetTime: Date;
}

export class MetricsCollector extends EventEmitter {
	private metrics: Metric[] = [];
	private usageStats: UsageStats;
	private readonly maxMetricsHistory = 1000;
	private healthCheckInterval?: NodeJS.Timeout;

	constructor() {
		super();
		this.usageStats = this.initializeUsageStats();
		this.startHealthCheckMonitoring();
	}

	private initializeUsageStats(): UsageStats {
		return {
			totalRequests: 0,
			successfulRequests: 0,
			failedRequests: 0,
			averageResponseTime: 0,
			requestsByEndpoint: {},
			errorsByType: {},
			rateLimitHits: 0,
			lastResetTime: new Date(),
		};
	}

	/**
	 * Record a performance metric
	 */
	recordMetric(name: string, value: number, tags?: Record<string, string>): void {
		const metric: Metric = {
			name,
			value,
			timestamp: new Date(),
			tags,
		};

		this.metrics.push(metric);

		// Keep only recent metrics to prevent memory bloat
		if (this.metrics.length > this.maxMetricsHistory) {
			this.metrics = this.metrics.slice(-this.maxMetricsHistory);
		}

		this.emit('metric', metric);
	}

	/**
	 * Record API request metrics
	 */
	recordApiRequest(endpoint: string, duration: number, success: boolean, errorType?: string): void {
		this.usageStats.totalRequests++;
		
		if (success) {
			this.usageStats.successfulRequests++;
		} else {
			this.usageStats.failedRequests++;
			if (errorType) {
				this.usageStats.errorsByType[errorType] = (this.usageStats.errorsByType[errorType] || 0) + 1;
			}
		}

		// Update average response time
		const totalResponseTime = this.usageStats.averageResponseTime * (this.usageStats.totalRequests - 1) + duration;
		this.usageStats.averageResponseTime = totalResponseTime / this.usageStats.totalRequests;

		// Track endpoint usage
		this.usageStats.requestsByEndpoint[endpoint] = (this.usageStats.requestsByEndpoint[endpoint] || 0) + 1;

		// Record individual metrics
		this.recordMetric('api_request_duration', duration, { endpoint, success: success.toString() });
		this.recordMetric('api_request_count', 1, { endpoint, success: success.toString() });
	}

	/**
	 * Record rate limit hit
	 */
	recordRateLimitHit(endpoint: string): void {
		this.usageStats.rateLimitHits++;
		this.recordMetric('rate_limit_hit', 1, { endpoint });
		this.emit('rateLimitHit', { endpoint, timestamp: new Date() });
	}

	/**
	 * Perform comprehensive health check
	 */
	async performHealthCheck(): Promise<HealthCheckResult> {
		const result: HealthCheckResult = {
			status: 'healthy',
			timestamp: new Date(),
			checks: {},
		};

		// Check memory usage
		const memoryUsage = process.memoryUsage();
		const memoryThreshold = 500 * 1024 * 1024; // 500MB
		result.checks.memory = {
			status: memoryUsage.heapUsed < memoryThreshold ? 'pass' : 'warn',
			message: `Heap used: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
		};

		// Check error rate
		const errorRate = this.usageStats.totalRequests > 0 
			? this.usageStats.failedRequests / this.usageStats.totalRequests 
			: 0;
		result.checks.errorRate = {
			status: errorRate < 0.05 ? 'pass' : errorRate < 0.1 ? 'warn' : 'fail',
			message: `Error rate: ${(errorRate * 100).toFixed(2)}%`,
		};

		// Check average response time
		result.checks.responseTime = {
			status: this.usageStats.averageResponseTime < 2000 ? 'pass' 
				: this.usageStats.averageResponseTime < 5000 ? 'warn' : 'fail',
			message: `Average response time: ${this.usageStats.averageResponseTime.toFixed(0)}ms`,
		};

		// Check rate limit hits
		const rateLimitRate = this.usageStats.totalRequests > 0 
			? this.usageStats.rateLimitHits / this.usageStats.totalRequests 
			: 0;
		result.checks.rateLimits = {
			status: rateLimitRate < 0.01 ? 'pass' : rateLimitRate < 0.05 ? 'warn' : 'fail',
			message: `Rate limit hit rate: ${(rateLimitRate * 100).toFixed(2)}%`,
		};

		// Determine overall status
		const hasFailures = Object.values(result.checks).some(check => check.status === 'fail');
		const hasWarnings = Object.values(result.checks).some(check => check.status === 'warn');

		if (hasFailures) {
			result.status = 'unhealthy';
		} else if (hasWarnings) {
			result.status = 'degraded';
		}

		this.emit('healthCheck', result);
		return result;
	}

	/**
	 * Get current usage statistics
	 */
	getUsageStats(): UsageStats {
		return { ...this.usageStats };
	}

	/**
	 * Get recent metrics
	 */
	getMetrics(limit?: number): Metric[] {
		return limit ? this.metrics.slice(-limit) : [...this.metrics];
	}

	/**
	 * Reset usage statistics
	 */
	resetStats(): void {
		this.usageStats = this.initializeUsageStats();
		this.metrics = [];
		this.emit('statsReset', new Date());
	}

	/**
	 * Get metrics summary for a specific time window
	 */
	getMetricsSummary(timeWindowMs: number = 300000): Record<string, any> { // Default 5 minutes
		const cutoffTime = new Date(Date.now() - timeWindowMs);
		const recentMetrics = this.metrics.filter(metric => metric.timestamp >= cutoffTime);

		const summary: Record<string, any> = {};

		for (const metric of recentMetrics) {
			if (!summary[metric.name]) {
				summary[metric.name] = {
					count: 0,
					sum: 0,
					min: Number.MAX_VALUE,
					max: Number.MIN_VALUE,
					avg: 0,
				};
			}

			const metricSummary = summary[metric.name];
			metricSummary.count++;
			metricSummary.sum += metric.value;
			metricSummary.min = Math.min(metricSummary.min, metric.value);
			metricSummary.max = Math.max(metricSummary.max, metric.value);
			metricSummary.avg = metricSummary.sum / metricSummary.count;
		}

		return summary;
	}

	/**
	 * Start automatic health check monitoring
	 */
	private startHealthCheckMonitoring(): void {
		// Perform health check every 5 minutes
		this.healthCheckInterval = setInterval(async () => {
			try {
				await this.performHealthCheck();
			} catch (error) {
				this.emit('error', error);
			}
		}, 5 * 60 * 1000);
	}

	/**
	 * Stop health check monitoring
	 */
	stopMonitoring(): void {
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval);
			this.healthCheckInterval = undefined;
		}
	}

	/**
	 * Export metrics in Prometheus format
	 */
	exportPrometheusMetrics(): string {
		const lines: string[] = [];
		const metricGroups: Record<string, Metric[]> = {};

		// Group metrics by name
		for (const metric of this.metrics) {
			if (!metricGroups[metric.name]) {
				metricGroups[metric.name] = [];
			}
			metricGroups[metric.name].push(metric);
		}

		// Generate Prometheus format
		for (const [metricName, metrics] of Object.entries(metricGroups)) {
			const sanitizedName = metricName.replace(/[^a-zA-Z0-9_]/g, '_');
			lines.push(`# TYPE ${sanitizedName} gauge`);

			for (const metric of metrics) {
				let line = `${sanitizedName}`;
				
				if (metric.tags && Object.keys(metric.tags).length > 0) {
					const tagPairs = Object.entries(metric.tags)
						.map(([key, value]) => `${key}="${value}"`)
						.join(',');
					line += `{${tagPairs}}`;
				}
				
				line += ` ${metric.value} ${metric.timestamp.getTime()}`;
				lines.push(line);
			}
		}

		return lines.join('\n');
	}
}

// Singleton instance
export const metricsCollector = new MetricsCollector(); 