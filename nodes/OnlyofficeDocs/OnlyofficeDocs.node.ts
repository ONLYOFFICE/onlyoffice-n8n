import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import type {
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
import { executeDocBuilder, executeMailMerge, pollConversion, signJwt } from './GenericFunctions';

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
					{
						name: 'Document Builder',
						value: 'docbuilder',
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
				displayName: 'File Source',
				name: 'fileSource',
				type: 'options',
				default: 'url',
				description: 'Where to get the source file from',
				displayOptions: {
					show: {
						resource: ['conversion'],
					},
				},
				options: [
					{
						name: 'Binary Input',
						value: 'binary',
						description: 'Upload a file from a previous node binary field',
					},
					{
						name: 'URL',
						value: 'url',
						description: 'Document Server will download the file from a URL',
					},
				],
			},
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
						fileSource: ['url'],
					},
				},
				required: true,
			},
			{
				displayName: 'Input Binary Field',
				name: 'inputBinaryField',
				type: 'string',
				default: 'data',
				hint: 'The name of the input binary field containing the file to convert',
				displayOptions: {
					show: {
						resource: ['conversion'],
						fileSource: ['binary'],
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
				displayName: 'Output Mode',
				name: 'outputMode',
				type: 'options',
				default: 'binary',
				description: 'How to return the converted file',
				displayOptions: {
					show: {
						resource: ['conversion'],
					},
				},
				options: [
					{
						name: 'File Data',
						value: 'binary',
						description: 'Download the converted file and return it as binary data',
					},
					{
						name: 'URL Only',
						value: 'urlOnly',
						description: 'Return only the URL of the converted file without downloading',
					},
				],
			},
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
					hide: {
						outputMode: ['urlOnly'],
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
					hide: {
						outputMode: ['urlOnly'],
					},
				},
			},
		/* -------------------------------------------------------------------------- */
			/*                         docbuilder:operations                              */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'extractText',
				displayOptions: {
					show: {
						resource: ['docbuilder'],
					},
				},
				options: [
					{
						name: 'Append Content to Document',
						value: 'appendContent',
						action: 'Append paragraphs to an existing document',
						description: 'Adds paragraphs to the end of an existing document. Each array item becomes one paragraph.',
					},
					{
						name: 'Append Rows to Spreadsheet',
						value: 'appendRows',
						action: 'Append rows to an existing XLSX spreadsheet',
						description: 'Adds rows to an existing XLSX. Object keys must match existing column headers exactly. Use {{ $JSON.records }} from Extract Tables.',
					},
					{
						name: 'Create Document',
						value: 'createDocument',
						action: 'Create a document from text',
						description: 'Creates a new DOCX or PDF from plain text. Each line becomes a separate paragraph.',
					},
					{
						name: 'Extract Chunks',
						value: 'extractChunks',
						action: 'Split document into chunks for vectorization',
						description: 'Returns one item per chunk. Each item has text (string) and metadata. Use the Chunk By option to control granularity. Use {{ $JSON.text }} in AI/embedding nodes.',
					},
					{
						name: 'Extract Metadata',
						value: 'extractMetadata',
						action: 'Extract document statistics as JSON',
						description: 'Returns one item with counts: paragraphs, estimatedWords, characters, headings, tables',
					},
					{
						name: 'Extract Outline',
						value: 'extractOutline',
						action: 'Extract document headings structure as JSON',
						description: 'Returns one item per heading. Each item has level (1–6) and text fields.',
					},
					{
						name: 'Extract Tables',
						value: 'extractTables',
						action: 'Extract tables from a document as JSON',
						description: 'Returns one item per table. Each item has: tableIndex, headers[], rows[][], records[]. Use {{ $JSON.records }} in Generate Spreadsheet, Append Rows, or JSON to Table.',
					},
					{
						name: 'Extract Text',
						value: 'extractText',
						action: 'Extract structured text from a document',
						description: 'Returns one item with paragraphs[] (each has type, text, level) and tables[] arrays',
					},
					{
						name: 'Fill Template',
						value: 'fillTemplate',
						action: 'Generate document by filling template placeholders',
						description: 'Opens a document and replaces {{key}} placeholders with values from Template Data. Returns fileName, outputUrl, and binary data.',
					},
					{
						name: 'Generate Presentation',
						value: 'generatePresentation',
						action: 'Create a PPTX presentation from slides data',
						description: 'Creates a PPTX from an array of slide objects with title and body fields. Returns fileName, outputUrl, and binary data.',
					},
					{
						name: 'Generate Spreadsheet',
						value: 'generateSpreadsheet',
						action: 'Create an XLSX spreadsheet from JSON data',
						description: 'Creates a new XLSX from an array of row objects. Object keys become column headers. Use {{ $JSON.records }} from Extract Tables.',
					},
					{
						name: 'JSON to Table',
						value: 'jsonToTable',
						action: 'Create a document with a table from JSON data',
						description: 'Creates a DOCX or PDF with a formatted table. Object keys become column headers. Use {{ $JSON.records }} from Extract Tables.',
					},
					{
						name: 'Mail Merge',
						value: 'mailMerge',
						action: 'Generate one document per record by filling template placeholders',
						description: 'Runs Fill Template for each record. Returns one output item per document, each with fileName, outputUrl, and binary data.',
					},
					{
						name: 'Markdown to Document',
						value: 'markdownToDoc',
						action: 'Convert markdown text to a formatted document',
						description: 'Converts Markdown to DOCX or PDF. Supports headings, bold, italic, lists, code blocks. Returns fileName, outputUrl, and binary data.',
					},
					{
						name: 'Update Row in Spreadsheet',
						value: 'updateRow',
						action: 'Find a row in an XLSX spreadsheet and update its values',
						description: 'Finds rows where a column equals a given value and replaces cell values. Returns the updated XLSX file.',
					},
				],
				noDataExpression: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                       docbuilder:extractText                               */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'File URL',
				name: 'builderFileUrl',
				type: 'string',
				default: '',
				placeholder: 'https://example.com/document.docx',
				description: 'URL of the input file. Must be reachable from the ONLYOFFICE Document Server.',
				hint: 'Use <code>{{ $json.outputUrl }}</code> to pass the output of a previous Document Builder step.',
				displayOptions: {
					show: {
						resource: ['docbuilder'],
						operation: ['extractText', 'extractOutline', 'extractTables', 'extractChunks', 'extractMetadata', 'fillTemplate', 'mailMerge', 'appendContent'],
					},
				},
				required: true,
			},
			{
				displayName: 'File URL',
				name: 'builderFileUrl',
				type: 'string',
				default: '',
				placeholder: 'https://example.com/spreadsheet.xlsx',
				description: 'URL of the input XLSX file. Must be reachable from the ONLYOFFICE Document Server.',
				hint: 'Use <code>{{ $json.outputUrl }}</code> to pass the output of a previous Document Builder step.',
				displayOptions: {
					show: {
						resource: ['docbuilder'],
						operation: ['appendRows', 'updateRow'],
					},
				},
				required: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                       docbuilder:extractChunks                             */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Chunk By',
				name: 'builderChunkBy',
				type: 'options',
				default: 'headings',
				description: 'Strategy for splitting the document into chunks',
				displayOptions: {
					show: {
						resource: ['docbuilder'],
						operation: ['extractChunks'],
					},
				},
				options: [
					{
						name: 'By Headings',
						value: 'headings',
						description: 'One chunk per heading section — all paragraphs between two headings are merged. Output fields: text, metadata.section, metadata.headingLevel, metadata.elementStart, metadata.elementEnd.',
					},
					{
						name: 'By Paragraphs',
						value: 'paragraphs',
						description: 'One chunk per paragraph or table row — finer granularity. Output fields: text, metadata.section, metadata.headingLevel, metadata.isHeading, metadata.elementIndex.',
					},
				],
			},

			/* -------------------------------------------------------------------------- */
			/*                       docbuilder:fillTemplate                              */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Template Data (JSON Object)',
				name: 'builderTemplateData',
				type: 'json',
				default: '{}',
				description: 'Key-value pairs used to replace {{key}} placeholders in the template document',
				hint: 'Example: <code>{ "name": "Alice", "date": "2024-01-01" }</code>. Pass <code>{{ $json }}</code> to use all fields from the current item.',
				displayOptions: {
					show: {
						resource: ['docbuilder'],
						operation: ['fillTemplate'],
					},
				},
				required: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                       docbuilder:markdownToDoc                             */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Markdown',
				name: 'builderMarkdown',
				type: 'string',
				typeOptions: { rows: 10 },
				default: '',
				description: 'Markdown text to convert to a formatted document',
				displayOptions: {
					show: {
						resource: ['docbuilder'],
						operation: ['markdownToDoc'],
					},
				},
				required: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                       docbuilder:jsonToTable                               */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Table Data (JSON Array)',
				name: 'builderTableData',
				type: 'json',
				default: '[]',
				description: 'Array of row objects. Object keys become column headers; values become cell content.',
				hint: 'From Extract Tables: <code>{{ $json.records }}</code>. Manual example: <code>[{ "Name": "Alice", "Score": 95 }]</code>',
				displayOptions: {
					show: {
						resource: ['docbuilder'],
						operation: ['jsonToTable', 'generateSpreadsheet', 'appendRows'],
					},
				},
				required: true,
			},
			{
				displayName: 'Table Title',
				name: 'builderTableTitle',
				type: 'string',
				default: '',
				description: 'For JSON to Table: heading inserted above the table. For Generate Spreadsheet: the worksheet tab name.',
				displayOptions: {
					show: {
						resource: ['docbuilder'],
						operation: ['jsonToTable', 'generateSpreadsheet'],
					},
				},
			},

			/* -------------------------------------------------------------------------- */
			/*                    docbuilder:generatePresentation                         */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Slides Data (JSON Array)',
				name: 'builderSlidesData',
				type: 'json',
				default: '[]',
				description: 'Array of slide objects. Each object supports: <b>title</b> (string), <b>body</b> (string), <b>background</b> (hex color, default #FFFFFF), <b>titleColor</b> (hex, default #000000), <b>titleSize</b> (half-points, default 40 = 20pt), <b>titleBold</b> (boolean, default true), <b>titleAlign</b> (left/center/right, default left), <b>bodyColor</b> (hex, default #000000), <b>bodySize</b> (half-points, default 24 = 12pt), <b>bodyBold</b> (boolean, default false), <b>bodyAlign</b> (left/center/right, default left).',
				hint: 'Example: <code>[{ "title": "Slide 1", "titleColor": "#FFFFFF", "background": "#1a73e8", "body": "Content here" }, { "title": "Slide 2", "body": "More content" }]</code>',
				displayOptions: {
					show: {
						resource: ['docbuilder'],
						operation: ['generatePresentation'],
					},
				},
				required: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                       docbuilder:updateRow                                 */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Search Column',
				name: 'builderSearchColumn',
				type: 'string',
				default: '',
				description: 'The exact column header name to search in (case-sensitive)',
				displayOptions: {
					show: {
						resource: ['docbuilder'],
						operation: ['updateRow'],
					},
				},
				required: true,
			},
			{
				displayName: 'Search Value',
				name: 'builderSearchValue',
				type: 'string',
				default: '',
				description: 'The cell value to match in the search column. All matching rows will be updated.',
				displayOptions: {
					show: {
						resource: ['docbuilder'],
						operation: ['updateRow'],
					},
				},
				required: true,
			},
			{
				displayName: 'Updates (JSON)',
				name: 'builderUpdates',
				type: 'json',
				default: '{}',
				description: 'Object mapping column names to new cell values. Only specified columns are updated.',
				hint: 'Example: <code>{ "Status": "Done", "Score": "100" }</code>. Column names must match headers exactly.',
				displayOptions: {
					show: {
						resource: ['docbuilder'],
						operation: ['updateRow'],
					},
				},
				required: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                       docbuilder:appendContent                             */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Paragraphs (JSON Array)',
				name: 'builderParagraphs',
				type: 'json',
				default: '[]',
				description: 'Array of paragraphs to append. Each item is a string or an object with text and optional bold flag.',
				hint: 'String item: <code>"Plain paragraph"</code>. Formatted: <code>{ "text": "Bold text", "bold": true }</code>. Example: <code>["Intro", { "text": "Note", "bold": true }]</code>',
				displayOptions: {
					show: {
						resource: ['docbuilder'],
						operation: ['appendContent'],
					},
				},
				required: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                       docbuilder:mailMerge                                 */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Records (JSON Array)',
				name: 'builderRecords',
				type: 'json',
				default: '[]',
				description: 'Array of objects. One document is generated per record. Object keys replace {{key}} placeholders in the template.',
				hint: 'Example: <code>[{ "name": "Alice", "role": "Manager" }, { "name": "Bob", "role": "Developer" }]</code>',
				displayOptions: {
					show: {
						resource: ['docbuilder'],
						operation: ['mailMerge'],
					},
				},
				required: true,
			},

			/* -------------------------------------------------------------------------- */
			/*                       docbuilder:createDocument                            */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Text',
				name: 'builderText',
				type: 'string',
				typeOptions: { rows: 6 },
				default: '',
				description: 'Plain text content for the document. Each line becomes a separate paragraph.',
				hint: 'Use <code>{{ $json.text }}</code> to pass extracted text from a previous step.',
				displayOptions: {
					show: {
						resource: ['docbuilder'],
						operation: ['createDocument'],
					},
				},
				required: true,
			},
			{
				displayName: 'Title',
				name: 'builderTitle',
				type: 'string',
				default: '',
				description: 'Optional bold heading inserted at the top of the document',
				displayOptions: {
					show: {
						resource: ['docbuilder'],
						operation: ['createDocument'],
					},
				},
			},
			{
				displayName: 'Output Mode',
				name: 'builderOutputMode',
				type: 'options',
				default: 'data',
				description: 'Whether to return the generated file as binary data or as a URL',
				displayOptions: {
					show: {
						resource: ['docbuilder'],
						operation: ['createDocument', 'fillTemplate', 'mailMerge', 'markdownToDoc', 'jsonToTable', 'appendContent', 'generatePresentation', 'generateSpreadsheet', 'appendRows', 'updateRow'],
					},
				},
				options: [
					{ name: 'File Data', value: 'data', description: 'Download the file and return it as binary data in the output field' },
					{ name: 'URL Only', value: 'urlOnly', description: 'Return only the file URL on the Document Server — faster, no download' },
				],
			},
			{
				displayName: 'Output Format',
				name: 'builderOutputFormat',
				type: 'options',
				default: 'docx',
				description: 'The output document format',
				displayOptions: {
					show: {
						resource: ['docbuilder'],
						operation: ['createDocument', 'fillTemplate', 'mailMerge', 'markdownToDoc', 'jsonToTable', 'appendContent'],
					},
				},
				options: [
					{ name: 'DOCX', value: 'docx' },
					{ name: 'PDF', value: 'pdf' },
					{ name: 'PPTX', value: 'pptx' },
				],
			},

			/* -------------------------------------------------------------------------- */
			/*                       docbuilder: common output                            */
			/* -------------------------------------------------------------------------- */
			{
				displayName: 'Output File Name',
				name: 'builderOutputFileName',
				type: 'string',
				default: 'output',
				description: 'The name for the output file (without extension)',
				displayOptions: {
					show: {
						resource: ['docbuilder'],
					},
					hide: {
						operation: ['extractText', 'extractOutline', 'extractTables', 'extractChunks', 'extractMetadata'],
						builderOutputMode: ['urlOnly'],
					},
				},
			},
			{
				displayName: 'Put Output File in Field',
				name: 'builderBinaryPropertyName',
				type: 'string',
				default: 'data',
				hint: 'The name of the output binary field to put the file in',
				displayOptions: {
					show: {
						resource: ['docbuilder'],
					},
					hide: {
						operation: ['extractText', 'extractOutline', 'extractTables', 'extractChunks', 'extractMetadata'],
						builderOutputMode: ['urlOnly'],
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

				const token = signJwt(payload, jwtSecret);
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

				const credentials = await this.getCredentials('onlyofficeDocsApi', i);
				const docsServerUrl = (credentials.docsServerUrl as string).replace(/\/$/, '');
				const jwtSecret = credentials.jwtSecret as string;
				const jwtHeader = (credentials.jwtHeader as string) || 'Authorization';

				if (resource === 'docbuilder') {
					if (operation === 'mailMerge') {
						const results = await executeMailMerge.call(
							this,
							i,
							docsServerUrl,
							jwtSecret,
							jwtHeader,
						);
						for (const r of results) {
							returnData.push({ ...r, pairedItem: items[i].pairedItem });
						}
						continue;
					}

					const docResults = await executeDocBuilder.call(
						this,
						i,
						operation,
						docsServerUrl,
						jwtSecret,
						jwtHeader,
					);
					for (const r of docResults) {
						returnData.push({ ...r, pairedItem: items[i].pairedItem });
					}
					continue;
				}

				const fileSource = this.getNodeParameter('fileSource', i) as string;
				const inputFormat = this.getNodeParameter('inputFormat', i) as string;
				const outputMode = this.getNodeParameter('outputMode', i) as string;

				let outputFormat: string;
				let fileExtension: string | undefined;
				const conversionParams: IDataObject = {
					filetype: inputFormat,
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

						conversionParams.spreadsheetLayout = layout;
						break;
					}

					case 'thumbnail': {
						outputFormat = this.getNodeParameter('thumbnailFormat', i) as string;
						const width = this.getNodeParameter('thumbnailWidth', i) as number;
						const height = this.getNodeParameter('thumbnailHeight', i) as number;
						const aspect = this.getNodeParameter('thumbnailAspect', i) as number;
						const first = this.getNodeParameter('thumbnailFirst', i) as boolean;
						conversionParams.thumbnail = { width, height, aspect, first };
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

						conversionParams.watermark = watermark;
						break;
					}

					case 'removePassword': {
						outputFormat = this.getNodeParameter('outputFormat', i) as string;
						const password = this.getNodeParameter('password', i) as string;
						conversionParams.password = password;
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
				conversionParams.outputtype = outputFormat;

				let conversionResponse: IDataObject;

				if (fileSource === 'binary') {
					// --- Binary mode: POST /converter/from-file (multipart/form-data) ---
					const inputBinaryField = this.getNodeParameter('inputBinaryField', i) as string;
					const binaryItem = items[i].binary;
					if (!binaryItem || !binaryItem[inputBinaryField]) {
						throw new NodeOperationError(
							this.getNode(),
							`No binary data found in field "${inputBinaryField}"`,
							{ itemIndex: i },
						);
					}
					const binaryData = binaryItem[inputBinaryField];
					const fileBuffer = await this.helpers.getBinaryDataBuffer(i, inputBinaryField);
					const fileName = binaryData.fileName || `input.${inputFormat}`;
					const fileMimeType = binaryData.mimeType || 'application/octet-stream';

					const fromFileParams: IDataObject = {
						...conversionParams,
						async: outputMode === 'urlOnly',
					};

					const boundary = `----n8nFormBoundary${Date.now().toString(36)}`;
					const parts: Buffer[] = [];

					if (jwtSecret) {
						const token = signJwt(fromFileParams, jwtSecret);
						parts.push(Buffer.from(
							`--${boundary}\r\nContent-Disposition: form-data; name="token"\r\n\r\n${token}\r\n`,
						));
					} else {
						parts.push(Buffer.from(
							`--${boundary}\r\nContent-Disposition: form-data; name="params"\r\n\r\n${JSON.stringify(fromFileParams)}\r\n`,
						));
					}

					parts.push(Buffer.from(
						`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: ${fileMimeType}\r\n\r\n`,
					));
					parts.push(fileBuffer);
					parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

					const multipartBody = Buffer.concat(parts);

					if (outputMode === 'urlOnly') {
						// async:true -> server returns JSON with fileUrl
						// eslint-disable-next-line @n8n/community-nodes/no-http-request-with-manual-auth -- JWT is sent as a multipart form field; httpRequestWithAuthentication cannot handle body-dependent signing
						conversionResponse = await this.helpers.httpRequest({
							url: `${docsServerUrl}/converter/from-file`,
							method: 'POST',
							headers: {
								'Content-Type': `multipart/form-data; boundary=${boundary}`,
								Accept: 'application/json',
							},
							body: multipartBody,
							json: true,
						}) as IDataObject;
					} else {
						// async:false -> server returns converted file directly
						// eslint-disable-next-line @n8n/community-nodes/no-http-request-with-manual-auth -- JWT is sent as a multipart form field; httpRequestWithAuthentication cannot handle body-dependent signing
						const outputFileBuffer = await this.helpers.httpRequest({
							url: `${docsServerUrl}/converter/from-file`,
							method: 'POST',
							headers: {
								'Content-Type': `multipart/form-data; boundary=${boundary}`,
							},
							body: multipartBody,
							encoding: 'arraybuffer',
						});

						const outputFileName = this.getNodeParameter('outputFileName', i) as string;
						const fullFileName = `${outputFileName}.${actualExtension}`;
						const resultBinaryData = await this.helpers.prepareBinaryData(
							Buffer.from(outputFileBuffer as ArrayBuffer),
							fullFileName,
						);
						const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
						returnData.push({
							json: {
								success: true,
								fileName: fullFileName,
								inputFormat,
								outputFormat,
								operation,
							},
							binary: { [binaryPropertyName]: resultBinaryData },
							pairedItem: items[i].pairedItem,
						});
						continue;
					}
				} else {
					// --- URL mode: POST /converter (JSON body) ---
					const fileUrl = this.getNodeParameter('fileUrl', i) as string;
					const requestBody: IDataObject = {
						...conversionParams,
						async: false,
						url: fileUrl,
						key: `n8n_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
					};

					const outputFileName = outputMode === 'binary'
						? this.getNodeParameter('outputFileName', i) as string
						: 'converted';
					requestBody.title = `${outputFileName}.${actualExtension}`;

					const token = signJwt(requestBody, jwtSecret);
					requestBody.token = token;

					// eslint-disable-next-line @n8n/community-nodes/no-http-request-with-manual-auth -- JWT is derived from the request body; httpRequestWithAuthentication cannot handle body-dependent signing
					conversionResponse = await this.helpers.httpRequest({
						url: `${docsServerUrl}/converter`,
						method: 'POST',
						body: requestBody,
						headers: {
							'Content-Type': 'application/json',
							Accept: 'application/json',
							[jwtHeader]: `Bearer ${token}`,
						},
						json: true,
					}) as IDataObject;
				}

				if (conversionResponse.error) {
					throw new NodeOperationError(
						this.getNode(),
						`Conversion failed with error code: ${conversionResponse.error}`,
						{ itemIndex: i },
					);
				}

				let convertedUrl = conversionResponse.fileUrl as string | undefined;
				if (!convertedUrl && !conversionResponse.endConvert) {
					convertedUrl = await pollConversion(
						this, i, docsServerUrl, jwtSecret, jwtHeader,
						conversionResponse, outputFormat, inputFormat,
					);
				}

				if (outputMode === 'urlOnly') {
					// --- URL-only output: return just the converted file URL ---
					returnData.push({
						json: {
							success: true,
							convertedUrl,
							outputFormat,
							inputFormat,
							operation,
						},
						pairedItem: items[i].pairedItem,
					});
				} else {
					// --- Binary output: download the file and return as binary data ---
					const outputFileName = this.getNodeParameter('outputFileName', i) as string;

					// eslint-disable-next-line @n8n/community-nodes/no-http-request-with-manual-auth -- downloading from a temporary Document Server URL that requires no authentication
					const outputFileBuffer = await this.helpers.httpRequest({
						url: convertedUrl as string,
						method: 'GET',
						encoding: 'arraybuffer',
					});

					const fullFileName = `${outputFileName}.${actualExtension}`;
					const resultBinaryData = await this.helpers.prepareBinaryData(
						Buffer.from(outputFileBuffer as ArrayBuffer),
						fullFileName,
					);
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
					returnData.push({
						json: {
							success: true,
							fileName: fullFileName,
							inputFormat,
							outputFormat,
							operation,
							convertedUrl,
						},
						binary: { [binaryPropertyName]: resultBinaryData },
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
