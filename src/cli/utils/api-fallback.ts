import type { HttpTransport } from '../transport/http';
import { HttpError } from '../transport/http';

export async function apiRequestWithFallback<T>(
	transport: HttpTransport,
	apiPath: string,
	legacyPath: string,
	body: Record<string, unknown>,
): Promise<T> {
	try {
		const response = await transport.request<T>('POST', apiPath, body);
		return response.data;
	} catch (error) {
		if (!(error instanceof HttpError) || error.status !== 404) {
			throw error;
		}
		const response = await transport.request<T>('POST', legacyPath, body);
		return response.data;
	}
}

export const requestWithFallback = apiRequestWithFallback;
