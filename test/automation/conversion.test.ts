/* eslint-disable @n8n/community-nodes/no-restricted-imports -- test code runs in Node/vitest, not in n8n */
import { describe, expect, it } from 'vitest';

import { download, runWorkflow, startsWith, texts } from './n8n';

describe('Conversion', () => {
	it('Convert Document: DOCX from a URL to a PDF file', async () => {
		const run = await runWorkflow('ooConvertUrl0001');
		expect(run.json('Convert DOCX to PDF')[0]).toMatchObject({
			success: true,
			fileName: 'report.pdf',
			outputFormat: 'pdf',
		});
		expect(startsWith(run.file('Convert DOCX to PDF'), '%PDF')).toBe(true);
	});

	it('Convert to PDF: URL Only returns a link to the PDF', async () => {
		const run = await runWorkflow('ooConvertPdf0001');
		const [item] = run.items('PPTX to PDF');
		expect(item.binary).toBeUndefined();
		expect(startsWith(await download(item.json.convertedUrl as string), '%PDF')).toBe(true);
	});

	it('Generate Thumbnail: a PNG of the first page', async () => {
		const run = await runWorkflow('ooThumbnail00001');
		expect(startsWith(run.file('First Page PNG'), '\x89PNG')).toBe(true);
	});

	it('Generate Thumbnail: a ZIP with all pages', async () => {
		const run = await runWorkflow('ooThumbnail00001');
		expect(run.json('All Pages ZIP')[0].fileName).toBe('converted.zip');
		expect(startsWith(run.file('All Pages ZIP'), 'PK')).toBe(true);
	});

	it('Spreadsheet to PDF: layout options are accepted', async () => {
		const run = await runWorkflow('ooSheetToPdf0001');
		expect(startsWith(run.file('Spreadsheet to PDF'), '%PDF')).toBe(true);
	});

	it('Watermark: DOCX to a watermarked PDF', async () => {
		const run = await runWorkflow('ooWatermark00001');
		expect(startsWith(run.file('Watermark'), '%PDF')).toBe(true);
	});

	it('Remove Password: the right password unlocks the document', async () => {
		const run = await runWorkflow('ooRemovePassw001');
		expect(texts(run.json('Extract Unlocked Text'))).toContain(
			'The quick brown fox jumps over the lazy dog.',
		);
	});

	it('Remove Password: a wrong password fails with error -5', async () => {
		const run = await runWorkflow('ooRemovePassw001');
		expect(run.json('Wrong Password')).toEqual([
			{ error: 'Conversion failed with error code: -5' },
		]);
	});

	it('a missing source file fails with error -4', async () => {
		const run = await runWorkflow('ooConvertErr0001');
		expect(run.json('Unreachable URL')).toEqual([
			{ error: 'Conversion failed with error code: -4' },
		]);
	});
});
