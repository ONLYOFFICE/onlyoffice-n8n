/* eslint-disable @n8n/community-nodes/no-restricted-imports, @n8n/community-nodes/no-restricted-globals -- test code runs in Node/vitest, not in n8n */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, openSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IDataObject, INodeExecutionData } from 'n8n-workflow';
import { inject } from 'vitest';

export const DS_URL = process.env.DS_URL ?? 'http://documentserver';
export const DS_SECRET = 'automation-secret-0123456789abcdef0123';

export interface N8nEnvironment {
	home: string;
	env: Record<string, string>;
}

declare module 'vitest' {
	export interface ProvidedContext {
		n8n: N8nEnvironment;
	}
}

/** Run the n8n CLI. Output goes to a file: n8n exits right after printing and cuts off a pipe. */
export async function n8n(args: string[], { home, env }: N8nEnvironment): Promise<string> {
	const log = join(home, `${randomUUID()}.log`);
	const fd = openSync(log, 'w');
	const code = await new Promise((done, fail) =>
		spawn('n8n', args, { cwd: home, env: { ...process.env, ...env }, stdio: ['ignore', fd, fd] })
			.on('error', fail)
			.on('close', done),
	);
	closeSync(fd);
	const output = readFileSync(log, 'utf8');
	if (code !== 0) throw new Error(`n8n ${args.join(' ')} exited with ${code}:\n${output}`);
	return output;
}

interface RunData {
	data: {
		resultData: { runData: Record<string, Array<{ data?: { main: INodeExecutionData[][] } }>> };
	};
}

/** Outputs of one workflow run, by node name. */
class WorkflowRun {
	constructor(private readonly result: RunData) {}

	items(node: string): INodeExecutionData[] {
		const runs = this.result.data.resultData.runData[node];
		if (!runs) throw new Error(`Node "${node}" did not run`);
		return runs.flatMap((run) => run.data?.main[0] ?? []);
	}

	json(node: string): IDataObject[] {
		return this.items(node).map((item) => item.json);
	}

	/** Content of the binary output; n8n keeps it in its storage folder. */
	file(node: string): Buffer {
		const binary = this.items(node)[0]?.binary?.data;
		if (!binary)
			throw new Error(`Node "${node}" returned no file: ${JSON.stringify(this.json(node))}`);
		return readFileSync(join(inject('n8n').home, '.n8n/storage', binary.id!.split(':')[1]));
	}
}

const runs = new Map<string, Promise<WorkflowRun>>();

/** Execute an imported workflow once per test file and return its outputs. */
export function runWorkflow(id: string): Promise<WorkflowRun> {
	if (!runs.has(id)) {
		runs.set(
			id,
			n8n(['execute', `--id=${id}`, '--rawOutput'], inject('n8n')).then((output) => {
				// The run data is printed as indented JSON between log lines.
				const start = output.indexOf('\n{\n') + 1;
				return new WorkflowRun(JSON.parse(output.slice(start, output.indexOf('\n}', start) + 2)));
			}),
		);
	}
	return runs.get(id)!;
}

/** Download a file the Document Server returned (its cache URLs need no auth). */
export async function download(url: string): Promise<Buffer> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`GET ${url} -> ${response.status}`);
	return Buffer.from(await response.arrayBuffer());
}

export const startsWith = (file: Buffer, magic: string) =>
	file.subarray(0, magic.length).toString('latin1') === magic;

export const texts = (items: IDataObject[]) => items.map((item) => item.text).filter(Boolean);
