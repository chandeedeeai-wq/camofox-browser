import type { Command } from 'commander';

import { formatOutput, type OutputFormat } from '../output/formatter';
import type { CliContext } from '../types';
import { resolveUserId } from './session-resolver';

type CommandWithGlobals = Pick<Command, 'optsWithGlobals'>;

export function resolveCommandUser(options: any): string {
	const command = options?.command as CommandWithGlobals | undefined;
	const optionsUser = typeof options?.user === 'string' ? options.user : undefined;

	let globalUser: string | undefined;
	if (command && typeof command.optsWithGlobals === 'function') {
		const globalOptions = command.optsWithGlobals() as { user?: unknown };
		if (typeof globalOptions.user === 'string') {
			globalUser = globalOptions.user;
		}
	}

	return resolveUserId({ user: optionsUser ?? globalUser });
}

export function requireTabId(tabId: string | undefined, options: any): string {
	void options;
	if (!tabId) {
		throw new Error('No tabId provided and no active tab found. Use "camofox open <url>" first or pass [tabId].');
	}
	return tabId;
}

export function parsePort(value: string): number {
	const port = Number(value);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error('Invalid --port value. Expected integer in range 1-65535.');
	}
	return port;
}

export function parseFormat(value: string | undefined): OutputFormat | undefined {
	if (value === undefined) return undefined;
	if (value === 'json' || value === 'text' || value === 'plain') return value;
	throw new Error('Invalid --format value. Expected one of: json, text, plain.');
}

export function printWithOptionalFormat(
	context: CliContext,
	command: Command,
	formatOption: string | undefined,
	data: unknown,
): void {
	const format = parseFormat(formatOption) ?? context.getFormat(command);
	const output = formatOutput(data, format);
	if (output.length > 0) {
		process.stdout.write(`${output}\n`);
	}
}
