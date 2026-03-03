export interface HttpRequestOptions {
	timeoutMs?: number;
	headers?: Record<string, string>;
}

export interface HttpResponse<T = unknown> {
	status: number;
	data: T;
	headers: Headers;
}

export class HttpError extends Error {
	public readonly status?: number;
	public readonly code?: string;
	public readonly exitCode: number;
	public readonly details?: unknown;

	constructor(message: string, options: { status?: number; code?: string; details?: unknown }) {
		super(message);
		this.name = 'HttpError';
		this.status = options.status;
		this.code = options.code;
		this.details = options.details;
		this.exitCode = mapStatusToExitCode(options.status, options.code);
	}
}

function mapStatusToExitCode(status?: number, code?: string): number {
	if (code === 'ECONNREFUSED') return 3;
	if (typeof status !== 'number') return 1;
	if (status >= 200 && status <= 299) return 0;
	if (status === 400) return 2;
	if (status === 401 || status === 403) return 4;
	if (status === 404) return 6;
	if (status === 408) return 5;
	if (status === 409 || status === 429) return 8;
	if (status === 500) return 1;
	if (status === 502) return 7;
	if (status === 503) return 3;
	return 1;
}

function getErrorMessage(status: number, body: unknown): string {
	if (body && typeof body === 'object' && 'error' in body) {
		const message = (body as { error?: unknown }).error;
		if (typeof message === 'string' && message.trim().length > 0) {
			return message;
		}
	}
	return `HTTP ${status}`;
}

export class HttpTransport {
	private readonly baseUrl: string;
	private readonly timeoutMs: number;

	constructor(port: number, timeoutMs = 20_000) {
		this.baseUrl = `http://127.0.0.1:${port}`;
		this.timeoutMs = timeoutMs;
	}

	public getBaseUrl(): string {
		return this.baseUrl;
	}

	public async get<T = unknown>(path: string, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
		return this.request<T>('GET', path, undefined, options);
	}

	public async post<T = unknown>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
		return this.request<T>('POST', path, body, options);
	}

	public async put<T = unknown>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
		return this.request<T>('PUT', path, body, options);
	}

	public async delete<T = unknown>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
		return this.request<T>('DELETE', path, body, options);
	}

	public async request<T = unknown>(
		method: 'GET' | 'POST' | 'PUT' | 'DELETE',
		path: string,
		body?: unknown,
		options?: HttpRequestOptions,
	): Promise<HttpResponse<T>> {
		const timeoutMs = options?.timeoutMs ?? this.timeoutMs;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
		timeoutId.unref();

		const headers: Record<string, string> = {
			'content-type': 'application/json',
			...(options?.headers ?? {}),
		};

		const url = `${this.baseUrl}${path}`;

		try {
			const response = await fetch(url, {
				method,
				headers,
				body: body === undefined ? undefined : JSON.stringify(body),
				signal: controller.signal,
			});

			const contentType = response.headers.get('content-type') ?? '';
			const responseBody = contentType.includes('application/json') ? await response.json() : await response.text();

			if (!response.ok) {
				const message = getErrorMessage(response.status, responseBody);
				throw new HttpError(message, { status: response.status, details: responseBody });
			}

			return {
				status: response.status,
				data: responseBody as T,
				headers: response.headers,
			};
		} catch (error) {
			if (error instanceof HttpError) {
				throw error;
			}

			if (error instanceof Error && error.name === 'AbortError') {
				throw new HttpError(`Request timed out after ${timeoutMs}ms`, { status: 408, code: 'ETIMEDOUT' });
			}

			const code =
				error && typeof error === 'object' && 'cause' in error
					? ((error as { cause?: { code?: string } }).cause?.code ?? undefined)
					: undefined;

			if (code === 'ECONNREFUSED') {
				throw new HttpError('Server not running (connection refused). Start it with "camofox server start".', {
					code,
					status: 503,
				});
			}

			if (error instanceof Error) {
				throw new HttpError(error.message, { code, status: 500 });
			}

			throw new HttpError('Request failed', { code, status: 500 });
		} finally {
			clearTimeout(timeoutId);
		}
	}
}
