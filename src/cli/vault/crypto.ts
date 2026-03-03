import crypto from 'node:crypto';

export interface EncryptedPayload {
	version: 1;
	kdf: 'argon2id' | 'pbkdf2';
	salt: string;
	iv: string;
	tag: string;
	data: string;
}

type KdfResult = {
	key: Buffer;
	kdf: EncryptedPayload['kdf'];
};

type Argon2Module = {
	argon2id: number;
	hash: (password: string | Buffer, options: {
		type: number;
		timeCost: number;
		memoryCost: number;
		parallelism: number;
		raw: true;
		salt: Buffer;
	}) => Promise<Buffer>;
};

let argon2ModulePromise: Promise<Argon2Module | null> | undefined;
let hasWarnedArgon2Fallback = false;

function warnArgon2Fallback(): void {
	if (hasWarnedArgon2Fallback) return;
	hasWarnedArgon2Fallback = true;
	process.stderr.write('Warning: optional dependency "argon2" is unavailable. Falling back to PBKDF2.\n');
}

async function loadArgon2(): Promise<Argon2Module | null> {
	if (!argon2ModulePromise) {
		argon2ModulePromise = import('argon2')
			.then((mod) => mod as unknown as Argon2Module)
			.catch(() => null);
	}
	return argon2ModulePromise;
}

function deriveWithPbkdf2(password: string, salt: Buffer): Buffer {
	const passwordBuffer = Buffer.from(password, 'utf8');
	try {
		return crypto.pbkdf2Sync(passwordBuffer, salt, 600_000, 32, 'sha512');
	} finally {
		passwordBuffer.fill(0);
	}
}

async function deriveKeyWithMeta(password: string, salt: Buffer, preferredKdf?: EncryptedPayload['kdf']): Promise<KdfResult> {
	const argon2 = await loadArgon2();

	if (preferredKdf === 'argon2id' && !argon2) {
		throw new Error('Cannot decrypt payload encrypted with argon2id: optional dependency "argon2" is not installed.');
	}

	if (preferredKdf === 'pbkdf2') {
		return { key: deriveWithPbkdf2(password, salt), kdf: 'pbkdf2' };
	}

	if (argon2) {
		const passwordBuffer = Buffer.from(password, 'utf8');
		try {
			const key = await argon2.hash(passwordBuffer, {
				type: argon2.argon2id,
				timeCost: 3,
				memoryCost: 65536,
				parallelism: 4,
				raw: true,
				salt,
			});
			return { key, kdf: 'argon2id' };
		} finally {
			passwordBuffer.fill(0);
		}
	}

	warnArgon2Fallback();
	return { key: deriveWithPbkdf2(password, salt), kdf: 'pbkdf2' };
}

export async function encrypt(data: string, password: string): Promise<EncryptedPayload> {
	const salt = crypto.randomBytes(16);
	const iv = crypto.randomBytes(12);
	const { key, kdf } = await deriveKeyWithMeta(password, salt);

	try {
		const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
		let encrypted = cipher.update(data, 'utf8');
		encrypted = Buffer.concat([encrypted, cipher.final()]);
		const tag = cipher.getAuthTag();

		return {
			version: 1,
			kdf,
			salt: salt.toString('base64'),
			iv: iv.toString('base64'),
			tag: tag.toString('base64'),
			data: encrypted.toString('base64'),
		};
	} finally {
		key.fill(0);
	}
}

function decodeBase64(value: string, name: string): Buffer {
	try {
		return Buffer.from(value, 'base64');
	} catch {
		throw new Error(`Invalid encrypted payload: malformed ${name}.`);
	}
}

export async function decrypt(payload: EncryptedPayload, password: string): Promise<string> {
	if (payload.version !== 1) {
		throw new Error(`Unsupported vault payload version: ${String(payload.version)}`);
	}

	const argon2 = await loadArgon2();
	if (payload.kdf === 'argon2id' && argon2 === null) {
		throw new Error(
			'This vault was encrypted with Argon2id but the argon2 package is not installed.\n' +
				'Install it with: npm install argon2\n' +
				'Or re-encrypt with PBKDF2 on the original machine using: camofox auth change-password <profile>',
		);
	}

	const salt = decodeBase64(payload.salt, 'salt');
	const iv = decodeBase64(payload.iv, 'iv');
	const tag = decodeBase64(payload.tag, 'tag');
	const encrypted = decodeBase64(payload.data, 'data');

	if (salt.length !== 16 || iv.length !== 12 || tag.length !== 16) {
		throw new Error('Invalid encrypted payload: unexpected salt/iv/tag length.');
	}

	const { key } = await deriveKeyWithMeta(password, salt, payload.kdf);
	try {
		const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
		decipher.setAuthTag(tag);
		let decrypted = decipher.update(encrypted);
		decrypted = Buffer.concat([decrypted, decipher.final()]);
		const output = decrypted.toString('utf8');
		decrypted.fill(0);
		return output;
	} catch {
		throw new Error('Failed to decrypt vault payload. Wrong password or data was tampered.');
	} finally {
		key.fill(0);
	}
}
