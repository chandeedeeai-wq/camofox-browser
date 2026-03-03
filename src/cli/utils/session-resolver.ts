import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';

import { atomicWrite } from './fs-helpers';

export interface CommandOptions {
	user?: string;
	tabId?: string;
}

const CAMOFOX_DIR = join(homedir(), '.camofox');
const ACTIVE_TAB_FILE = join(CAMOFOX_DIR, 'active-tab');

function ensureDir(): void {
	mkdirSync(CAMOFOX_DIR, { recursive: true });
}

export function resolveUserId(options: CommandOptions): string {
	if (options.user && options.user.trim().length > 0) {
		return options.user.trim();
	}

	const envUser = process.env.CAMOFOX_CLI_USER;
	if (envUser && envUser.trim().length > 0) {
		return envUser.trim();
	}

	return 'cli-default';
}

export function readActiveTabId(): string | undefined {
	try {
		const value = readFileSync(ACTIVE_TAB_FILE, 'utf8').trim();
		return value.length > 0 ? value : undefined;
	} catch {
		return undefined;
	}
}

export function writeActiveTabId(tabId: string): void {
	ensureDir();
	atomicWrite(ACTIVE_TAB_FILE, `${tabId.trim()}\n`);
}

export function clearActiveTabId(): void {
	try {
		rmSync(ACTIVE_TAB_FILE, { force: true });
	} catch {
		// ignore
	}
}

export function resolveTabId(options: CommandOptions): string | undefined {
	if (options.tabId && options.tabId.trim().length > 0) {
		return options.tabId.trim();
	}
	return readActiveTabId();
}

export function getActiveTabFilePath(): string {
	return ACTIVE_TAB_FILE;
}
