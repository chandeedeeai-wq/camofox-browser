declare module 'argon2' {
	export const argon2id: number;
	export function hash(
		password: string | Buffer,
		options: {
			type: number;
			timeCost: number;
			memoryCost: number;
			parallelism: number;
			raw: true;
			salt: Buffer;
		},
	): Promise<Buffer>;
}
