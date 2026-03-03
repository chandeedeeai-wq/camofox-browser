import { readFileSync } from 'node:fs';

import { Command } from 'commander';

import type { CliContext } from '../types';

type ParsedScriptLine = {
	command: string;
	args: string[];
};

function readScriptInput(filePath: string): string {
	if (filePath === '-') {
		return readFileSync(0, 'utf8');
	}
	return readFileSync(filePath, 'utf8');
}

function splitCommandLine(line: string): string[] {
	const tokens: string[] = [];
	let current = '';
	let quote: 'single' | 'double' | null = null;
	let escaped = false;

	for (let index = 0; index < line.length; index += 1) {
		const char = line[index];

		if (escaped) {
			current += char;
			escaped = false;
			continue;
		}

		if (char === '\\') {
			escaped = true;
			continue;
		}

		if (quote === 'single') {
			if (char === "'") {
				quote = null;
			} else {
				current += char;
			}
			continue;
		}

		if (quote === 'double') {
			if (char === '"') {
				quote = null;
			} else {
				current += char;
			}
			continue;
		}

		if (char === "'") {
			quote = 'single';
			continue;
		}

		if (char === '"') {
			quote = 'double';
			continue;
		}

		if (/\s/.test(char)) {
			if (current.length > 0) {
				tokens.push(current);
				current = '';
			}
			continue;
		}

		current += char;
	}

	if (escaped) {
		current += '\\';
	}

	if (quote !== null) {
		throw new Error('Unterminated quote in script line.');
	}

	if (current.length > 0) {
		tokens.push(current);
	}

	return tokens;
}

function parseScript(script: string): ParsedScriptLine[] {
	const commands: ParsedScriptLine[] = [];
	const lines = script.split(/\r?\n/);

	for (let index = 0; index < lines.length; index += 1) {
		const rawLine = lines[index] ?? '';
		const trimmed = rawLine.trim();
		if (trimmed.length === 0 || trimmed.startsWith('#')) {
			continue;
		}

		const tokens = splitCommandLine(trimmed);
		if (tokens.length === 0) continue;
		const [command, ...args] = tokens;
		if (!command) continue;
		commands.push({ command, args });
	}

	return commands;
}

async function runCommandLine(
	program: Command,
	parsed: ParsedScriptLine,
	globalFormat: string,
): Promise<void> {
	if (parsed.command === 'run') {
		throw new Error('Nested "run" command is not supported in scripts.');
	}

	const originalExit = process.exit;
	(process.exit as unknown as (code?: number) => never) = ((code?: number) => {
		const error = new Error(`PIPELINE_COMMAND_EXIT_${String(code ?? 0)}`) as Error & { exitCode?: number };
		error.exitCode = code ?? 0;
		throw error;
	}) as unknown as typeof process.exit;

	try {
		await program.parseAsync(['--format', globalFormat, parsed.command, ...parsed.args], {
			from: 'user',
		});
	} finally {
		process.exit = originalExit;
	}
}

export function registerPipeCommands(program: Command, _context: CliContext): void {
	program
		.command('run')
		.description('Run multiple CLI commands from script file or stdin')
		.argument('<script-file>', 'path to script file, or - for stdin')
		.option('--continue-on-error', 'continue executing remaining commands on failures')
		.action(async (scriptFile: string, options: { continueOnError?: boolean }, command: Command) => {
			const script = readScriptInput(scriptFile);
			const commands = parseScript(script);

			if (commands.length === 0) {
				process.stdout.write('No commands to run.\n');
				return;
			}

			const globals = command.optsWithGlobals() as { format?: string };
			const globalFormat = globals.format ?? 'text';

			for (let index = 0; index < commands.length; index += 1) {
				const parsed = commands[index];
				if (!parsed) continue;
				const lineNumber = index + 1;
				process.stdout.write(`$ camofox ${parsed.command}${parsed.args.length > 0 ? ` ${parsed.args.join(' ')}` : ''}\n`);

				try {
					await runCommandLine(program, parsed, globalFormat);
				} catch (error) {
					if (!options.continueOnError) {
						throw new Error(`Script failed at line ${lineNumber}: ${error instanceof Error ? error.message : String(error)}`);
					}
				}
			}
		})
		.addHelpText(
			'after',
			`\nExamples:\n  $ camofox run commands.txt\n  $ cat commands.txt | camofox run -\n  $ camofox run commands.txt --continue-on-error\n`,
		);
}
