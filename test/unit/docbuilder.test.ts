/* eslint-disable @n8n/community-nodes/no-restricted-imports -- test code runs in Node/vitest, not in n8n */
import type { IDataObject } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { callsOf, CREDENTIALS, decodeJwt, DS, type Request, runNode } from './helpers';

const OUTPUT_URL = `${DS}/cache/output`;
const FILE_URL = 'https://files/in.docx?name="a"&x=\\1';
// Tries to break out of a string literal. No newline: Create Document splits text by lines.
const HOSTILE = 'He said "hi"\\n"); builder.CloseFile(); Api.X("';

/**
 * Run a Document Builder operation against a fake /docbuilder that answers `answer` and serves
 * `download` as the output file. Returns the output, the requests and the scripts sent.
 */
async function build(params: IDataObject, download: unknown = 'file', answer?: IDataObject) {
	const scripts: string[] = [];
	const result = await runNode({
		params: { resource: 'docbuilder', ...params },
		http: (request: Request) => {
			if (request.method === 'GET') return Buffer.from(download as string);
			expect(request.url).toBe(`${DS}/docbuilder`);
			scripts.push(request.body.toString());
			return answer ?? { urls: { 'output.bin': OUTPUT_URL } };
		},
	});
	return { ...result, scripts };
}

/** Texts the script writes into the document. */
const textsOf = (script: string) => callsOf(script, 'AddText').map(([text]) => text);

// ---- Request ----

describe('Document Builder request', () => {
	it('posts the script as raw UTF-8 with a signed token in the configured header', async () => {
		const { requests } = await build({ operation: 'createDocument', builderText: 'Hello' });
		expect(requests[0].headers['Content-Type']).toBe('application/octet-stream');
		expect(Buffer.isBuffer(requests[0].body)).toBe(true);
		const token = String(requests[0].headers[CREDENTIALS.jwtHeader]).replace('Bearer ', '');
		expect(decodeJwt(token).header).toEqual({ alg: 'HS256', typ: 'JWT' });
	});

	it('fails with the builder error code', async () => {
		await expect(build({ operation: 'createDocument' }, '', { error: -3 })).rejects.toThrow(
			'Document Builder failed with error code: -3',
		);
	});

	it('fails when the builder returns no output files', async () => {
		await expect(build({ operation: 'createDocument' }, '', { urls: {} })).rejects.toThrow(
			'Document Builder returned no output files',
		);
	});
});

// ---- Scripts: user input stays data ----

describe('Document Builder scripts', () => {
	it('open the exact File URL', async () => {
		const { scripts } = await build({ operation: 'extractText', builderFileUrl: FILE_URL }, '[]');
		expect(callsOf(scripts[0], 'builder.OpenFile')).toEqual([[FILE_URL]]);
	});

	it.each([
		['extractChunks', { builderFileUrl: FILE_URL, builderChunkBy: 'paragraphs' }],
		['fillTemplate', { builderFileUrl: FILE_URL, builderTemplateData: { name: HOSTILE } }],
		['generateSpreadsheet', { builderTableData: [{ Name: HOSTILE }], builderTableTitle: HOSTILE }],
		['generatePresentation', { builderSlidesData: [{ title: HOSTILE, body: HOSTILE }] }],
		['appendRows', { builderFileUrl: FILE_URL, builderTableData: [{ Name: HOSTILE }] }],
		[
			'updateRow',
			{
				builderFileUrl: FILE_URL,
				builderSearchColumn: HOSTILE,
				builderSearchValue: HOSTILE,
				builderUpdates: { Status: HOSTILE },
			},
		],
	])('%s runs to the end with hostile input', async (operation, params) => {
		const { scripts } = await build({ operation, ...params }, '[]');
		expect(callsOf(scripts[0], 'builder.CloseFile')).toEqual([[]]);
	});

	it('Create Document writes the title and every line verbatim', async () => {
		const { scripts, output } = await build({
			operation: 'createDocument',
			builderTitle: HOSTILE,
			builderText: `first\n${HOSTILE}\nlast`,
			builderOutputFormat: 'pdf',
			builderOutputFileName: 'doc',
		});
		expect(textsOf(scripts[0])).toEqual([HOSTILE, 'first', HOSTILE, 'last']);
		expect(callsOf(scripts[0], 'builder.SaveFile')).toEqual([['pdf', 'output.pdf']]);
		expect(output[0].json).toEqual({
			fileName: 'doc.pdf',
			operation: 'createDocument',
			outputUrl: OUTPUT_URL,
		});
		expect(output[0].binary?.data).toBeDefined();
	});

	it.each([
		['JSON text', JSON.stringify([{ Name: HOSTILE, Score: 95 }])],
		['an array', [{ Name: HOSTILE, Score: 95 }]],
	])(
		'JSON to Table takes rows as %s and writes cells verbatim',
		async (_kind, builderTableData) => {
			const { scripts } = await build({
				operation: 'jsonToTable',
				builderTableData,
				builderTableTitle: 'T',
			});
			expect(textsOf(scripts[0])).toEqual(['T', 'Name', 'Score', HOSTILE, '95']);
		},
	);

	it('does not expand placeholders that appear inside user data', async () => {
		const { scripts } = await build({
			operation: 'jsonToTable',
			builderTableData: [{ Note: '%%TABLE_TITLE%%' }],
			builderTableTitle: 'Title',
		});
		expect(textsOf(scripts[0])).toEqual(['Title', 'Note', '%%TABLE_TITLE%%']);
	});

	it('Append Content writes strings and {text, bold} objects', async () => {
		const { scripts } = await build({
			operation: 'appendContent',
			builderFileUrl: FILE_URL,
			builderParagraphs: ['plain', { text: HOSTILE, bold: true }],
		});
		expect(textsOf(scripts[0])).toEqual(['plain', HOSTILE]);
		expect(callsOf(scripts[0], 'SetBold')).toEqual([[true]]);
	});

	const MARKDOWN = `# Title\n\nSome **bold** and *it* text\n\n- item\n1. first\n\n\`\`\`\n${HOSTILE}\n\`\`\``;

	it('Markdown to Document writes the text of every element verbatim', async () => {
		const { scripts } = await build({ operation: 'markdownToDoc', builderMarkdown: MARKDOWN });
		expect(textsOf(scripts[0])).toEqual([
			'Title',
			'Some ',
			'bold',
			' and ',
			'it',
			' text',
			'item',
			'first',
			HOSTILE,
		]);
	});

	it('Markdown to Document formats headings, emphasis, lists and code', async () => {
		const { scripts } = await build({ operation: 'markdownToDoc', builderMarkdown: MARKDOWN });
		expect(callsOf(scripts[0], 'GetStyle')).toEqual([['Heading 1']]);
		expect(callsOf(scripts[0], 'SetBold')).toEqual([[true]]);
		expect(callsOf(scripts[0], 'SetItalic')).toEqual([[true]]);
		expect(callsOf(scripts[0], 'CreateBullet')).toEqual([['-']]);
		expect(callsOf(scripts[0], 'CreateNumbering')).toEqual([['numbered']]);
		expect(callsOf(scripts[0], 'SetFontFamily')).toEqual([['Courier New']]);
	});
});

// ---- Output ----

describe('Document Builder output', () => {
	it.each([
		[
			'an array into one item per element',
			'[{"text":"a"},{"text":"b"}]',
			[{ text: 'a' }, { text: 'b' }],
		],
		['an object into one item', '{"paragraphs":3}', [{ paragraphs: 3 }]],
		['an empty array into one empty item', '[]', [{}]],
		['scalars into value items', '["x"]', [{ value: 'x', index: 0 }]],
		['non-JSON text into a text item', 'not json', [{ text: 'not json' }]],
	])('extract turns %s', async (_kind, content, expected) => {
		const { output } = await build(
			{ operation: 'extractMetadata', builderFileUrl: FILE_URL },
			content,
		);
		expect(output.map((item) => item.json)).toEqual(expected);
	});

	// In URL Only mode n8n does not keep the hidden output file name and binary field.
	it('returns only the URL in URL Only mode', async () => {
		const { output, requests } = await build({
			operation: 'generateSpreadsheet',
			builderTableData: [{ A: 1 }],
			builderOutputMode: 'urlOnly',
		});
		expect(requests).toHaveLength(1);
		expect(output[0].binary).toBeUndefined();
		expect(output[0].json).toEqual({
			fileName: 'output.xlsx',
			operation: 'generateSpreadsheet',
			outputUrl: OUTPUT_URL,
		});
	});

	const RECORDS = [{ name: 'Alice' }, { name: 'Bob' }];

	it.each([
		// n8n passes a json parameter typed into the field as a string.
		['JSON text', JSON.stringify(RECORDS)],
		['an array', RECORDS],
	])('Mail Merge renders one document per record given as %s', async (_kind, builderRecords) => {
		const { output, scripts } = await build({
			operation: 'mailMerge',
			builderFileUrl: FILE_URL,
			builderRecords,
			builderOutputFileName: 'letter',
		});
		expect(scripts).toHaveLength(2);
		expect(output.map((item) => item.json.fileName)).toEqual(['letter_1.docx', 'letter_2.docx']);
		expect(output.map((item) => item.json.record)).toEqual(RECORDS);
		expect(output.every((item) => item.binary?.data)).toBe(true);
	});

	it('Mail Merge returns only the URLs in URL Only mode', async () => {
		const { output, requests } = await build({
			operation: 'mailMerge',
			builderFileUrl: FILE_URL,
			builderRecords: RECORDS,
			builderOutputMode: 'urlOnly',
		});
		expect(requests).toHaveLength(2);
		expect(output.map((item) => item.json)).toEqual(
			RECORDS.map((record, index) => ({
				success: true,
				fileName: `output_${index + 1}.docx`,
				recordIndex: index,
				record,
				outputUrl: OUTPUT_URL,
			})),
		);
		expect(output.every((item) => item.binary === undefined)).toBe(true);
	});
});
