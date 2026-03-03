import { Command } from 'commander';

import type { OutputFormat } from './output/formatter';
import type { HttpTransport } from './transport/http';

export type CliContext = {
	getTransport: () => HttpTransport;
	getFormat: (command: Command) => OutputFormat;
	print: (command: Command, data: unknown) => void;
	handleError: (error: unknown) => never;
};
