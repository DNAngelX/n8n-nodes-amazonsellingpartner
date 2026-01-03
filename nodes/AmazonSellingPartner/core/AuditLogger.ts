import { EventEmitter } from 'events';

export interface AuditEvent {
	id: string;
	timestamp: Date;
	userId?: string;
	nodeId: string;
	action: string;
	resource: string;
	details: Record<string, any>;
	severity: 'low' | 'medium' | 'high' | 'critical';
	source: 'user' | 'system' | 'api';
	outcome: 'success' | 'failure' | 'warning';
	ipAddress?: string;
	userAgent?: string;
}

export interface SecurityEvent extends AuditEvent {
	threatLevel: 'low' | 'medium' | 'high' | 'critical';
	attackVector?: string;
	mitigationAction?: string;
}

export interface AlertRule {
	id: string;
	name: string;
	condition: (event: AuditEvent) => boolean;
	severity: 'low' | 'medium' | 'high' | 'critical';
	enabled: boolean;
	cooldownMs: number;
	lastTriggered?: Date;
}

export class AuditLogger extends EventEmitter {
	private events: AuditEvent[] = [];
	private securityEvents: SecurityEvent[] = [];
	private alertRules: AlertRule[] = [];
	private readonly maxEventsHistory = 10000;
	private readonly maxSecurityEventsHistory = 1000;

	constructor() {
		super();
		this.initializeDefaultAlertRules();
	}

	/**
	 * Log an audit event
	 */
	logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): void {
		const auditEvent: AuditEvent = {
			...event,
			id: this.generateEventId(),
			timestamp: new Date(),
		};

		this.events.push(auditEvent);

		// Keep only recent events to prevent memory bloat
		if (this.events.length > this.maxEventsHistory) {
			this.events = this.events.slice(-this.maxEventsHistory);
		}

		// Check alert rules
		this.checkAlertRules(auditEvent);

		// Emit event for external listeners
		this.emit('auditEvent', auditEvent);

		// Log to console for development (can be replaced with proper logging)
		console.log(`[AUDIT] ${auditEvent.severity.toUpperCase()}: ${auditEvent.action} on ${auditEvent.resource} - ${auditEvent.outcome}`);
	}

	/**
	 * Log a security-specific event
	 */
	logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): void {
		const securityEvent: SecurityEvent = {
			...event,
			id: this.generateEventId(),
			timestamp: new Date(),
		};

		this.securityEvents.push(securityEvent);

		// Keep only recent security events
		if (this.securityEvents.length > this.maxSecurityEventsHistory) {
			this.securityEvents = this.securityEvents.slice(-this.maxSecurityEventsHistory);
		}

		// Also log as regular audit event
		this.logEvent(securityEvent);

		// Emit security-specific event
		this.emit('securityEvent', securityEvent);

		// Immediate alert for high/critical security events
		if (securityEvent.threatLevel === 'high' || securityEvent.threatLevel === 'critical') {
			this.triggerSecurityAlert(securityEvent);
		}
	}

	/**
	 * Log API access attempt
	 */
	logApiAccess(nodeId: string, endpoint: string, success: boolean, details: Record<string, any> = {}): void {
		this.logEvent({
			nodeId,
			action: 'api_access',
			resource: endpoint,
			details: {
				endpoint,
				...details,
			},
			severity: success ? 'low' : 'medium',
			source: 'api',
			outcome: success ? 'success' : 'failure',
		});
	}

	/**
	 * Log credential usage
	 */
	logCredentialUsage(nodeId: string, credentialType: string, success: boolean, details: Record<string, any> = {}): void {
		this.logEvent({
			nodeId,
			action: 'credential_usage',
			resource: credentialType,
			details: {
				credentialType,
				...details,
			},
			severity: success ? 'low' : 'high',
			source: 'system',
			outcome: success ? 'success' : 'failure',
		});
	}

	/**
	 * Log authentication event
	 */
	logAuthentication(nodeId: string, method: string, success: boolean, details: Record<string, any> = {}): void {
		this.logEvent({
			nodeId,
			action: 'authentication',
			resource: method,
			details: {
				method,
				...details,
			},
			severity: success ? 'low' : 'high',
			source: 'system',
			outcome: success ? 'success' : 'failure',
		});
	}

	/**
	 * Log rate limiting event
	 */
	logRateLimit(nodeId: string, endpoint: string, details: Record<string, any> = {}): void {
		this.logEvent({
			nodeId,
			action: 'rate_limit_hit',
			resource: endpoint,
			details: {
				endpoint,
				...details,
			},
			severity: 'medium',
			source: 'system',
			outcome: 'warning',
		});
	}

	/**
	 * Log error event
	 */
	logError(nodeId: string, error: Error, context: Record<string, any> = {}): void {
		this.logEvent({
			nodeId,
			action: 'error_occurred',
			resource: 'system',
			details: {
				errorMessage: error.message,
				errorStack: error.stack,
				errorName: error.name,
				...context,
			},
			severity: 'high',
			source: 'system',
			outcome: 'failure',
		});
	}

	/**
	 * Log suspicious activity
	 */
	logSuspiciousActivity(nodeId: string, activity: string, details: Record<string, any> = {}): void {
		this.logSecurityEvent({
			nodeId,
			action: 'suspicious_activity',
			resource: 'security',
			details: {
				activity,
				...details,
			},
			severity: 'high',
			source: 'system',
			outcome: 'warning',
			threatLevel: 'medium',
			attackVector: details.attackVector,
		});
	}

	/**
	 * Get audit events with optional filtering
	 */
	getEvents(filter?: {
		severity?: string[];
		action?: string[];
		resource?: string[];
		outcome?: string[];
		timeRange?: { start: Date; end: Date };
		limit?: number;
	}): AuditEvent[] {
		let filteredEvents = [...this.events];

		if (filter) {
			if (filter.severity) {
				filteredEvents = filteredEvents.filter(event => filter.severity!.includes(event.severity));
			}
			if (filter.action) {
				filteredEvents = filteredEvents.filter(event => filter.action!.includes(event.action));
			}
			if (filter.resource) {
				filteredEvents = filteredEvents.filter(event => filter.resource!.includes(event.resource));
			}
			if (filter.outcome) {
				filteredEvents = filteredEvents.filter(event => filter.outcome!.includes(event.outcome));
			}
			if (filter.timeRange) {
				filteredEvents = filteredEvents.filter(event => 
					event.timestamp >= filter.timeRange!.start && 
					event.timestamp <= filter.timeRange!.end
				);
			}
			if (filter.limit) {
				filteredEvents = filteredEvents.slice(-filter.limit);
			}
		}

		return filteredEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
	}

	/**
	 * Get security events
	 */
	getSecurityEvents(limit?: number): SecurityEvent[] {
		const events = limit ? this.securityEvents.slice(-limit) : [...this.securityEvents];
		return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
	}

	/**
	 * Add custom alert rule
	 */
	addAlertRule(rule: AlertRule): void {
		this.alertRules.push(rule);
	}

	/**
	 * Remove alert rule
	 */
	removeAlertRule(ruleId: string): void {
		this.alertRules = this.alertRules.filter(rule => rule.id !== ruleId);
	}

	/**
	 * Get statistics summary
	 */
	getStatistics(timeWindowMs: number = 24 * 60 * 60 * 1000): Record<string, any> { // Default 24 hours
		const cutoffTime = new Date(Date.now() - timeWindowMs);
		const recentEvents = this.events.filter(event => event.timestamp >= cutoffTime);

		const stats = {
			totalEvents: recentEvents.length,
			eventsBySeverity: {} as Record<string, number>,
			eventsByAction: {} as Record<string, number>,
			eventsByOutcome: {} as Record<string, number>,
			securityEvents: this.securityEvents.filter(event => event.timestamp >= cutoffTime).length,
			errorRate: 0,
			timeWindow: timeWindowMs,
		};

		for (const event of recentEvents) {
			stats.eventsBySeverity[event.severity] = (stats.eventsBySeverity[event.severity] || 0) + 1;
			stats.eventsByAction[event.action] = (stats.eventsByAction[event.action] || 0) + 1;
			stats.eventsByOutcome[event.outcome] = (stats.eventsByOutcome[event.outcome] || 0) + 1;
		}

		const failureEvents = stats.eventsByOutcome.failure || 0;
		stats.errorRate = recentEvents.length > 0 ? failureEvents / recentEvents.length : 0;

		return stats;
	}

	/**
	 * Export events for external analysis
	 */
	exportEvents(format: 'json' | 'csv' = 'json', filter?: Parameters<typeof this.getEvents>[0]): string {
		const events = this.getEvents(filter);

		if (format === 'csv') {
			const headers = ['id', 'timestamp', 'nodeId', 'action', 'resource', 'severity', 'source', 'outcome'];
			const csvLines = [headers.join(',')];
			
			for (const event of events) {
				const row = [
					event.id,
					event.timestamp.toISOString(),
					event.nodeId,
					event.action,
					event.resource,
					event.severity,
					event.source,
					event.outcome,
				];
				csvLines.push(row.join(','));
			}
			
			return csvLines.join('\n');
		}

		return JSON.stringify(events, null, 2);
	}

	private generateEventId(): string {
		return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	private initializeDefaultAlertRules(): void {
		this.alertRules = [
			{
				id: 'high_error_rate',
				name: 'High Error Rate',
				condition: (_event) => {
					const recentEvents = this.events.filter(e => 
						e.timestamp.getTime() > Date.now() - 5 * 60 * 1000 // Last 5 minutes
					);
					const errorEvents = recentEvents.filter(e => e.outcome === 'failure');
					return errorEvents.length > 10; // More than 10 errors in 5 minutes
				},
				severity: 'high',
				enabled: true,
				cooldownMs: 15 * 60 * 1000, // 15 minutes cooldown
			},
			{
				id: 'repeated_auth_failures',
				name: 'Repeated Authentication Failures',
				condition: (event) => {
					if (event.action !== 'authentication' || event.outcome !== 'failure') return false;
					const recentAuthFailures = this.events.filter(e => 
						e.action === 'authentication' && 
						e.outcome === 'failure' &&
						e.nodeId === event.nodeId &&
						e.timestamp.getTime() > Date.now() - 10 * 60 * 1000 // Last 10 minutes
					);
					return recentAuthFailures.length >= 5; // 5 failures in 10 minutes
				},
				severity: 'critical',
				enabled: true,
				cooldownMs: 30 * 60 * 1000, // 30 minutes cooldown
			},
			{
				id: 'credential_usage_failure',
				name: 'Credential Usage Failure',
				condition: (event) => event.action === 'credential_usage' && event.outcome === 'failure',
				severity: 'high',
				enabled: true,
				cooldownMs: 5 * 60 * 1000, // 5 minutes cooldown
			},
		];
	}

	private checkAlertRules(event: AuditEvent): void {
		for (const rule of this.alertRules) {
			if (!rule.enabled) continue;

			// Check cooldown
			if (rule.lastTriggered && Date.now() - rule.lastTriggered.getTime() < rule.cooldownMs) {
				continue;
			}

			try {
				if (rule.condition(event)) {
					this.triggerAlert(rule, event);
					rule.lastTriggered = new Date();
				}
			} catch (error) {
				console.error(`Error checking alert rule ${rule.id}:`, error);
			}
		}
	}

	private triggerAlert(rule: AlertRule, event: AuditEvent): void {
		const alert = {
			ruleId: rule.id,
			ruleName: rule.name,
			severity: rule.severity,
			triggeredBy: event,
			timestamp: new Date(),
		};

		this.emit('alert', alert);
		console.warn(`[ALERT] ${rule.name} (${rule.severity.toUpperCase()}): Triggered by ${event.action} on ${event.resource}`);
	}

	private triggerSecurityAlert(event: SecurityEvent): void {
		const alert = {
			type: 'security',
			severity: event.threatLevel,
			event,
			timestamp: new Date(),
		};

		this.emit('securityAlert', alert);
		console.error(`[SECURITY ALERT] ${event.threatLevel.toUpperCase()}: ${event.action} - ${event.details.activity || event.resource}`);
	}
}

// Singleton instance
export const auditLogger = new AuditLogger(); 