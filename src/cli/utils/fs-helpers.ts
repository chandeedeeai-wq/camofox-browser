import * as fs from 'node:fs';

type AtomicWriteOptions = {
	mode?: number;
};

export function atomicWrite(filePath: string, content: string, options: AtomicWriteOptions = {}): void {
	const tempPath = `${filePath}.tmp.${process.pid}`;
	try {
		fs.writeFileSync(tempPath, content, { encoding: 'utf8', mode: options.mode ?? 0o644 });
		fs.renameSync(tempPath, filePath);
	} catch (error) {
		try {
			fs.unlinkSync(tempPath);
		} catch {
			// ignore cleanup error
		}
		throw error;
	}
}
