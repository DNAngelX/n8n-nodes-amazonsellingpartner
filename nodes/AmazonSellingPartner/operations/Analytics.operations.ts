import {
	IExecuteFunctions,
	INodeExecutionData,
	NodeOperationError,
} from 'n8n-workflow';
import { SpApiRequest } from '../helpers/SpApiRequest';
import { auditLogger } from '../core/AuditLogger';

// Main execution function
export async function executeAnalyticsOperation(
	this: IExecuteFunctions,
	operation: string,
	index: number,
): Promise<INodeExecutionData[]> {
	switch (operation) {
		case 'validateAccess':
			return await validateAnalyticsAccess.call(this, index);
		default:
			throw new NodeOperationError(this.getNode(), `Unknown analytics operation: ${operation}`);
	}
}

// Validate Analytics Access
async function validateAnalyticsAccess(
	this: IExecuteFunctions,
	_index: number,
): Promise<INodeExecutionData[]> {
	const nodeId = this.getNode().id;
	
    try {
        let dataKioskAccess = false;
        let reportsAccess = false;
        const errors: string[] = [];

        // Probe Data Kiosk access (lightweight query)
        try {
            await SpApiRequest.makeRequest(this, {
                method: 'GET',
                endpoint: '/dataKiosk/2023-11-15/queries',
                query: { pageSize: 1 },
            });
            dataKioskAccess = true;
        } catch (error) {
            errors.push(`Data Kiosk: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Probe Reports API access
        try {
            await SpApiRequest.makeRequest(this, {
                method: 'GET',
                endpoint: '/reports/2021-06-30/reports',
                query: { reportTypes: 'GET_SALES_AND_TRAFFIC_REPORT' },
            });
            reportsAccess = true;
        } catch (error) {
            errors.push(`Reports API: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        const result = {
            success: dataKioskAccess || reportsAccess,
            dataKioskAccess,
            reportsAccess,
            recommendedMode: dataKioskAccess ? 'dataKiosk' : reportsAccess ? 'reports' : 'none',
            errors: errors.length > 0 ? errors : undefined,
            timestamp: new Date().toISOString(),
        };

		auditLogger.logEvent({
			nodeId,
			action: 'analytics_access_validation',
			resource: 'analytics',
			details: result,
			severity: result.success ? 'low' : 'high',
			source: 'system',
			outcome: result.success ? 'success' : 'failure',
		});

		return [{ json: result }];
	} catch (error) {
		throw new NodeOperationError(
			this.getNode(),
			`Failed to validate analytics access: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}








