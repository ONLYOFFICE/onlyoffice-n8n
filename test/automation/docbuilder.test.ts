/* eslint-disable @n8n/community-nodes/no-restricted-imports -- test code runs in Node/vitest, not in n8n */
import { describe, expect, it } from 'vitest';

import { download, runWorkflow, startsWith, texts } from './n8n';

/** Table rows of Extract Text: the Document Server keeps tab and line break marks in cell text. */
const cells = (rows: unknown) => (rows as string[][]).map((row) => row.map((cell) => cell.trim()));

// All extract tests read one run of the same workflow.
describe('Document Builder: extract', () => {
	const extract = () => runWorkflow('ooExtract0000001');

	it('Extract Text returns paragraphs and tables in document order', async () => {
		const elements = (await extract()).json('Extract Text');
		expect(texts(elements)).toEqual([
			'Introduction',
			'The quick brown fox jumps over the lazy dog.',
			'Details',
			'Second section text.',
		]);
		expect(cells(elements.find((element) => element.type === 'table')?.rows)).toEqual([
			['Name', 'Score'],
			['Alice', '95'],
			['Bob', '87'],
		]);
	});

	it('Extract Outline returns the headings with their levels', async () => {
		const outline = (await extract()).json('Extract Outline');
		expect(outline.map(({ level, text }) => ({ level, text }))).toEqual([
			{ level: 1, text: 'Introduction' },
			{ level: 2, text: 'Details' },
		]);
	});

	it('Extract Tables returns headers, rows and records', async () => {
		const [table] = (await extract()).json('Extract Tables');
		expect(table).toMatchObject({
			headers: ['Name', 'Score'],
			rows: [
				['Name', 'Score'],
				['Alice', '95'],
				['Bob', '87'],
			],
			records: [
				{ Name: 'Alice', Score: '95' },
				{ Name: 'Bob', Score: '87' },
			],
		});
	});

	it('Extract Chunks splits by headings or by paragraphs', async () => {
		const run = await extract();
		const byHeadings = run.json('Chunks By Headings');
		expect(byHeadings.map((chunk) => (chunk.metadata as { section: string }).section)).toEqual(
			expect.arrayContaining(['Introduction', 'Details']),
		);
		expect(run.json('Chunks By Paragraphs').length).toBeGreaterThan(byHeadings.length);
	});

	it('Extract Metadata counts headings and tables', async () => {
		const [metadata] = (await extract()).json('Extract Metadata');
		expect(metadata).toMatchObject({ headings: 2, tables: 1 });
	});
});

describe('Document Builder: generate', () => {
	it('Create Document: DOCX with title and paragraphs, and a PDF', async () => {
		const run = await runWorkflow('ooCreateDoc00001');
		expect(run.json('Create Document')[0]).toMatchObject({
			fileName: 'weekly.docx',
			operation: 'createDocument',
		});
		expect(startsWith(run.file('Create Document'), 'PK')).toBe(true);
		expect(texts(run.json('Extract Created Text'))).toEqual([
			'Weekly report',
			'First paragraph',
			'Second "quoted" paragraph',
		]);
		const [pdf] = run.json('Create PDF');
		expect(startsWith(await download(pdf.outputUrl as string), '%PDF')).toBe(true);
	});

	it('Markdown to Document: headings become an outline', async () => {
		const run = await runWorkflow('ooMarkdown000001');
		expect(run.json('Markdown to Document')[0]).toMatchObject({ fileName: 'output.docx' });
		const outline = run.json('Extract Markdown Outline');
		expect(outline.map(({ level, text }) => ({ level, text }))).toEqual([
			{ level: 1, text: 'Title' },
			{ level: 2, text: 'Section' },
		]);
	});

	it('JSON to Table: rows round-trip through Extract Tables', async () => {
		const run = await runWorkflow('ooJsonTable00001');
		expect(run.json('Extract Generated Table')[0].records).toEqual([
			{ Name: 'Alice', Score: '95' },
			{ Name: 'Bob', Score: '87' },
		]);
	});

	it('Generate Presentation: a PPTX with two slides', async () => {
		const run = await runWorkflow('ooPresentation01');
		expect(run.json('Generate Presentation')[0]).toMatchObject({ fileName: 'output.pptx' });
		const [thumbnails] = run.json('Presentation Thumbnails');
		expect(startsWith(await download(thumbnails.convertedUrl as string), 'PK')).toBe(true);
	});

	it('URL Only output mode returns the file URL without a binary', async () => {
		const run = await runWorkflow('ooBuilderUrl0001');
		const [item] = run.items('Create Document (URL only)');
		expect(item.json).toEqual({
			fileName: 'output.docx',
			operation: 'createDocument',
			outputUrl: expect.stringMatching(/^http/),
		});
		expect(item.binary).toBeUndefined();
		expect(startsWith(await download(item.json.outputUrl as string), 'PK')).toBe(true);
	});
});

describe('Document Builder: modify', () => {
	it('Fill Template: replaces placeholders in paragraphs and tables', async () => {
		const run = await runWorkflow('ooFillTempl00001');
		const extracted = run.json('Extract Filled Text');
		expect(texts(extracted)).toEqual(['Hello Alice, today is 2026-01-01.']);
		expect(cells(extracted.find((element) => element.type === 'table')?.rows)).toEqual([
			['Role', 'Manager'],
		]);
	});

	it('Mail Merge: one document per record from an expression', async () => {
		const run = await runWorkflow('ooMailMerge00001');
		expect(run.json('Mail Merge').map((item) => item.fileName)).toEqual([
			'letter_1.docx',
			'letter_2.docx',
		]);
		expect(texts(run.json('Extract Merged Text'))).toEqual([
			'Hello Alice, today is d1.',
			'Hello Bob, today is d2.',
		]);
	});

	it('Mail Merge: records typed into the JSON field', async () => {
		const run = await runWorkflow('ooMailMerge00001');
		expect(run.json('Mail Merge (JSON text)')).toEqual([
			{
				success: true,
				fileName: 'output_1.docx',
				recordIndex: 0,
				record: { name: 'Carol', date: 'd3', role: 'Tester' },
				outputUrl: expect.stringMatching(/^http/),
			},
		]);
	});

	it('Append Content: paragraphs are added at the end', async () => {
		const run = await runWorkflow('ooAppendCont0001');
		const all = texts(run.json('Extract Appended Text'));
		expect(all.slice(-2)).toEqual(['Appended plain', 'Appended bold']);
	});

	it('Generate Spreadsheet → Append Rows → Update Row → CSV', async () => {
		const run = await runWorkflow('ooSpreadsheet001');
		for (const node of ['Generate Spreadsheet', 'Append Rows', 'Update Row']) {
			expect(run.json(node)[0]).toMatchObject({ fileName: 'output.xlsx' });
		}
		const [csv] = run.json('Spreadsheet to CSV');
		const lines = (await download(csv.convertedUrl as string))
			.toString('utf8')
			.trim()
			.split(/\r?\n/);
		expect(lines).toEqual(['Name,Status', 'Alice,Open', 'Bob,Done', 'Carol,New']);
	});
});
