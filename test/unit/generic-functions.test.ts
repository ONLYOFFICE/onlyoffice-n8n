/* eslint-disable @n8n/community-nodes/no-restricted-imports -- test code runs in Node/vitest, not in n8n */
import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';

import { buildScript, escapeJs, signJwt } from '../../nodes/OnlyofficeDocs/GenericFunctions';
import { decodeJwt } from './helpers';

describe('signJwt', () => {
	it('produces an HS256 token over the payload that verifies with the secret', () => {
		const payload = { filetype: 'docx', outputtype: 'pdf', url: 'https://example.com/a.docx' };
		const token = signJwt(payload, 'secret');
		const [header, body, signature] = token.split('.');

		const expected = createHmac('sha256', 'secret').update(`${header}.${body}`).digest('base64url');
		expect(signature).toBe(expected);
		expect(decodeJwt(token).header).toEqual({ alg: 'HS256', typ: 'JWT' });
		expect(decodeJwt(token).payload).toEqual(payload);
	});

	it('changes the signature when the secret changes', () => {
		expect(signJwt({}, 'a').split('.')[2]).not.toBe(signJwt({}, 'b').split('.')[2]);
	});
});

describe('escapeJs', () => {
	const samples = [
		'plain',
		'quote " inside',
		'back\\slash',
		'multi\nline\r\nwith\ttab',
		'"); builder.CloseFile(); ("',
		'\\"; injected = true; //',
		'unicode: Привет, 日本語, emoji 🙂',
	];

	it.each(samples)('round-trips %j inside a double-quoted JS literal', (value) => {
		const literal = `"${escapeJs(value)}"`;
		expect(new Function(`return ${literal};`)()).toBe(value);
	});
});

describe('buildScript', () => {
	it('replaces every occurrence of each placeholder', () => {
		const script = buildScript('a=%%X%%; b=%%X%%; c=%%Y%%;', { X: '1', Y: '2' });
		expect(script).toBe('a=1; b=1; c=2;');
	});

	it('leaves unknown placeholders untouched', () => {
		expect(buildScript('%%X%% %%Z%%', { X: 'x' })).toBe('x %%Z%%');
	});

	it('does not expand markers inside inserted values', () => {
		expect(buildScript('%%X%% / %%Y%%', { X: '%%Y%%', Y: 'y' })).toBe('%%Y%% / y');
	});
});
