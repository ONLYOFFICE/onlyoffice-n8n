import { createHmac } from 'crypto';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import type {
	IBinaryData,
	ICredentialTestFunctions,
	ICredentialsDecrypted,
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeCredentialTestResult,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import {
	getInputFormatOptions,
	getOutputFormatOptions,
	getFormatsConvertibleTo,
	getSpreadsheetFormatsConvertibleTo,
	getThumbnailInputFormats,
} from './formats';

export class OnlyofficeDocs implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ONLYOFFICE Docs',
		name: 'onlyofficeDocs',
		icon: 'file:onlyofficeDocs.svg',
		iconColor: 'orange',
		group: ['input'],
		description: 'Consume ONLYOFFICE Document Server API (Conversion, Document Builder)',
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		usableAsTool: true,
		version: [1],
		defaults: {
			name: 'ONLYOFFICE Docs',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],

		properties: [
			/* -------------------------------------------------------------------------- */
			/*                                  resources                                 */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				default: 'conversion',
				options: [
					{
						name: 'Conversion',
						value: 'conversion',
					},
				],
				noDataExpression: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                          conversion:operations                             */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'convert',
				displayOptions: {
					show: {
						resource: ['conversion'],
					},
				},
				options: [
					{
						name: 'Convert Document',
						value: 'convert',
						action: 'Convert a document from one format to another',
					},
					{
						name: 'Convert to PDF',
						value: 'convertToPdf',
						action: 'Convert a document to PDF',
					},
					{
						name: 'Generate Thumbnail',
						value: 'thumbnail',
						action: 'Generate a thumbnail image from a document',
					},
					{
						name: 'Remove Password',
						value: 'removePassword',
						action: 'Remove password protection from a document',
					},
					{
						name: 'Spreadsheet to PDF',
						value: 'spreadsheetToPdf',
						action: 'Convert a spreadsheet to PDF with layout options',
					},
					{
						name: 'Watermark',
						value: 'watermark',
						action: 'Convert to PDF with a text watermark',
					},
				],
				noDataExpression: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                            conversion:convert                              */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'File URL',
				name: 'fileUrl',
				type: 'string',
				default: '',
				placeholder: 'https://example.com/document.docx',
				description:
					'The URL of the file. Document Server will download it from this URL.',
				displayOptions: {
					show: {
						resource: ['conversion'],
					},
				},
				required: true,
			},
			{
				displayName: 'Input Format Name or ID',
				name: 'inputFormat',
				type: 'options',
				default: 'docx',
				description:
					'The format of the input file. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				displayOptions: {
					show: {
						resource: ['conversion'],
					},
				},
				typeOptions: {
					loadOptionsMethod: 'getInputFormats',
					loadOptionsDependsOn: ['operation'],
				},
				required: true,
			},
			{
				displayName: 'Output Format Name or ID',
				name: 'outputFormat',
				type: 'options',
				default: 'pdf',
				description:
					'The desired output format. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				displayOptions: {
					show: {
						resource: ['conversion'],
						operation: ['convert', 'removePassword'],
					},
				},
				typeOptions: {
					loadOptionsMethod: 'getOutputFormats',
					loadOptionsDependsOn: ['inputFormat'],
				},
				required: true,
			},
			// ---- removePassword ----
			{
				displayName: 'Password',
				name: 'password',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description: 'The password of the protected file',
				displayOptions: {
					show: {
						resource: ['conversion'],
						operation: ['removePassword'],
					},
				},
				required: true,
			},

			// ---- thumbnail ----
			{
				displayName: 'Image Format',
				name: 'thumbnailFormat',
				type: 'options',
				default: 'png',
				description: 'The output image format for the thumbnail',
				displayOptions: {
					show: {
						resource: ['conversion'],
						operation: ['thumbnail'],
					},
				},
				options: [
					{ name: 'JPG', value: 'jpg' },
					{ name: 'PNG', value: 'png' },
				],
				required: true,
			},
			{
				displayName: 'Width',
				name: 'thumbnailWidth',
				type: 'number',
				default: 100,
				description: 'Thumbnail width in pixels',
				displayOptions: {
					show: {
						resource: ['conversion'],
						operation: ['thumbnail'],
					},
				},
			},
			{
				displayName: 'Height',
				name: 'thumbnailHeight',
				type: 'number',
				default: 100,
				description: 'Thumbnail height in pixels',
				displayOptions: {
					show: {
						resource: ['conversion'],
						operation: ['thumbnail'],
					},
				},
			},
			{
				displayName: 'Aspect Ratio',
				name: 'thumbnailAspect',
				type: 'options',
				default: 2,
				description: 'How to handle aspect ratio mismatch',
				displayOptions: {
					show: {
						resource: ['conversion'],
						operation: ['thumbnail'],
					},
				},
				options: [
					{ name: 'Crop', value: 1 },
					{ name: 'Fit', value: 2 },
					{ name: 'Stretch', value: 0 },
				],
			},
			{
				displayName: 'First Page Only',
				name: 'thumbnailFirst',
				type: 'boolean',
				default: true,
				description:
					'Whether to generate a thumbnail only for the first page. When enabled, the output is a single image file. When disabled, the output is a ZIP archive containing images for all pages.',
				displayOptions: {
					show: {
						resource: ['conversion'],
						operation: ['thumbnail'],
					},
				},
			},

			// ---- spreadsheetToPdf ----
			{
				displayName: 'Orientation',
				name: 'orientation',
				type: 'options',
				default: 'portrait',
				displayOptions: {
					show: {
						resource: ['conversion'],
						operation: ['spreadsheetToPdf'],
					},
				},
				options: [
					{ name: 'Landscape', value: 'landscape' },
					{ name: 'Portrait', value: 'portrait' },
				],
			},
			{
				displayName: 'Spreadsheet Options',
				name: 'spreadsheetOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['conversion'],
						operation: ['spreadsheetToPdf'],
					},
				},
				options: [
					{
						displayName: 'Fit to Height (Pages)',
						name: 'fitToHeight',
						type: 'number',
						default: 0,
						description: 'Number of pages to fit height to (0 = auto)',
					},
					{
						displayName: 'Fit to Width (Pages)',
						name: 'fitToWidth',
						type: 'number',
						default: 0,
						description: 'Number of pages to fit width to (0 = auto)',
					},
					{
						displayName: 'Ignore Print Area',
						name: 'ignorePrintArea',
						type: 'boolean',
						default: true,
						description: 'Whether to ignore the print area set in the spreadsheet',
					},
					{
						displayName: 'Margin Bottom',
						name: 'marginBottom',
						type: 'string',
						default: '19.1mm',
						description: 'Bottom margin (e.g. "19.1mm")',
					},
					{
						displayName: 'Margin Left',
						name: 'marginLeft',
						type: 'string',
						default: '17.8mm',
						description: 'Left margin (e.g. "17.8mm")',
					},
					{
						displayName: 'Margin Right',
						name: 'marginRight',
						type: 'string',
						default: '17.8mm',
						description: 'Right margin (e.g. "17.8mm")',
					},
					{
						displayName: 'Margin Top',
						name: 'marginTop',
						type: 'string',
						default: '19.1mm',
						description: 'Top margin (e.g. "19.1mm")',
					},
					{
						displayName: 'Page Height',
						name: 'pageHeight',
						type: 'string',
						default: '297mm',
						description: 'Page height (e.g. "297mm" for A4)',
					},
					{
						displayName: 'Page Width',
						name: 'pageWidth',
						type: 'string',
						default: '210mm',
						description: 'Page width (e.g. "210mm" for A4)',
					},
					{
						displayName: 'Scale (%)',
						name: 'scale',
						type: 'number',
						default: 100,
						description: 'Zoom scale percentage (10-400)',
						typeOptions: { minValue: 10, maxValue: 400 },
					},
					{
						displayName: 'Show Grid Lines',
						name: 'gridLines',
						type: 'boolean',
						default: false,
						description: 'Whether to show grid lines in the output PDF',
					},
					{
						displayName: 'Show Headings',
						name: 'headings',
						type: 'boolean',
						default: false,
						description: 'Whether to show row/column headings',
					},
				],
			},

			// ---- watermark ----
			{
				displayName: 'Watermark Text',
				name: 'watermarkText',
				type: 'string',
				default: 'CONFIDENTIAL',
				description: 'The text to display as a watermark',
				displayOptions: {
					show: {
						resource: ['conversion'],
						operation: ['watermark'],
					},
				},
				required: true,
			},
			{
				displayName: 'Watermark Options',
				name: 'watermarkOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['conversion'],
						operation: ['watermark'],
					},
				},
				options: [
					{
						displayName: 'Bold',
						name: 'bold',
						type: 'boolean',
						default: true,
						description: 'Whether the watermark text is bold',
					},
					{
						displayName: 'Diagonal',
						name: 'diagonal',
						type: 'boolean',
						default: true,
						description: 'Whether to place the watermark diagonally',
					},
					{
						displayName: 'Font Color',
						name: 'fontColor',
						type: 'color',
						default: '#C0C0C0',
						description: 'Color of the watermark text',
					},
					{
						displayName: 'Font Size',
						name: 'fontSize',
						type: 'number',
						default: 40,
						description: 'Font size for the watermark text',
					},
					{
						displayName: 'Opacity',
						name: 'opacity',
						type: 'number',
						default: 0.3,
						description: 'Watermark transparency (0 = fully transparent, 1 = fully opaque)',
						typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 2 },
					},
				],
			},

			// ---- common: output ----
			{
				displayName: 'Output File Name',
				name: 'outputFileName',
				type: 'string',
				default: 'converted',
				description: 'The name for the output file (without extension)',
				displayOptions: {
					show: {
						resource: ['conversion'],
					},
				},
			},
			{
				displayName: 'Put Output File in Field',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				hint: 'The name of the output binary field to put the file in',
				displayOptions: {
					show: {
						resource: ['conversion'],
					},
				},
			},
		],

		credentials: [
			{
				name: 'onlyofficeDocsApi',
				required: true,
				testedBy: 'testOnlyofficeDocsApiCredentials',
			},
		],
	};

	methods = {
		credentialTest: {
			async testOnlyofficeDocsApiCredentials(
				this: ICredentialTestFunctions,
				credential: ICredentialsDecrypted,
			): Promise<INodeCredentialTestResult> {
				const docsServerUrl = (credential.data!.docsServerUrl as string).replace(/\/$/, '');
				const jwtSecret = credential.data!.jwtSecret as string;
				const jwtHeader = (credential.data!.jwtHeader as string) || 'Authorization';

				const payload: IDataObject = {
					async: false,
					filetype: 'docx',
					key: `n8n_test_${Date.now()}`,
					outputtype: 'pdf',
					url: 'https://example.com/test.docx',
				};

				const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
					'base64url',
				);
				const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
				const signature = createHmac('sha256', jwtSecret)
					.update(`${header}.${body}`)
					.digest('base64url');
				const token = `${header}.${body}.${signature}`;
				payload.token = token;

				try {
					// eslint-disable-next-line @n8n/community-nodes/no-deprecated-workflow-functions -- ICredentialTestFunctions only provides request(), not httpRequest()
					const response = await this.helpers.request({
						url: `${docsServerUrl}/converter`,
						method: 'POST',
						body: payload,
						headers: {
							'Content-Type': 'application/json',
							Accept: 'application/json',
							[jwtHeader]: `Bearer ${token}`,
						},
						json: true,
					});
					if (response.error === -8) {
						return { status: 'OK', message: 'Connection successful' };
					}
					if (response.error === -6) {
						return { status: 'Error', message: 'JWT secret is invalid' };
					}
					return { status: 'OK', message: 'Connection successful' };
				} catch (error) {
					return {
						status: 'Error',
						message: `Connection failed: ${(error as Error).message}`,
					};
				}
			},
		},
		loadOptions: {
			async getInputFormats(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const operation = this.getCurrentNodeParameter('operation') as string;
				switch (operation) {
					case 'convertToPdf':
					case 'watermark':
						return getFormatsConvertibleTo('pdf');
					case 'spreadsheetToPdf':
						return getSpreadsheetFormatsConvertibleTo('pdf');
					case 'thumbnail':
						return getThumbnailInputFormats();
					default:
						return getInputFormatOptions();
				}
			},
			async getOutputFormats(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const inputFormat = this.getCurrentNodeParameter('inputFormat') as string;
				return getOutputFormatOptions(inputFormat);
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource !== 'conversion') {
					throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`, {
						itemIndex: i,
					});
				}

				const credentials = await this.getCredentials('onlyofficeDocsApi', i);
				const docsServerUrl = (credentials.docsServerUrl as string).replace(/\/$/, '');
				const jwtSecret = credentials.jwtSecret as string;
				const jwtHeader = (credentials.jwtHeader as string) || 'Authorization';

				const fileUrl = this.getNodeParameter('fileUrl', i) as string;
				const inputFormat = this.getNodeParameter('inputFormat', i) as string;
				const outputFileName = this.getNodeParameter('outputFileName', i) as string;

				let outputFormat: string;
				let fileExtension: string | undefined;
				const requestBody: IDataObject = {
					async: false,
					filetype: inputFormat,
					key: `n8n_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
					url: fileUrl,
				};

				switch (operation) {
					case 'convert': {
						outputFormat = this.getNodeParameter('outputFormat', i) as string;
						break;
					}

					case 'convertToPdf': {
						outputFormat = 'pdf';
						break;
					}

					case 'spreadsheetToPdf': {
						outputFormat = 'pdf';
						const orientation = this.getNodeParameter('orientation', i) as string;
						const opts = this.getNodeParameter('spreadsheetOptions', i, {}) as IDataObject;

						const layout: IDataObject = { orientation };
						if (opts.scale !== undefined) layout.scale = opts.scale;
						if (opts.fitToWidth !== undefined) layout.fitToWidth = opts.fitToWidth;
						if (opts.fitToHeight !== undefined) layout.fitToHeight = opts.fitToHeight;
						if (opts.gridLines !== undefined) layout.gridLines = opts.gridLines;
						if (opts.headings !== undefined) layout.headings = opts.headings;
						if (opts.ignorePrintArea !== undefined) layout.ignorePrintArea = opts.ignorePrintArea;

						const margins: IDataObject = {};
						if (opts.marginTop) margins.top = opts.marginTop;
						if (opts.marginBottom) margins.bottom = opts.marginBottom;
						if (opts.marginLeft) margins.left = opts.marginLeft;
						if (opts.marginRight) margins.right = opts.marginRight;
						if (Object.keys(margins).length > 0) layout.margins = margins;

						const pageSize: IDataObject = {};
						if (opts.pageWidth) pageSize.width = opts.pageWidth;
						if (opts.pageHeight) pageSize.height = opts.pageHeight;
						if (Object.keys(pageSize).length > 0) layout.pageSize = pageSize;

						requestBody.spreadsheetLayout = layout;
						break;
					}

					case 'thumbnail': {
						outputFormat = this.getNodeParameter('thumbnailFormat', i) as string;
						const width = this.getNodeParameter('thumbnailWidth', i) as number;
						const height = this.getNodeParameter('thumbnailHeight', i) as number;
						const aspect = this.getNodeParameter('thumbnailAspect', i) as number;
						const first = this.getNodeParameter('thumbnailFirst', i) as boolean;
						requestBody.thumbnail = { width, height, aspect, first };
						if (!first) {
							fileExtension = 'zip';
						}
						break;
					}

					case 'watermark': {
						outputFormat = 'pdf';
						const watermarkText = this.getNodeParameter('watermarkText', i) as string;
						const wmOpts = this.getNodeParameter('watermarkOptions', i, {}) as IDataObject;

						const fontSize = (wmOpts.fontSize as number) || 40;
						const opacity = (wmOpts.opacity as number) ?? 0.3;
						const bold = wmOpts.bold !== undefined ? (wmOpts.bold as boolean) : true;
						const diagonal = wmOpts.diagonal !== undefined ? (wmOpts.diagonal as boolean) : true;
						const fontColor = (wmOpts.fontColor as string) || '#C0C0C0';

						const r = parseInt(fontColor.slice(1, 3), 16) || 192;
						const g = parseInt(fontColor.slice(3, 5), 16) || 192;
						const b = parseInt(fontColor.slice(5, 7), 16) || 192;

						const watermark: IDataObject = {
							transparent: opacity,
							type: diagonal ? 'diagonal' : 'none',
							width: 100,
							height: 100,
							paragraphs: [
								{
									align: 2,
									runs: [
										{
											text: watermarkText,
											fill: [r, g, b],
											'font-family': 'Arial',
											'font-size': String(fontSize),
											bold,
											italic: false,
											strikeout: false,
											underline: false,
										},
									],
								},
							],
						};
						if (diagonal) watermark.rotate = -45;

						requestBody.watermark = watermark;
						break;
					}

					case 'removePassword': {
						outputFormat = this.getNodeParameter('outputFormat', i) as string;
						const password = this.getNodeParameter('password', i) as string;
						requestBody.password = password;
						break;
					}

					default:
						throw new NodeOperationError(
							this.getNode(),
							`Unknown operation: ${operation}`,
							{ itemIndex: i },
						);
				}

				const actualExtension = fileExtension || outputFormat;
				requestBody.outputtype = outputFormat;
				requestBody.title = `${outputFileName}.${actualExtension}`;

				const token = signJwt(requestBody, jwtSecret);
				requestBody.token = token;

				// eslint-disable-next-line @n8n/community-nodes/no-http-request-with-manual-auth -- JWT is derived from the request body; httpRequestWithAuthentication cannot handle body-dependent signing
				const conversionResponse = await this.helpers.httpRequest({
					url: `${docsServerUrl}/converter`,
					method: 'POST',
					body: requestBody,
					headers: {
						'Content-Type': 'application/json',
						Accept: 'application/json',
						[jwtHeader]: `Bearer ${token}`,
					},
					json: true,
				});

				if (conversionResponse.error) {
					throw new NodeOperationError(
						this.getNode(),
						`Conversion failed with error code: ${conversionResponse.error}`,
						{ itemIndex: i },
					);
				}

				let resultDataObject: IDataObject;
				let resultBinaryData: IBinaryData | undefined;

				if (conversionResponse.fileUrl) {
					// eslint-disable-next-line @n8n/community-nodes/no-http-request-with-manual-auth -- downloading from a temporary Document Server URL that requires no authentication
					const fileBuffer = await this.helpers.httpRequest({
						url: conversionResponse.fileUrl,
						method: 'GET',
						encoding: 'arraybuffer',
					});

					resultBinaryData = await this.helpers.prepareBinaryData(
						Buffer.from(fileBuffer as ArrayBuffer),
						`${outputFileName}.${actualExtension}`,
					);
					resultDataObject = {
						success: true,
						fileName: `${outputFileName}.${actualExtension}`,
						inputFormat,
						outputFormat,
						operation,
						sourceUrl: fileUrl,
						convertedUrl: conversionResponse.fileUrl,
					};
				} else {
					resultDataObject = {
						success: false,
						status: 'processing',
						percent: conversionResponse.percent || 0,
						message: 'Conversion is still in progress.',
					};
				}

				if (resultBinaryData) {
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
					returnData.push({
						json: resultDataObject,
						binary: { [binaryPropertyName]: resultBinaryData },
						pairedItem: items[i].pairedItem,
					});
				} else {
					returnData.push({
						json: resultDataObject,
						pairedItem: items[i].pairedItem,
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: items[i].pairedItem,
					});
				} else {
					throw new NodeOperationError(this.getNode(), (error as Error).message, {
						itemIndex: i,
					});
				}
			}
		}

		return [returnData];
	}
}

/**
 * Sign a JWT token using HMAC-SHA256.
 */
function signJwt(payload: IDataObject, secret: string): string {
	const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
	const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
	const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
	return `${header}.${body}.${signature}`;
}
