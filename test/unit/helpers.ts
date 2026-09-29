import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { OnlyofficeDocs } from '../../nodes/OnlyofficeDocs/OnlyofficeDocs.node';

export const DS = 'https://ds.example.com';
export const CREDENTIALS = { docsServerUrl: `${DS}/`, jwtSecret: 'secret', jwtHeader: 'AuthJwt' };

export type Request = IHttpRequestOptions & { body: IDataObject & Buffer; headers: IDataObject };

interface RunOptions {
	params: IDataObject;
	/** Fake Document Server: gets every request of the node, returns its response. */
	http: (request: Request) => unknown;
	items?: INodeExecutionData[];
	credentials?: IDataObject;
	continueOnFail?: boolean;
}

const { properties } = new OnlyofficeDocs().description;

function isShown(property: INodeProperties, values: IDataObject) {
	const { show = {}, hide = {} } = property.displayOptions ?? {};
	return (
		Object.entries(show).every(([name, allowed]) => allowed?.includes(values[name] as string)) &&
		!Object.entries(hide).some(([name, hidden]) => hidden?.includes(values[name] as string))
	);
}

/**
 * Parameter values as n8n keeps them: the given ones plus the defaults of the displayed
 * properties. Hidden parameters have no value, so the node fails if it reads one.
 */
function resolveParameters(params: IDataObject) {
	let values = params;
	// Repeat: defaults of fileSource or outputMode change which properties are displayed.
	for (let pass = 0; pass < 3; pass++) {
		const next = { ...params };
		for (const property of properties) {
			if (!(property.name in next) && isShown(property, values)) {
				next[property.name] = property.default as string;
			}
		}
		values = next;
	}
	return values;
}

/** Execute the node with a fake n8n context and return its output and HTTP requests. */
export async function runNode(options: RunOptions) {
	const values = resolveParameters(options.params);
	const items = options.items ?? [{ json: {} }];
	const requests: Request[] = [];
	const context = {
		getInputData: () => items,
		getNode: () => ({ name: 'ONLYOFFICE Docs', type: 'onlyofficeDocs', parameters: values }),
		continueOnFail: () => options.continueOnFail ?? false,
		getCredentials: async () => options.credentials ?? CREDENTIALS,
		getNodeParameter: (name: string, _item: number, fallback?: unknown) => {
			if (name in values) return values[name];
			if (fallback !== undefined) return fallback;
			throw new Error(`Could not get parameter "${name}"`);
		},
		helpers: {
			httpRequest: async (request: Request) => {
				requests.push(request);
				return await options.http(request);
			},
			prepareBinaryData: async (buffer: Buffer, fileName: string) => ({
				data: buffer.toString('base64'),
				fileName,
			}),
			getBinaryDataBuffer: async (item: number, field: string) =>
				Buffer.from(items[item].binary![field].data, 'base64'),
		},
	} as unknown as IExecuteFunctions;
	const [output] = await new OnlyofficeDocs().execute.call(context);
	return { output, requests };
}

export const decodeJwt = (token: string) => {
	const [header, payload] = token.split('.').slice(0, 2);
	const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString());
	return { header: decode(header), payload: decode(payload) as IDataObject };
};

export const binaryOf = (item: INodeExecutionData) => Buffer.from(item.binary!.data.data, 'base64');

/**
 * Run a Document Builder script against recording stubs of `builder` and `Api` and return the
 * arguments of every call to `method`. Api calls return stubs, so the script runs to the end and
 * sees an empty document.
 */
export function callsOf(script: string, method: string): unknown[][] {
	const calls: Array<[string, unknown[]]> = [];
	const stub = (): unknown =>
		new Proxy(() => {}, {
			get: (_target, key) => {
				if (key === Symbol.toPrimitive) return (hint: string) => (hint === 'number' ? 0 : '');
				if (key === 'length') return 0;
				if (typeof key === 'symbol') return undefined;
				return (...args: unknown[]) => (calls.push([key, args]), stub());
			},
		});
	const builder = new Proxy(
		{},
		{
			get:
				(_target, key) =>
				(...args: unknown[]) =>
					void calls.push([`builder.${String(key)}`, args]),
		},
	);
	new Function('builder', 'Api', script)(builder, stub());
	return calls.filter(([name]) => name === method).map(([, args]) => args);
}
