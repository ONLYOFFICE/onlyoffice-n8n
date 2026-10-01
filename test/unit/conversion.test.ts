/* eslint-disable @n8n/community-nodes/no-restricted-imports -- test code runs in Node/vitest, not in n8n */
import { createHmac } from 'crypto';
import type { IDataObject } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';

import { binaryOf, CREDENTIALS, decodeJwt, DS, type Request, runNode } from './helpers';

// Polling waits 2 s between requests.
vi.mock('n8n-workflow', async (importOriginal) => ({
	...(await importOriginal<typeof import('n8n-workflow')>()),
	sleep: async () => {},
}));

const RESULT_URL = `${DS}/cache/result`;
const FILE = Buffer.from('converted');
const DONE = { endConvert: true, fileUrl: RESULT_URL, percent: 100 };
const URL_PARAMS = {
	resource: 'conversion',
	fileUrl: 'https://files/in.docx',
	inputFormat: 'docx',
};

/** Fake Document Server: `/converter` answers with `answers` in turn, downloads return FILE. */
function server(...answers: IDataObject[]) {
	return (request: Request) => {
		if (request.method === 'GET') return FILE;
		expect(request.url).toBe(`${DS}/converter`);
		return answers.length > 1 ? answers.shift() : (answers[0] ?? DONE);
	};
}

const convert = (params: IDataObject, ...answers: IDataObject[]) =>
	runNode({ params: { ...URL_PARAMS, ...params }, http: server(...answers) });

// ---- URL input ----

describe('conversion from a URL', () => {
	it('signs the body with the secret in body and header', async () => {
		const { requests } = await convert({ operation: 'convert', outputFormat: 'pdf' });
		const { token, ...body } = requests[0].body;
		const [header, payload, signature] = (token as string).split('.');
		expect(signature).toBe(
			createHmac('sha256', CREDENTIALS.jwtSecret)
				.update(`${header}.${payload}`)
				.digest('base64url'),
		);
		expect(decodeJwt(token as string).payload).toEqual(body);
		expect(requests[0].headers[CREDENTIALS.jwtHeader]).toBe(`Bearer ${token}`);
	});

	it('sends the conversion request and returns the downloaded file', async () => {
		const { output, requests } = await convert({
			operation: 'convert',
			outputFormat: 'pdf',
			outputFileName: 'report',
		});
		expect(requests[0].body).toEqual({
			filetype: 'docx',
			key: expect.stringMatching(/^n8n_\d+_[a-z0-9]+$/),
			outputtype: 'pdf',
			async: false,
			url: 'https://files/in.docx',
			title: 'report.pdf',
			token: expect.any(String),
		});
		expect(output[0].json).toEqual({
			success: true,
			fileName: 'report.pdf',
			inputFormat: 'docx',
			outputFormat: 'pdf',
			operation: 'convert',
			convertedUrl: RESULT_URL,
		});
		expect(binaryOf(output[0])).toEqual(FILE);
	});

	it('uses a new key for every item so the DS never returns a cached result', async () => {
		const { requests } = await runNode({
			params: { ...URL_PARAMS, operation: 'convertToPdf' },
			items: [{ json: {} }, { json: {} }],
			http: server(),
		});
		const [first, second] = requests.filter((request) => request.method === 'POST');
		expect(first.body.key).not.toBe(second.body.key);
	});

	it('returns only the URL in URL Only mode', async () => {
		const { output, requests } = await convert({
			operation: 'convertToPdf',
			outputMode: 'urlOnly',
		});
		expect(requests).toHaveLength(1);
		expect(output[0].binary).toBeUndefined();
		expect(output[0].json).toEqual({
			success: true,
			convertedUrl: RESULT_URL,
			outputFormat: 'pdf',
			inputFormat: 'docx',
			operation: 'convertToPdf',
		});
	});
});

// ---- Operation parameters ----

describe('conversion parameters', () => {
	it('Generate Thumbnail sends the thumbnail options and names a multi-page result .zip', async () => {
		const { output, requests } = await convert({
			operation: 'thumbnail',
			thumbnailFormat: 'jpg',
			thumbnailWidth: 320,
			thumbnailHeight: 200,
			thumbnailAspect: 1,
			thumbnailFirst: false,
		});
		expect(requests[0].body).toMatchObject({
			outputtype: 'jpg',
			thumbnail: { width: 320, height: 200, aspect: 1, first: false },
		});
		expect(output[0].json.fileName).toBe('converted.zip');
	});

	it('Remove Password sends the password and keeps it out of the output', async () => {
		const { output, requests } = await convert({
			operation: 'removePassword',
			outputFormat: 'docx',
			password: 's3cret',
		});
		expect(requests[0].body.password).toBe('s3cret');
		expect(JSON.stringify(output[0].json)).not.toContain('s3cret');
	});

	it('Spreadsheet to PDF sends only the layout options that were set', async () => {
		const { requests } = await convert({
			inputFormat: 'xlsx',
			operation: 'spreadsheetToPdf',
			orientation: 'landscape',
			spreadsheetOptions: { scale: 80, gridLines: false, marginTop: '10mm', pageWidth: '297mm' },
		});
		expect(requests[0].body.spreadsheetLayout).toEqual({
			orientation: 'landscape',
			scale: 80,
			gridLines: false,
			margins: { top: '10mm' },
			pageSize: { width: '297mm' },
		});
	});

	const watermarkRun = (request: Request) =>
		(request.body.watermark as { paragraphs: Array<{ runs: IDataObject[] }> }).paragraphs[0]
			.runs[0];

	it('Watermark builds a diagonal text watermark', async () => {
		const { requests } = await convert({
			operation: 'watermark',
			watermarkText: 'DRAFT',
			watermarkOptions: { opacity: 0.5, fontSize: 60 },
		});
		expect(requests[0].body.watermark).toMatchObject({
			transparent: 0.5,
			type: 'diagonal',
			rotate: -45,
		});
		expect(watermarkRun(requests[0])).toMatchObject({
			text: 'DRAFT',
			'font-size': '60',
			bold: true,
		});
	});

	it.each([
		['#336699', [0x33, 0x66, 0x99]],
		['#000000', [0, 0, 0]],
		['#FF0000', [255, 0, 0]],
		// Anything that is not #RRGGBB falls back to the default grey.
		['red', [192, 192, 192]],
		['#FFF', [192, 192, 192]],
		[undefined, [192, 192, 192]],
	])('Watermark color %s becomes the fill %j', async (fontColor, fill) => {
		const { requests } = await convert({
			operation: 'watermark',
			watermarkText: 'X',
			watermarkOptions: fontColor ? { fontColor } : {},
		});
		expect(watermarkRun(requests[0]).fill).toEqual(fill);
	});
});

// ---- Polling and errors ----

describe('conversion polling and errors', () => {
	it('polls with the key of the first request until the DS returns the file URL', async () => {
		const { output, requests } = await convert(
			{ operation: 'convertToPdf' },
			{ endConvert: false, percent: 10 },
			{ endConvert: false, percent: 60 },
			DONE,
		);
		const [first, ...polls] = requests.filter((request) => request.method === 'POST');
		expect(polls).toHaveLength(2);
		// The DS does not return the key, so polling has to reuse it.
		for (const poll of polls) {
			const { token, ...body } = poll.body;
			expect(body).toEqual({
				async: false,
				key: first.body.key,
				outputtype: 'pdf',
				filetype: 'docx',
			});
			expect(decodeJwt(token as string).payload).toEqual(body);
		}
		expect(output[0].json.convertedUrl).toBe(RESULT_URL);
	});

	it('fails the item with the converter error code', async () => {
		await expect(convert({ operation: 'convertToPdf' }, { error: -4 })).rejects.toThrow(
			'Conversion failed with error code: -4',
		);
	});

	it('returns one error item per failed input with Continue On Fail', async () => {
		const { output } = await runNode({
			params: { ...URL_PARAMS, operation: 'convertToPdf' },
			items: [{ json: {} }, { json: {} }],
			continueOnFail: true,
			http: server({ error: -8 }),
		});
		expect(output.map((item) => item.json)).toEqual([
			{ error: 'Conversion failed with error code: -8' },
			{ error: 'Conversion failed with error code: -8' },
		]);
	});
});

// ---- Binary input (/converter/from-file) ----

describe('conversion from binary input', () => {
	const BINARY_PARAMS = { resource: 'conversion', operation: 'convertToPdf', fileSource: 'binary' };
	const ITEM = {
		json: {},
		binary: { data: { data: btoa('source'), fileName: 'in.docx', mimeType: '' } },
	};

	/** Named parts of the multipart body. */
	const partsOf = (request: Request) =>
		Object.fromEntries(
			[
				...request.body
					.toString('latin1')
					.matchAll(/name="(\w+)"[^\r]*\r\n(?:[^\r]+\r\n)?\r\n(.*?)\r\n--/gs),
			].map((match) => [match[1], match[2]]),
		);

	const fromFile = (params: IDataObject, answer: unknown, credentials?: IDataObject) =>
		runNode({
			params: { ...BINARY_PARAMS, ...params },
			items: [ITEM],
			credentials,
			http: () => answer,
		});

	it('uploads the file and returns the response as the converted file', async () => {
		const { output, requests } = await fromFile({}, FILE);
		expect(requests[0].url).toBe(`${DS}/converter/from-file`);
		expect(partsOf(requests[0]).file).toBe('source');
		expect(output[0].json).toEqual({
			success: true,
			fileName: 'converted.pdf',
			inputFormat: 'docx',
			outputFormat: 'pdf',
			operation: 'convertToPdf',
		});
		expect(binaryOf(output[0])).toEqual(FILE);
	});

	// Docs 10 refuses from-file tokens without the operation claim (error -8).
	it('signs the parameters with the operation claim', async () => {
		const { requests } = await fromFile({}, FILE);
		expect(decodeJwt(partsOf(requests[0]).token).payload).toEqual({
			filetype: 'docx',
			key: expect.any(String),
			outputtype: 'pdf',
			async: false,
			operation: 'converter',
		});
	});

	it('sends the parameters as plain JSON without a JWT secret', async () => {
		const { requests } = await fromFile({}, FILE, { ...CREDENTIALS, jwtSecret: '' });
		const parts = partsOf(requests[0]);
		expect(parts.token).toBeUndefined();
		expect(JSON.parse(parts.params)).toEqual({
			filetype: 'docx',
			key: expect.any(String),
			outputtype: 'pdf',
			async: false,
		});
	});

	it('requests an async conversion in URL Only mode', async () => {
		const { output, requests } = await fromFile({ outputMode: 'urlOnly' }, DONE);
		expect(decodeJwt(partsOf(requests[0]).token).payload.async).toBe(true);
		expect(output[0].json.convertedUrl).toBe(RESULT_URL);
	});

	// The DS answers with a JSON error in place of the file.
	it('fails the item when the DS answers with an error instead of the file', async () => {
		await expect(fromFile({}, Buffer.from('{"error":-8}'))).rejects.toThrow(
			'Conversion failed with error code: -8',
		);
	});

	it('fails when the input item has no binary data', async () => {
		await expect(runNode({ params: BINARY_PARAMS, http: () => FILE })).rejects.toThrow(
			'No binary data found in field "data"',
		);
	});
});
