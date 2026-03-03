import { randomBytes } from 'node:crypto';

export type OutputFormat = 'json' | 'text' | 'plain';

function stringifyText(data: unknown): string {
	if (data === null || data === undefined) return '';
	if (typeof data === 'string') return data;
	if (typeof data === 'number' || typeof data === 'boolean') return String(data);

	if (Array.isArray(data)) {
		return data.map((item) => `- ${stringifyText(item)}`).join('\n');
	}

	if (typeof data === 'object') {
		const entries = Object.entries(data as Record<string, unknown>);
		if (entries.length === 0) return '';
		return entries.map(([key, value]) => `${key}: ${stringifyText(value)}`).join('\n');
	}

	return String(data);
}

export function formatOutput(data: unknown, format: OutputFormat): string {
	if (format === 'json') {
		return JSON.stringify(data, null, 2);
	}

	if (format === 'plain') {
		if (typeof data === 'string') return data;
		if (typeof data === 'number' || typeof data === 'boolean') return String(data);
		if (Array.isArray(data)) return data.map((item) => stringifyText(item)).join('\n');
		if (data && typeof data === 'object') {
			const entries = Object.entries(data as Record<string, unknown>);
			if (entries.length === 1) return stringifyText(entries[0][1]);
			return entries.map(([, value]) => stringifyText(value)).join(' ');
		}
		return '';
	}

	return stringifyText(data);
}

/** @internal Reserved for Phase 2 — LLM content boundary support */
export function wrapWithBoundary(content: string, nonce?: string): string {
	const effectiveNonce = nonce && nonce.trim().length > 0 ? nonce.trim() : randomBytes(8).toString('hex');
	return `<<<BOUNDARY_${effectiveNonce}>>>\n${content}\n<<<END_${effectiveNonce}>>>`;
}
