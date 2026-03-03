export enum ExitCode {
	SUCCESS = 0,
	GENERAL_ERROR = 1,
	USAGE_ERROR = 2,
	CONNECTION_ERROR = 3,
	AUTH_ERROR = 4,
	TIMEOUT_ERROR = 5,
	NOT_FOUND = 6,
	NAV_ERROR = 7,
	STATE_ERROR = 8,
}

export interface ExitCodeError extends Error {
	exitCode?: number;
	status?: number;
	code?: string;
}

function getMessage(error: ExitCodeError): string {
	if (error.message && error.message.trim().length > 0) {
		return error.message;
	}
	return 'Unexpected error';
}

function mapErrorToExitCode(error: ExitCodeError): number {
	if (typeof error.exitCode === 'number') {
		return error.exitCode;
	}

	if (error.code === 'ECONNREFUSED') {
		return ExitCode.CONNECTION_ERROR;
	}

	if (typeof error.status === 'number') {
		if (error.status >= 200 && error.status <= 299) return ExitCode.SUCCESS;
		if (error.status === 400) return ExitCode.USAGE_ERROR;
		if (error.status === 401 || error.status === 403) return ExitCode.AUTH_ERROR;
		if (error.status === 404) return ExitCode.NOT_FOUND;
		if (error.status === 408) return ExitCode.TIMEOUT_ERROR;
		if (error.status === 409 || error.status === 429) return ExitCode.STATE_ERROR;
		if (error.status === 502) return ExitCode.NAV_ERROR;
		if (error.status === 503) return ExitCode.CONNECTION_ERROR;
		if (error.status >= 500) return ExitCode.GENERAL_ERROR;
	}

	return ExitCode.GENERAL_ERROR;
}

export function handleError(error: Error | ExitCodeError): never {
	const mappedError = error as ExitCodeError;
	const exitCode = mapErrorToExitCode(mappedError);
	const message = getMessage(mappedError);
	process.stderr.write(`Error: ${message}\n`);
	process.exit(exitCode);
}
