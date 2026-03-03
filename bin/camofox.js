#!/usr/bin/env node

const cli = require('../dist/src/cli/index.js');

if (!cli || typeof cli.run !== 'function') {
	console.error('CLI entrypoint is missing. Please run "npm run build" first.');
	process.exit(1);
}

void cli.run(process.argv);
