import type { INodePropertyOptions } from 'n8n-workflow';
import docsFormats from './document-formats/onlyoffice-docs-formats.json';

interface FormatEntry {
	name: string;
	type: string;
	actions: string[];
	convert: string[];
	mime: string[];
}

const formats: FormatEntry[] = docsFormats as FormatEntry[];

const conversionMap = new Map<string, { type: string; targets: string[] }>();
for (const fmt of formats) {
	if (fmt.convert.length > 0) {
		conversionMap.set(fmt.name, { type: fmt.type, targets: fmt.convert });
	}
}

function toOptions(names: string[]): INodePropertyOptions[] {
	return names.sort().map((name) => ({
		name: name.toUpperCase(),
		value: name,
	}));
}

export function getInputFormatOptions(): INodePropertyOptions[] {
	return toOptions(Array.from(conversionMap.keys()));
}

export function getOutputFormatOptions(inputFormat: string): INodePropertyOptions[] {
	const entry = conversionMap.get(inputFormat);
	if (entry && entry.targets.length > 0) {
		return toOptions([...entry.targets]);
	}
	const all = new Set<string>();
	for (const e of conversionMap.values()) {
		for (const f of e.targets) all.add(f);
	}
	return toOptions(Array.from(all));
}

export function getFormatsConvertibleTo(outputFormat: string): INodePropertyOptions[] {
	const result: string[] = [];
	for (const [name, entry] of conversionMap) {
		if (entry.targets.includes(outputFormat)) {
			result.push(name);
		}
	}
	return toOptions(result);
}

export function getSpreadsheetFormatsConvertibleTo(outputFormat: string): INodePropertyOptions[] {
	const result: string[] = [];
	for (const [name, entry] of conversionMap) {
		if (entry.type === 'cell' && entry.targets.includes(outputFormat)) {
			result.push(name);
		}
	}
	return toOptions(result);
}

export function getThumbnailInputFormats(): INodePropertyOptions[] {
	const result: string[] = [];
	for (const [name, entry] of conversionMap) {
		if (entry.targets.includes('png') || entry.targets.includes('jpg')) {
			result.push(name);
		}
	}
	return toOptions(result);
}
