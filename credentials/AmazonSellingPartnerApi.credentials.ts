import type { Icon, ICredentialType, ILoadOptionsFunctions, INodeProperties } from 'n8n-workflow';

export class AmazonSellingPartnerApi implements ICredentialType {
	name = 'amazonSellingPartnerApi';

	displayName = 'Amazon Selling Partner API';

	icon: Icon = { light: 'file:../icons/amazon-sp.svg', dark: 'file:../icons/amazon-sp.dark.svg' };

	documentationUrl = 'https://developer-docs.amazon.com/sp-api/docs/connecting-to-the-selling-partner-api';

	methods = {
		loadOptions: {
			async getMarketplaceCountries(this: ILoadOptionsFunctions) {
				const region = this.getCurrentNodeParameter('marketplaceRegion') as string;
				const regionOptions: Record<string, Array<{ name: string; value: string }>> = {
					northAmerica: [
						{ name: 'United States', value: 'US' },
						{ name: 'Canada', value: 'CA' },
						{ name: 'Mexico', value: 'MX' },
						{ name: 'Brazil', value: 'BR' },
					],
					europe: [
						{ name: 'United Kingdom', value: 'GB' },
						{ name: 'Germany', value: 'DE' },
						{ name: 'France', value: 'FR' },
						{ name: 'Italy', value: 'IT' },
						{ name: 'Spain', value: 'ES' },
						{ name: 'Netherlands', value: 'NL' },
						{ name: 'Sweden', value: 'SE' },
						{ name: 'Poland', value: 'PL' },
						{ name: 'Belgium', value: 'BE' },
						{ name: 'Turkey', value: 'TR' },
						{ name: 'United Arab Emirates', value: 'AE' },
						{ name: 'Saudi Arabia', value: 'SA' },
					],
					farEast: [
						{ name: 'India', value: 'IN' },
						{ name: 'Japan', value: 'JP' },
						{ name: 'Australia', value: 'AU' },
						{ name: 'Singapore', value: 'SG' },
					],
				};

				return regionOptions[region] ?? regionOptions.europe;
			},
		},
	};

	properties: INodeProperties[] = [
		{
			displayName: 'Marketplace Region',
			name: 'marketplaceRegion',
			type: 'options',
			options: [
				{
					name: 'North America',
					value: 'northAmerica',
				},
				{
					name: 'Europe',
					value: 'europe',
				},
				{
					name: 'Far East',
					value: 'farEast',
				},
			],
			default: 'europe',
			required: true,
		},
		{
			displayName: 'Marketplace Country',
			name: 'marketplaceCountry',
			type: 'options',
			typeOptions: {
				loadOptionsDependsOn: ['marketplaceRegion'],
				loadOptionsMethod: 'getMarketplaceCountries',
			},
			default: 'DE',
			required: true,
		},
		{
			displayName: 'Application ID',
			name: 'applicationId',
			type: 'string',
			default: '',
			description: 'SP-API application ID used to authorize the app in Seller Central',
		},
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			required: true,
			description: 'Login with Amazon client ID',
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Login with Amazon client secret',
		},
		{
			displayName: 'Refresh Token',
			name: 'refreshToken',
			type: 'string',
			default: '',
			required: true,
			description: 'Generate in Seller Central under App authorizations',
		},
		{
			displayName: 'AWS Access Key ID',
			name: 'awsAccessKeyId',
			type: 'string',
			default: '',
			required: true,
			description: 'IAM user access key for SigV4 signing',
		},
		{
			displayName: 'AWS Secret Access Key',
			name: 'awsSecretAccessKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'IAM user secret key for SigV4 signing',
		},
		{
			displayName: 'Sandbox Mode',
			name: 'sandbox',
			type: 'boolean',
			default: false,
		},
		{
			displayName: 'Draft Mode',
			name: 'draft',
			type: 'boolean',
			default: false,
		},
	];
}
