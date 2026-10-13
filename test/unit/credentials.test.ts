/* eslint-disable @n8n/community-nodes/no-restricted-imports -- test code runs in Node/vitest, not in n8n */
import type { ICredentialTestFunctions, ICredentialsDecrypted, IDataObject } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { OnlyofficeDocs } from '../../nodes/OnlyofficeDocs/OnlyofficeDocs.node';
import { CREDENTIALS, decodeJwt, DS, type Request } from './helpers';

/** Run the credential test against a fake /command that answers `answer` (or throws it). */
async function testCredentials(answer: IDataObject | Error) {
	const requests: Request[] = [];
	const context = {
		helpers: {
			request: async (request: Request) => {
				requests.push(request);
				if (answer instanceof Error) throw answer;
				return answer;
			},
		},
	} as unknown as ICredentialTestFunctions;
	const credential = { id: '1', name: 'Docs', type: 'onlyofficeDocsApi', data: CREDENTIALS };
	const result = await new OnlyofficeDocs().methods.credentialTest.testOnlyofficeDocsApiCredentials.call(
		context,
		credential as ICredentialsDecrypted,
	);
	return { result, requests };
}

describe('credential test', () => {
	it('asks the command service for the version with a command token', async () => {
		const { requests } = await testCredentials({ error: 0, version: '10.0.0.169' });
		expect(requests[0].url).toBe(`${DS}/command`);
		const { token, ...body } = requests[0].body;
		expect(body).toEqual({ c: 'version' });
		expect(decodeJwt(token as string).payload).toEqual({ c: 'version', operation: 'command' });
		expect(requests[0].headers[CREDENTIALS.jwtHeader]).toBe(`Bearer ${token}`);
	});

	it.each([
		[{ error: 0, version: '10.0.0.169' }, 'OK', 'Connection successful, ONLYOFFICE Docs 10.0.0.169'],
		// The command service answers 6 to a token signed with another secret.
		[{ error: 6 }, 'Error', 'JWT secret is invalid'],
		[{ error: 5 }, 'Error', 'Document Server answered with error code 5'],
		[new Error('connect ECONNREFUSED'), 'Error', 'Connection failed: connect ECONNREFUSED'],
	])('%j gives %s', async (answer, status, message) => {
		const { result } = await testCredentials(answer);
		expect(result).toEqual({ status, message });
	});
});
