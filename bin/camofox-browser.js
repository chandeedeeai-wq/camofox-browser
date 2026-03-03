#!/usr/bin/env node

const args = process.argv.slice(2);

if (args.includes('--version') || args.includes('-v')) {
	const pkg = require('../package.json');
	console.log(pkg.version);
	process.exit(0);
}

const firstArg = args[0];
const shouldRunServer = args.length === 0 || firstArg === 'serve';

if (shouldRunServer) {
	require('../dist/src/server.js');
	return;
}

const cli = require('../dist/src/cli/index.js');
if (!cli || typeof cli.run !== 'function') {
	console.error('CLI entrypoint is missing. Please run "npm run build" first.');
	process.exit(1);
}

void cli.run(process.argv);
