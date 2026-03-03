import { Command } from 'commander';

import { resolveCommandUser, requireTabId } from '../utils/command-helpers';
import { clearActiveTabId, resolveTabId, writeActiveTabId } from '../utils/session-resolver';
import { HttpError } from '../transport/http';
import type { CliContext } from '../types';

function parseViewport(viewport: string | undefined): { width: number; height: number } | undefined {
	if (!viewport) return undefined;
	const match = viewport.match(/^(\d+)x(\d+)$/i);
	if (!match) {
		throw new Error('Invalid --viewport format. Expected WxH (example: 1280x720).');
	}
	return { width: Number(match[1]), height: Number(match[2]) };
}

export function registerCoreCommands(program: Command, context: CliContext): void {
	program
		.command('open')
		.description('Open URL in a new tab')
		.argument('<url>', 'URL to open')
		.option('--user <user>', 'user id')
		.option('--viewport <WxH>', 'viewport like 1280x720')
		.option('--geo <preset>', 'geo preset name')
		.action(async (url: string, options: { user?: string; viewport?: string; geo?: string }, command: Command) => {
			try {
				const userId = resolveCommandUser({ command, user: options.user });
				const viewport = parseViewport(options.viewport);
				let response;
				try {
					response = await context.getTransport().post<{ tabId: string }>('/api/create-tab', {
						url,
						userId,
						viewport,
						geoPreset: options.geo,
					});
				} catch (error) {
					if (!(error instanceof HttpError) || error.status !== 404) {
						throw error;
					}
					response = await context.getTransport().post<{ tabId?: string; targetId?: string }>('/tabs/open', {
						url,
						userId,
						listItemId: 'default',
					});
				}

				const tabId = (response.data as { tabId?: string; targetId?: string }).tabId ?? (response.data as { targetId?: string }).targetId;
				if (!tabId) {
					throw new Error('Server did not return tabId');
				}

				writeActiveTabId(tabId);
				const format = context.getFormat(command);
				context.print(command, format === 'plain' ? tabId : { tabId });
			} catch (error) {
				context.handleError(error);
			}
		})
		.addHelpText(
			'after',
			`\nExamples:\n  $ camofox open https://google.com\n  $ camofox open https://gmail.com --user myaccount\n`,
		);

	program
		.command('close')
		.description('Close tab')
		.argument('[tabId]', 'tab id (defaults to active tab)')
		.option('--user <user>', 'user id')
		.action(async (tabIdArg: string | undefined, options: { user?: string }, command: Command) => {
			try {
				const userId = resolveCommandUser({ command, user: options.user });
				const resolvedTabId = resolveTabId({ tabId: tabIdArg });
				if (!resolvedTabId) {
					throw new Error('No tab specified. Provide a tabId or open a tab first with "camofox open <url>".');
				}
				try {
					await context.getTransport().post('/api/close-tab', {
						tabId: resolvedTabId,
						userId,
					});
				} catch (error) {
					if (!(error instanceof HttpError) || error.status !== 404) {
						throw error;
					}
					await context.getTransport().delete(`/tabs/${encodeURIComponent(resolvedTabId)}`, { userId });
				}

				const activeTab = resolveTabId({});
				if (activeTab === resolvedTabId) {
					clearActiveTabId();
				}

				context.print(command, { ok: true, tabId: resolvedTabId });
			} catch (error) {
				context.handleError(error);
			}
		});

	program
		.command('snapshot')
		.description('Capture accessibility snapshot')
		.argument('[tabId]', 'tab id (defaults to active tab)')
		.option('--user <user>', 'user id')
		.action(async (tabIdArg: string | undefined, options: { user?: string }, command: Command) => {
			try {
				const userId = resolveCommandUser({ command, user: options.user });
				const tabId = requireTabId(resolveTabId({ tabId: tabIdArg }), options);
				let response;
				try {
					response = await context.getTransport().post<{ snapshot?: string; tree?: string }>('/api/snapshot-accessibility', {
						tabId,
						userId,
					});
				} catch (error) {
					if (!(error instanceof HttpError) || error.status !== 404) {
						throw error;
					}
					response = await context
						.getTransport()
						.get<{ snapshot?: string }>(`/snapshot?targetId=${encodeURIComponent(tabId)}&userId=${encodeURIComponent(userId)}`);
				}

				const data = response.data as { snapshot?: unknown; tree?: unknown };
				const content = data.snapshot ?? data.tree ?? response.data;
				context.print(command, content);
			} catch (error) {
				context.handleError(error);
			}
		});

	program
		.command('click')
		.description('Click element by ref or selector')
		.argument('<ref>', 'element ref like [e5] or CSS selector')
		.argument('[tabId]', 'tab id (defaults to active tab)')
		.option('--user <user>', 'user id')
		.action(async (ref: string, tabIdArg: string | undefined, options: { user?: string }, command: Command) => {
			try {
				const userId = resolveCommandUser({ command, user: options.user });
				const tabId = requireTabId(resolveTabId({ tabId: tabIdArg }), options);
				try {
					await context.getTransport().post('/api/click', {
						tabId,
						userId,
						ref,
					});
				} catch (error) {
					if (!(error instanceof HttpError) || error.status !== 404) {
						throw error;
					}
					await context.getTransport().post(`/tabs/${encodeURIComponent(tabId)}/click`, {
						userId,
						ref,
					});
				}
				context.print(command, { ok: true });
			} catch (error) {
				context.handleError(error);
			}
		});

	program
		.command('type')
		.description('Type text into element')
		.argument('<ref>', 'element ref like [e5] or CSS selector')
		.argument('<text>', 'text to type')
		.argument('[tabId]', 'tab id (defaults to active tab)')
		.option('--user <user>', 'user id')
		.action(async (ref: string, text: string, tabIdArg: string | undefined, options: { user?: string }, command: Command) => {
			try {
				const userId = resolveCommandUser({ command, user: options.user });
				const tabId = requireTabId(resolveTabId({ tabId: tabIdArg }), options);
				try {
					await context.getTransport().post('/api/type', {
						tabId,
						userId,
						ref,
						text,
					});
				} catch (error) {
					if (!(error instanceof HttpError) || error.status !== 404) {
						throw error;
					}
					await context.getTransport().post(`/tabs/${encodeURIComponent(tabId)}/type`, {
						userId,
						ref,
						text,
					});
				}
				context.print(command, { ok: true });
			} catch (error) {
				context.handleError(error);
			}
		});
}
