import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { atomicWrite } from '../utils/fs-helpers';
import { decrypt, encrypt, type EncryptedPayload } from './crypto';

export const VAULT_DIR = join(homedir(), '.camofox', 'vault');

export interface VaultProfile {
	name: string;
	url?: string;
	username: string;
	password: string;
	notes?: string;
	createdAt: string;
	updatedAt: string;
}

function ensureVaultDir(): void {
	mkdirSync(VAULT_DIR, { recursive: true, mode: 0o700 });
}

export function validateProfileName(name: string): boolean {
	return /^[a-zA-Z0-9_-]+$/.test(name) && name.length > 0 && name.length <= 64;
}

function assertProfileName(name: string): string {
	if (!validateProfileName(name)) {
		throw new Error('Invalid profile name. Use only letters, numbers, underscore, and dash (max 64 chars).');
	}
	return name;
}

function profileFilePath(name: string): string {
	return join(VAULT_DIR, `${name}.enc`);
}

export async function saveProfile(name: string, profile: VaultProfile, masterPassword: string): Promise<void> {
	const profileName = assertProfileName(name);
	ensureVaultDir();
	const serialized = JSON.stringify(profile);
	const payload = await encrypt(serialized, masterPassword);
	atomicWrite(profileFilePath(profileName), `${JSON.stringify(payload)}\n`, { mode: 0o600 });
}

export async function loadProfile(name: string, masterPassword: string): Promise<VaultProfile> {
	const profileName = assertProfileName(name);
	const filePath = profileFilePath(profileName);
	let raw: string;
	try {
		raw = readFileSync(filePath, 'utf8');
	} catch (error: any) {
		if (error?.code === 'ENOENT') {
			throw new Error(`Profile '${profileName}' not found`);
		}
		throw error;
	}
	let payload: EncryptedPayload;
	try {
		payload = JSON.parse(raw) as EncryptedPayload;
	} catch {
		throw new Error(`Profile '${profileName}' is corrupted`);
	}

	try {
		const decrypted = await decrypt(payload, masterPassword);
		const parsed = JSON.parse(decrypted) as VaultProfile;
		if (
			typeof parsed?.name !== 'string' ||
			typeof parsed?.username !== 'string' ||
			typeof parsed?.password !== 'string' ||
			typeof parsed?.createdAt !== 'string' ||
			typeof parsed?.updatedAt !== 'string'
		) {
			throw new Error(`Profile '${profileName}' is corrupted`);
		}
		return parsed;
	} catch (error) {
		if (error instanceof Error && error.message.includes('Wrong password or data was tampered')) {
			throw new Error('Invalid master password');
		}
		throw error;
	}
}

export function listProfiles(): string[] {
	if (!existsSync(VAULT_DIR)) {
		return [];
	}

	return readdirSync(VAULT_DIR)
		.filter((entry) => entry.endsWith('.enc'))
		.map((entry) => entry.slice(0, -4))
		.filter((entry) => validateProfileName(entry))
		.sort((a, b) => a.localeCompare(b));
}

export function deleteProfile(name: string): void {
	const profileName = assertProfileName(name);
	rmSync(profileFilePath(profileName), { force: true });
}
