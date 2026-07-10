import { createHmac } from 'crypto';
import { NodeOperationError, sleep } from 'n8n-workflow';
import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
} from 'n8n-workflow';

import {
	EXTRACT_TEXT,
	EXTRACT_OUTLINE,
	EXTRACT_TABLES,
	EXTRACT_CHUNKS,
	FILL_TEMPLATE,
	JSON_TO_TABLE,
	MARKDOWN_TO_DOC,
	CREATE_DOCUMENT,
	GENERATE_SPREADSHEET,
	GENERATE_PRESENTATION,
	APPEND_ROWS,
	UPDATE_ROW,
	EXTRACT_METADATA,
	APPEND_CONTENT,
} from './scripts';

const POLL_MAX_ATTEMPTS = 60;
const POLL_INTERVAL_MS = 2000;

/**
 * Sign a JWT token using HMAC-SHA256.
 */
export function signJwt(payload: IDataObject, secret: string): string {
	const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
	const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
	const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
	return `${header}.${body}.${signature}`;
}

/**
 * Escape a string for safe embedding inside a JavaScript double-quoted string literal.
 */
export function escapeJs(str: string): string {
	return str
		.replace(/\\/g, '\\\\')
		.replace(/"/g, '\\"')
		.replace(/\n/g, '\\n')
		.replace(/\r/g, '\\r')
		.replace(/\t/g, '\\t');
}

/**
 * Replace %%PLACEHOLDER%% markers in a script template with the given values.
 */
export function buildScript(template: string, replacements: Record<string, string>): string {
	let script = template;
	for (const [key, value] of Object.entries(replacements)) {
		script = script.split(`%%${key}%%`).join(value);
	}
	return script;
}

/**
 * Safely serialize a value as a quoted JSON string literal for use with JSON.parse() in a script.
 * Handles both already-stringified strings (from n8n expressions) and raw objects/arrays.
 */
function toJsonLiteral(value: unknown): string {
	const jsonStr = typeof value === 'string' ? value : JSON.stringify(value);
	return JSON.stringify(jsonStr);
}

/**
 * Poll the /converter endpoint until the conversion is complete or a timeout is reached.
 */
export async function pollConversion(
	context: IExecuteFunctions,
	itemIndex: number,
	docsServerUrl: string,
	jwtSecret: string,
	jwtHeader: string,
	initialResponse: IDataObject,
	outputFormat: string,
	inputFormat: string,
): Promise<string> {
	let response = initialResponse;
	let convertedUrl = response.fileUrl as string | undefined;

	for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS && !convertedUrl; attempt++) {
		await sleep(POLL_INTERVAL_MS);

		const pollBody: IDataObject = {
			async: false,
			key: response.key as string,
			outputtype: outputFormat,
			filetype: inputFormat,
		};
		const pollToken = signJwt(pollBody, jwtSecret);
		pollBody.token = pollToken;

		response = await context.helpers.httpRequest({
			url: `${docsServerUrl}/converter`,
			method: 'POST',
			body: pollBody,
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				[jwtHeader]: `Bearer ${pollToken}`,
			},
			json: true,
		}) as IDataObject;

		if (response.error) {
			throw new NodeOperationError(
				context.getNode(),
				`Conversion failed with error code: ${response.error}`,
				{ itemIndex },
			);
		}
		convertedUrl = response.fileUrl as string | undefined;
	}

	if (!convertedUrl) {
		throw new NodeOperationError(
			context.getNode(),
			'Conversion timed out after 2 minutes',
			{ itemIndex },
		);
	}

	return convertedUrl;
}

const EXTRACT_SCRIPTS: Record<string, string> = {
	extractText: EXTRACT_TEXT,
	extractOutline: EXTRACT_OUTLINE,
	extractTables: EXTRACT_TABLES,
	extractChunks: EXTRACT_CHUNKS,
	extractMetadata: EXTRACT_METADATA,
};

/** Operations that always download the result to parse JSON content. */
const EXTRACT_ONLY_OPERATIONS = new Set([
	'extractText', 'extractOutline', 'extractTables', 'extractChunks', 'extractMetadata',
]);

/**
 * Execute a Document Builder operation by sending the script as raw body.
 */
export async function executeDocBuilder(
	this: IExecuteFunctions,
	itemIndex: number,
	operation: string,
	docsServerUrl: string,
	jwtSecret: string,
	jwtHeader: string,
): Promise<INodeExecutionData[]> {
	const isExtract = EXTRACT_ONLY_OPERATIONS.has(operation);
	const outputMode = isExtract
		? 'data'
		: (this.getNodeParameter('builderOutputMode', itemIndex, 'data') as string);

	let scriptContent: string;
	let outputExtension: string;

	switch (operation) {
		case 'extractText':
		case 'extractOutline':
		case 'extractTables': {
			const fileUrl = this.getNodeParameter('builderFileUrl', itemIndex) as string;
			scriptContent = buildScript(EXTRACT_SCRIPTS[operation], { FILE_URL: escapeJs(fileUrl) });
			outputExtension = 'txt';
			break;
		}
		case 'extractChunks': {
			const fileUrl = this.getNodeParameter('builderFileUrl', itemIndex) as string;
			const chunkBy = this.getNodeParameter('builderChunkBy', itemIndex, 'headings') as string;
			scriptContent = buildScript(EXTRACT_SCRIPTS[operation], { FILE_URL: escapeJs(fileUrl), CHUNK_BY: escapeJs(chunkBy) });
			outputExtension = 'txt';
			break;
		}
		case 'fillTemplate': {
			const fileUrl = this.getNodeParameter('builderFileUrl', itemIndex) as string;
			const templateData = this.getNodeParameter('builderTemplateData', itemIndex) as IDataObject;
			const outputFormat = this.getNodeParameter('builderOutputFormat', itemIndex) as string;
			scriptContent = buildScript(FILL_TEMPLATE, {
				FILE_URL: escapeJs(fileUrl),
				DATA_JSON: toJsonLiteral(templateData),
				OUTPUT_FORMAT: escapeJs(outputFormat),
			});
			outputExtension = outputFormat;
			break;
		}
		case 'jsonToTable': {
			const tableData = this.getNodeParameter('builderTableData', itemIndex) as IDataObject;
			const tableTitle = this.getNodeParameter('builderTableTitle', itemIndex) as string;
			const outputFormat = this.getNodeParameter('builderOutputFormat', itemIndex) as string;
			scriptContent = buildScript(JSON_TO_TABLE, {
				ROWS_JSON: toJsonLiteral(tableData),
				TABLE_TITLE: escapeJs(tableTitle),
				OUTPUT_FORMAT: escapeJs(outputFormat),
			});
			outputExtension = outputFormat;
			break;
		}
		case 'markdownToDoc': {
			const markdown = this.getNodeParameter('builderMarkdown', itemIndex) as string;
			const outputFormat = this.getNodeParameter('builderOutputFormat', itemIndex) as string;
			scriptContent = buildScript(MARKDOWN_TO_DOC, {
				MARKDOWN_JSON: toJsonLiteral(markdown),
				OUTPUT_FORMAT: escapeJs(outputFormat),
			});
			outputExtension = outputFormat;
			break;
		}
		case 'createDocument': {
			const text = this.getNodeParameter('builderText', itemIndex) as string;
			const title = this.getNodeParameter('builderTitle', itemIndex) as string;
			const outputFormat = this.getNodeParameter('builderOutputFormat', itemIndex) as string;
			scriptContent = buildScript(CREATE_DOCUMENT, {
				TITLE: escapeJs(title),
				LINES_JSON: JSON.stringify(JSON.stringify(text.split('\n'))),
				OUTPUT_FORMAT: escapeJs(outputFormat),
			});
			outputExtension = outputFormat;
			break;
		}
		case 'generateSpreadsheet': {
			const tableData = this.getNodeParameter('builderTableData', itemIndex) as IDataObject;
			const sheetTitle = this.getNodeParameter('builderTableTitle', itemIndex, '') as string;
			scriptContent = buildScript(GENERATE_SPREADSHEET, {
				ROWS_JSON: toJsonLiteral(tableData),
				SHEET_TITLE: escapeJs(sheetTitle),
			});
			outputExtension = 'xlsx';
			break;
		}
		case 'generatePresentation': {
			const slidesData = this.getNodeParameter('builderSlidesData', itemIndex) as IDataObject;
			scriptContent = buildScript(GENERATE_PRESENTATION, {
				SLIDES_JSON: toJsonLiteral(slidesData),
			});
			outputExtension = 'pptx';
			break;
		}
		case 'appendRows': {
			const fileUrl = this.getNodeParameter('builderFileUrl', itemIndex) as string;
			const rowsData = this.getNodeParameter('builderTableData', itemIndex) as IDataObject;
			scriptContent = buildScript(APPEND_ROWS, {
				FILE_URL: escapeJs(fileUrl),
				ROWS_JSON: toJsonLiteral(rowsData),
			});
			outputExtension = 'xlsx';
			break;
		}
		case 'updateRow': {
			const fileUrl = this.getNodeParameter('builderFileUrl', itemIndex) as string;
			const searchColumn = this.getNodeParameter('builderSearchColumn', itemIndex) as string;
			const searchValue = this.getNodeParameter('builderSearchValue', itemIndex) as string;
			const updatesData = this.getNodeParameter('builderUpdates', itemIndex) as IDataObject;
			scriptContent = buildScript(UPDATE_ROW, {
				FILE_URL: escapeJs(fileUrl),
				SEARCH_COLUMN: escapeJs(searchColumn),
				SEARCH_VALUE: escapeJs(searchValue),
				UPDATES_JSON: toJsonLiteral(updatesData),
			});
			outputExtension = 'xlsx';
			break;
		}
		case 'extractMetadata': {
			const fileUrl = this.getNodeParameter('builderFileUrl', itemIndex) as string;
			scriptContent = buildScript(EXTRACT_METADATA, { FILE_URL: escapeJs(fileUrl) });
			outputExtension = 'txt';
			break;
		}
		case 'appendContent': {
			const fileUrl = this.getNodeParameter('builderFileUrl', itemIndex) as string;
			const paragraphsData = this.getNodeParameter('builderParagraphs', itemIndex) as IDataObject;
			const outputFormat = this.getNodeParameter('builderOutputFormat', itemIndex) as string;
			scriptContent = buildScript(APPEND_CONTENT, {
				FILE_URL: escapeJs(fileUrl),
				PARAGRAPHS_JSON: toJsonLiteral(paragraphsData),
				OUTPUT_FORMAT: escapeJs(outputFormat),
			});
			outputExtension = outputFormat;
			break;
		}
		default:
			throw new NodeOperationError(this.getNode(), `Unknown DocBuilder operation: ${operation}`, {
				itemIndex,
			});
	}

	const token = signJwt({}, jwtSecret);

	const builderResponse = await this.helpers.httpRequest({
		url: `${docsServerUrl}/docbuilder`,
		method: 'POST',
		body: Buffer.from(scriptContent, 'utf8'),
		headers: {
			'Content-Type': 'application/octet-stream',
			Accept: 'application/json',
			[jwtHeader]: `Bearer ${token}`,
		},
		json: true,
	});

	if (builderResponse.error) {
		throw new NodeOperationError(
			this.getNode(),
			`Document Builder failed with error code: ${builderResponse.error}`,
			{ itemIndex },
		);
	}

	if (!builderResponse.urls || Object.keys(builderResponse.urls).length === 0) {
		throw new NodeOperationError(
			this.getNode(),
			'Document Builder returned no output files',
			{ itemIndex },
		);
	}

	// Get the first output file URL
	const outputUrls = builderResponse.urls as Record<string, string>;
	const firstOutputUrl = Object.values(outputUrls)[0];

	// Generation operations: return single item (with or without binary)
	if (!isExtract) {
		const outputFileName = this.getNodeParameter('builderOutputFileName', itemIndex) as string;
		const binaryPropertyName = this.getNodeParameter('builderBinaryPropertyName', itemIndex) as string;
		const fileName = `${outputFileName}.${outputExtension}`;
		if (outputMode === 'urlOnly') {
			return [{ json: { fileName, operation, outputUrl: firstOutputUrl } }];
		}
		const genBuffer = await this.helpers.httpRequest({
			url: firstOutputUrl,
			method: 'GET',
			encoding: 'arraybuffer',
		});
		const genBinary = await this.helpers.prepareBinaryData(
			Buffer.from(genBuffer as ArrayBuffer),
			fileName,
		);
		return [{
			json: { fileName, operation, outputUrl: firstOutputUrl },
			binary: { [binaryPropertyName]: genBinary },
		}];
	}

	// Extraction operations: download txt, parse, return one item per entity
	const textBuffer = await this.helpers.httpRequest({
		url: firstOutputUrl,
		method: 'GET',
		encoding: 'arraybuffer',
	});
	const textContent = Buffer.from(textBuffer as ArrayBuffer).toString('utf8').trim();

	let parsed: unknown;
	try {
		parsed = JSON.parse(textContent);
	} catch {
		return [{ json: { text: textContent } }];
	}

	if (Array.isArray(parsed)) {
		if (parsed.length === 0) return [{ json: {} }];
		return parsed.map((item, idx) =>
			typeof item === 'object' && item !== null
				? { json: item as IDataObject }
				: { json: { value: item, index: idx } },
		);
	}

	if (typeof parsed === 'object' && parsed !== null) {
		return [{ json: parsed as IDataObject }];
	}

	return [{ json: { value: parsed as string | number | boolean } }];
}

/**
 * Execute mail merge: run fillTemplate for each record and return one output item per record.
 */
export async function executeMailMerge(
	this: IExecuteFunctions,
	itemIndex: number,
	docsServerUrl: string,
	jwtSecret: string,
	jwtHeader: string,
): Promise<INodeExecutionData[]> {
	const fileUrl = this.getNodeParameter('builderFileUrl', itemIndex) as string;
	const records = this.getNodeParameter('builderRecords', itemIndex) as IDataObject[];
	const outputFormat = this.getNodeParameter('builderOutputFormat', itemIndex) as string;
	const outputFileName = this.getNodeParameter('builderOutputFileName', itemIndex) as string;
	const binaryPropertyName = this.getNodeParameter('builderBinaryPropertyName', itemIndex) as string;
	const outputMode = this.getNodeParameter('builderOutputMode', itemIndex, 'data') as string;

	const results: INodeExecutionData[] = [];

	for (let idx = 0; idx < records.length; idx++) {
		const scriptContent = buildScript(FILL_TEMPLATE, {
			FILE_URL: escapeJs(fileUrl),
			DATA_JSON: toJsonLiteral(records[idx]),
			OUTPUT_FORMAT: escapeJs(outputFormat),
		});

		const token = signJwt({}, jwtSecret);

		const builderResponse = await this.helpers.httpRequest({
			url: `${docsServerUrl}/docbuilder`,
			method: 'POST',
			body: Buffer.from(scriptContent, 'utf8'),
			headers: {
				'Content-Type': 'application/octet-stream',
				Accept: 'application/json',
				[jwtHeader]: `Bearer ${token}`,
			},
			json: true,
		});

		if (builderResponse.error) {
			throw new NodeOperationError(
				this.getNode(),
				`Mail merge record ${idx + 1} failed with error code: ${builderResponse.error}`,
				{ itemIndex },
			);
		}

		if (!builderResponse.urls || Object.keys(builderResponse.urls).length === 0) {
			throw new NodeOperationError(
				this.getNode(),
				`Mail merge record ${idx + 1} returned no output files`,
				{ itemIndex },
			);
		}

		const firstOutputUrl = Object.values(builderResponse.urls as Record<string, string>)[0];
		const fileName = `${outputFileName}_${idx + 1}.${outputFormat}`;

		if (outputMode === 'urlOnly') {
			results.push({
				json: {
					success: true,
					fileName,
					recordIndex: idx,
					record: records[idx],
					outputUrl: firstOutputUrl,
				},
			});
			continue;
		}

		const fileBuffer = await this.helpers.httpRequest({
			url: firstOutputUrl,
			method: 'GET',
			encoding: 'arraybuffer',
		});

		const binaryData = await this.helpers.prepareBinaryData(
			Buffer.from(fileBuffer as ArrayBuffer),
			fileName,
		);

		results.push({
			json: {
				success: true,
				fileName,
				recordIndex: idx,
				record: records[idx],
				outputUrl: firstOutputUrl,
			},
			binary: { [binaryPropertyName]: binaryData },
		});
	}

	return results;
}
