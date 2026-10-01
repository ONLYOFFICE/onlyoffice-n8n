/* eslint-disable @n8n/community-nodes/no-restricted-imports, @n8n/community-nodes/no-restricted-globals -- test code runs in Node/vitest, not in n8n */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { networkInterfaces, tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import type { TestProject } from 'vitest/node';

import { signJwt } from '../../nodes/OnlyofficeDocs/GenericFunctions';
import { DS_SECRET, DS_URL, n8n, type N8nEnvironment } from './n8n';

const ROOT = resolve(__dirname, '../..');
const FIXTURES = join(ROOT, 'test/fixtures');

/** Wait for the Document Server and return its version. */
async function documentServerVersion(): Promise<string> {
	for (let attempt = 0; attempt < 100; attempt++) {
		try {
			const token = signJwt({ c: 'version' }, DS_SECRET);
			const response = await fetch(`${DS_URL}/command`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({ c: 'version', token }),
			});
			const { version } = (await response.json()) as { version?: string };
			if (version) return version;
		} catch {
			// Not started yet.
		}
		await new Promise((done) => setTimeout(done, 3000));
	}
	throw new Error(`Document Server at ${DS_URL} is not ready`);
}

/** Serve test/fixtures on this machine's address, where the Document Server can reach them. */
function serveFixtures() {
	const ip = Object.values(networkInterfaces())
		.flat()
		.find((address) => address?.family === 'IPv4' && !address.internal)!.address;
	const server = createServer((request, response) => {
		try {
			response.end(readFileSync(join(FIXTURES, basename(request.url ?? ''))));
		} catch {
			response.writeHead(404).end();
		}
	}).listen(8099);
	return { server, url: `http://${ip}:8099/` };
}

export default async function setup(project: TestProject) {
	const dsVersion = await documentServerVersion();
	const fixtures = serveFixtures();
	const home = mkdtempSync(join(tmpdir(), 'n8n-'));
	const environment: N8nEnvironment = {
		home,
		env: {
			// vitest sets NODE_ENV=test, and the n8n CLI then exits without doing anything.
			NODE_ENV: 'production',
			N8N_USER_FOLDER: home,
			N8N_ENCRYPTION_KEY: 'tests',
			// `n8n execute` prints the run data only at the info level.
			N8N_LOG_LEVEL: 'info',
			N8N_DIAGNOSTICS_ENABLED: 'false',
			// The workflows read FIXTURES_URL.
			N8N_BLOCK_ENV_ACCESS_IN_NODE: 'false',
			FIXTURES_URL: fixtures.url,
		},
	};

	// Install the packed package like a manually installed community node.
	const nodes = join(home, '.n8n/nodes');
	mkdirSync(nodes, { recursive: true });
	const tarball = execFileSync('pnpm', ['pack', '--pack-destination', home], { cwd: ROOT })
		.toString()
		.trim()
		.split('\n')
		.pop()!;
	execFileSync('npm', ['install', '--prefix', nodes, join(home, basename(tarball))], {
		stdio: 'ignore',
	});

	const credentials = join(home, 'credentials.json');
	writeFileSync(
		credentials,
		JSON.stringify([
			{
				id: 'ooDocsTestCred01',
				name: 'ONLYOFFICE Docs (tests)',
				type: 'onlyofficeDocsApi',
				data: { docsServerUrl: DS_URL, jwtSecret: DS_SECRET, jwtHeader: 'Authorization' },
			},
		]),
	);
	await n8n(['import:credentials', `--input=${credentials}`], environment);
	await n8n(
		['import:workflow', '--separate', `--input=${join(ROOT, 'test/automation/workflows')}`],
		environment,
	);

	process.stdout.write(`Document Server ${dsVersion} at ${DS_URL}, fixtures at ${fixtures.url}\n`);
	project.provide('n8n', environment);

	return () => {
		fixtures.server.close();
		rmSync(home, { recursive: true, force: true });
	};
}
