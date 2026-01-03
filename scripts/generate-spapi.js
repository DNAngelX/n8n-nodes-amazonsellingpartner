#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const GENERATED_DIR = path.join(ROOT_DIR, 'nodes', 'AmazonSellingPartner', 'generated');
const GENERATED_FILE = path.join(GENERATED_DIR, 'Generated.description.ts');
const TAR_URL = 'https://codeload.github.com/amzn/selling-partner-api-models/tar.gz/refs/heads/main';
const TAR_ROOT_DIR = 'selling-partner-api-models-main';

const DEFAULT_MARKETPLACE_ID = 'A1PA6795UKMFR9';

const MARKETPLACE_OPTIONS = [
	{ name: 'United States (amazon.com)', value: 'ATVPDKIKX0DER' },
	{ name: 'Canada (amazon.ca)', value: 'A2EUQ1WTGCTBG2' },
	{ name: 'Mexico (amazon.com.mx)', value: 'A1AM78C64UM0Y8' },
	{ name: 'Brazil (amazon.com.br)', value: 'A2Q3Y263D00KWC' },
	{ name: 'United Kingdom (amazon.co.uk)', value: 'A1F83G8C2ARO7P' },
	{ name: 'Germany (amazon.de)', value: 'A1PA6795UKMFR9' },
	{ name: 'France (amazon.fr)', value: 'A13V1IB3VIYZZH' },
	{ name: 'Italy (amazon.it)', value: 'APJ6JRA9NG5V4' },
	{ name: 'Spain (amazon.es)', value: 'A1RKKUPIHCS9HS' },
	{ name: 'Netherlands (amazon.nl)', value: 'A1805IZSGTT6HS' },
	{ name: 'Poland (amazon.pl)', value: 'A1C3SOZRARQ6R3' },
	{ name: 'Sweden (amazon.se)', value: 'A2NODRKZP88ZB9' },
	{ name: 'Belgium (amazon.com.be)', value: 'AMEN7PMS3EDWL' },
	{ name: 'India (amazon.in)', value: 'A21TJRUUN4KGV' },
	{ name: 'Turkey (amazon.com.tr)', value: 'A33AVAJ2PDY3EV' },
	{ name: 'United Arab Emirates (amazon.ae)', value: 'A2VIGQ35RCS4UG' },
	{ name: 'Saudi Arabia (amazon.sa)', value: 'A17E79C6D8DWNP' },
	{ name: 'Egypt (amazon.eg)', value: 'ARBP9OOSHTCHU' },
	{ name: 'Japan (amazon.co.jp)', value: 'A1VC38T7YXB528' },
	{ name: 'Australia (amazon.com.au)', value: 'A39IBJ37TRP1C6' },
	{ name: 'Singapore (amazon.sg)', value: 'A19VAU5U5O7RUS' },
];

const httpMethods = ['get', 'post', 'put', 'patch', 'delete'];

const downloadFile = (url, destination) => new Promise((resolve, reject) => {
	const file = fs.createWriteStream(destination);
	https.get(url, (response) => {
		if (response.statusCode && response.statusCode >= 400) {
			reject(new Error(`Failed to download ${url}. Status code: ${response.statusCode}`));
			return;
		}
		response.pipe(file);
		file.on('finish', () => file.close(resolve));
	}).on('error', (error) => {
		fs.unlink(destination, () => reject(error));
	});
});

const walkFiles = (dir, fileList = []) => {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			walkFiles(fullPath, fileList);
		} else if (entry.isFile()) {
			fileList.push(fullPath);
		}
	}
	return fileList;
};

const toTitleCase = (input) => input
	.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
	.replace(/[-_]+/g, ' ')
	.replace(/\s+/g, ' ')
	.trim()
	.split(' ')
	.map((word) => word ? word[0].toUpperCase() + word.slice(1) : '')
	.join(' ');

const toCamelCase = (input) => {
	const words = input
		.replace(/[-_]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.split(' ');
	const [first, ...rest] = words;
	if (!first) return '';
	return first.toLowerCase() + rest.map((word) => word ? word[0].toUpperCase() + word.slice(1) : '').join('');
};

const normalizeResourceName = (folderName) => {
	let base = folderName
		.replace(/-api-model$/i, '')
		.replace(/-model$/i, '')
		.replace(/-api$/i, '')
		.replace(/-swagger$/i, '');
	if (!base) base = folderName;
	return {
		value: toCamelCase(base),
		name: toTitleCase(base),
		base,
	};
};

const sanitizeOperationValue = (value) => value.replace(/[^a-zA-Z0-9]+/g, '_');

const extractVersionTag = (doc, filePath) => {
	if (doc && doc.info && typeof doc.info.version === 'string') {
		return doc.info.version;
	}
	const base = path.basename(filePath, '.json');
	return base;
};

const mergeParameters = (pathParameters, operationParameters) => {
	const merged = [];
	const addParam = (param) => {
		if (!param || !param.name || !param.in) return;
		if (!merged.find((existing) => existing.name === param.name && existing.in === param.in)) {
			merged.push(param);
		}
	};
	(pathParameters || []).forEach(addParam);
	(operationParameters || []).forEach(addParam);
	return merged;
};

const extractEnum = (param) => {
	if (!param) return undefined;
	if (Array.isArray(param.enum)) return param.enum;
	if (param.items && Array.isArray(param.items.enum)) return param.items.enum;
	return undefined;
};

const deriveParamType = (param) => {
	if (!param) return { type: 'string', isArray: false };
	if (param.type === 'array') {
		const itemType = param.items && param.items.type ? param.items.type : 'string';
		return { type: itemType, isArray: true };
	}
	return { type: param.type || 'string', isArray: false };
};

const main = async () => {
	fs.mkdirSync(GENERATED_DIR, { recursive: true });

	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spapi-models-'));
	const tarPath = path.join(tempDir, 'models.tar.gz');
	const extractDir = path.join(tempDir, 'extract');
	fs.mkdirSync(extractDir, { recursive: true });

	console.log('Downloading SP-API models...');
	await downloadFile(TAR_URL, tarPath);
	console.log('Extracting models...');
	execSync(`tar -xzf "${tarPath}" -C "${extractDir}"`);

	const modelsDir = path.join(extractDir, TAR_ROOT_DIR, 'models');
	if (!fs.existsSync(modelsDir)) {
		throw new Error(`Models directory not found: ${modelsDir}`);
	}

	const jsonFiles = walkFiles(modelsDir).filter((file) => file.endsWith('.json'));
	const resources = new Map();

	for (const filePath of jsonFiles) {
		const docRaw = fs.readFileSync(filePath, 'utf8');
		let doc;
		try {
			doc = JSON.parse(docRaw);
		} catch (error) {
			console.warn(`Skipping invalid JSON: ${filePath}`);
			continue;
		}
		if (!doc.paths || typeof doc.paths !== 'object') {
			continue;
		}

		const folderName = path.basename(path.dirname(filePath));
		const resourceInfo = normalizeResourceName(folderName);
		if (!resourceInfo.value) continue;
		const resourceKey = resourceInfo.value;

		if (!resources.has(resourceKey)) {
			resources.set(resourceKey, {
				name: resourceInfo.name,
				value: resourceInfo.value,
				base: resourceInfo.base,
				infoTitle: doc.info && doc.info.title ? doc.info.title : resourceInfo.name,
				operations: new Map(),
				operationList: [],
			});
		}

		const resourceEntry = resources.get(resourceKey);
		const versionTag = extractVersionTag(doc, filePath);

		Object.entries(doc.paths).forEach(([endpoint, pathItem]) => {
			if (!pathItem || typeof pathItem !== 'object') return;
			const pathParameters = pathItem.parameters || [];
			httpMethods.forEach((method) => {
				const operation = pathItem[method];
				if (!operation || typeof operation !== 'object') return;
				const operationId = operation.operationId || `${method}${endpoint}`;
				const opParameters = mergeParameters(pathParameters, operation.parameters);
				const params = opParameters
					.filter((param) => param && param.in && param.name)
					.filter((param) => ['path', 'query', 'body'].includes(param.in))
					.map((param) => {
						const enumValues = extractEnum(param);
						const derivedType = deriveParamType(param);
						return {
							name: param.name,
							in: param.in,
							description: param.description || '',
							required: !!param.required,
							type: derivedType.type,
							isArray: derivedType.isArray,
							enumValues,
						};
					});

				resourceEntry.operationList.push({
					operationId,
					endpoint,
					method: method.toUpperCase(),
					summary: operation.summary || '',
					description: operation.description || '',
					version: versionTag,
					params,
					hasBody: params.some((param) => param.in === 'body'),
				});
			});
		});
	}

	const resourceOptions = [];
	const operationsProperties = [];
	const fieldProperties = [];
	const operationMap = {};

	for (const resourceEntry of resources.values()) {
		resourceOptions.push({
			name: resourceEntry.name,
			value: resourceEntry.value,
			description: resourceEntry.infoTitle,
		});

		const byOperationId = new Map();
		resourceEntry.operationList.forEach((op) => {
			if (!byOperationId.has(op.operationId)) {
				byOperationId.set(op.operationId, []);
			}
			byOperationId.get(op.operationId).push(op);
		});

		const operationOptions = [];
		operationMap[resourceEntry.value] = {};

		byOperationId.forEach((ops, operationId) => {
			const needsVersion = ops.length > 1;
			ops.forEach((op) => {
				const versionTag = needsVersion ? op.version : '';
				const operationValue = sanitizeOperationValue(needsVersion ? `${operationId}_${versionTag}` : operationId);
				const displayName = needsVersion
					? `${toTitleCase(operationId)} (${versionTag})`
					: toTitleCase(operationId);
				const description = op.summary || op.description || '';
				operationOptions.push({
					name: displayName,
					value: operationValue,
					description,
				});
				operationMap[resourceEntry.value][operationValue] = {
					method: op.method,
					endpoint: op.endpoint,
					params: op.params,
					hasBody: op.hasBody,
				};
			});
		});

		operationOptions.sort((a, b) => a.name.localeCompare(b.name));

		operationsProperties.push({
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			noDataExpression: true,
			displayOptions: {
				show: {
					resource: [resourceEntry.value],
				},
			},
			options: operationOptions,
			default: operationOptions.length ? operationOptions[0].value : '',
		});

		fieldProperties.push({
			displayName: 'Response Type',
			name: 'responseType',
			type: 'options',
			options: [
				{ name: 'JSON', value: 'json' },
				{ name: 'Text', value: 'text' },
				{ name: 'Stream', value: 'stream' },
			],
			default: 'json',
			displayOptions: {
				show: {
					resource: [resourceEntry.value],
				},
			},
			description: 'Response handling for this request.',
		});

		operationOptions.forEach((operationOption) => {
			const opMeta = operationMap[resourceEntry.value][operationOption.value];
			if (!opMeta) return;

			const params = opMeta.params || [];
			params.forEach((param) => {
				if (param.in === 'body') {
					return;
				}

				const isMarketplaceParam = param.name === 'marketplaceId' || param.name === 'marketplaceIds';
				const enumValues = param.enumValues;
				const hasEnum = Array.isArray(enumValues) && enumValues.length > 0;

				let type = 'string';
				let options = undefined;
				let defaultValue = '';
				let description = param.description || '';

				if (isMarketplaceParam) {
					if (param.isArray) {
						type = 'multiOptions';
						options = MARKETPLACE_OPTIONS;
						defaultValue = [DEFAULT_MARKETPLACE_ID];
					} else {
						type = 'options';
						options = MARKETPLACE_OPTIONS;
						defaultValue = DEFAULT_MARKETPLACE_ID;
					}
				} else if (param.isArray && hasEnum) {
					type = 'multiOptions';
					options = enumValues.map((value) => ({ name: String(value), value }));
					defaultValue = [];
				} else if (!param.isArray && hasEnum) {
					type = 'options';
					options = enumValues.map((value) => ({ name: String(value), value }));
					defaultValue = '';
				} else if (param.isArray) {
					type = 'string';
					defaultValue = '';
					if (!description) {
						description = 'Comma-separated values.';
					}
				} else if (!description && (param.type === 'integer' || param.type === 'number')) {
					description = 'Numeric value.';
				} else if (!description && param.type === 'boolean') {
					description = 'Use true or false.';
				}

				const field = {
					displayName: toTitleCase(param.name),
					name: param.name,
					type,
					required: !!param.required,
					displayOptions: {
						show: {
							resource: [resourceEntry.value],
							operation: [operationOption.value],
						},
					},
					default: defaultValue,
					description,
				};

				if (options) {
					field.options = options;
				}

				fieldProperties.push(field);
			});

			if (opMeta.hasBody) {
				fieldProperties.push({
					displayName: 'Body (JSON)',
					name: 'bodyJson',
					type: 'json',
					displayOptions: {
						show: {
							resource: [resourceEntry.value],
							operation: [operationOption.value],
						},
					},
					default: '{}',
					description: 'JSON body for this request.',
				});
			}
		});
	}

	resourceOptions.sort((a, b) => a.name.localeCompare(b.name));

	const fileContents = `import type { INodeProperties } from 'n8n-workflow';\n\n` +
		`export const generatedResourceOptions = ${JSON.stringify(resourceOptions, null, 2)};\n\n` +
		`export const generatedOperations: INodeProperties[] = ${JSON.stringify(operationsProperties, null, 2)};\n\n` +
		`export const generatedFields: INodeProperties[] = ${JSON.stringify(fieldProperties, null, 2)};\n\n` +
		`export const generatedOperationMap = ${JSON.stringify(operationMap, null, 2)};\n`;

	fs.writeFileSync(GENERATED_FILE, fileContents, 'utf8');
	console.log(`Generated ${GENERATED_FILE}`);
};

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
