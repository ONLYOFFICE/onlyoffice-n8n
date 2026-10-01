/* eslint-disable @n8n/community-nodes/no-restricted-imports -- test code runs in Node/vitest, not in n8n */
import { describe, expect, it } from 'vitest';

import docsFormats from '../../nodes/OnlyofficeDocs/document-formats/onlyoffice-docs-formats.json';
import {
	getFormatsConvertibleTo,
	getInputFormatOptions,
	getOutputFormatOptions,
	getSpreadsheetFormatsConvertibleTo,
	getThumbnailInputFormats,
} from '../../nodes/OnlyofficeDocs/formats';

const values = (options: Array<{ value: unknown }>) => options.map((o) => o.value as string);
const byName = new Map(docsFormats.map((f) => [f.name, f]));

describe('format options', () => {
	it('lists only formats that can be converted, sorted, with upper-case names', () => {
		const options = getInputFormatOptions();
		expect(options.length).toBeGreaterThan(20);
		expect(values(options)).toEqual([...values(options)].sort());
		for (const option of options) {
			expect(option.name).toBe(String(option.value).toUpperCase());
			expect(byName.get(option.value as string)?.convert.length).toBeGreaterThan(0);
		}
	});

	it('offers the targets of the chosen input format', () => {
		expect(values(getOutputFormatOptions('docx'))).toEqual([...byName.get('docx')!.convert].sort());
	});

	it('falls back to all targets for an unknown input format (e.g. an expression)', () => {
		const all = values(getOutputFormatOptions('={{ $json.ext }}'));
		expect(all).toEqual(expect.arrayContaining(['pdf', 'docx', 'xlsx', 'pptx', 'png']));
	});

	it('limits PDF, spreadsheet and thumbnail inputs to capable formats', () => {
		expect(values(getFormatsConvertibleTo('pdf'))).toEqual(
			expect.arrayContaining(['docx', 'xlsx', 'pptx']),
		);
		for (const name of values(getSpreadsheetFormatsConvertibleTo('pdf'))) {
			expect(byName.get(name)?.type).toBe('cell');
		}
		for (const name of values(getThumbnailInputFormats())) {
			const targets = byName.get(name)!.convert;
			expect(targets.includes('png') || targets.includes('jpg')).toBe(true);
		}
	});
});
