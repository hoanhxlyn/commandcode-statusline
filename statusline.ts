// statusline: styled footer matching oh-my-posh theme
//   ~/path on  branch via model  93% (2h30m)
//   /statusline on|off|refresh

import type {ModApi} from '@commandcode/harness';
import {readFileSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';

interface UsageWindow {
    label: string;
    used: number;
    cap: number | null;
    resetAt: number | null;
    exceeded: boolean;
}

interface BillingPeriod {
    start: number;
    end: number;
}

interface ModelRequestStartEvent {
    model?: unknown;
}

interface TurnEndEvent {
    usage?: {
        inputTokens?: unknown;
        outputTokens?: unknown;
        cacheReadTokens?: unknown;
        cacheWriteTokens?: unknown;
    };
}

interface ConfigSettingChangedEvent {
    setting?: unknown;
    value?: unknown;
}

// OMP theme colours (24-bit)
const C = {
    path: '\x1b[38;2;86;182;194m',     // #56B6C2
    branch: '\x1b[38;2;212;170;252m',  // #D4AAFC
    model: '\x1b[38;2;152;195;121m',   // #98C379
    budget: '\x1b[38;2;220;185;119m',  // #DCB977
    white: '\x1b[38;2;255;255;255m',
    reset: '\x1b[0m',
} as const;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

const RENDER_INTERVAL_MS = MINUTE_MS;
const REFRESH_INTERVAL_MS = 5 * MINUTE_MS;
const FETCH_TIMEOUT_MS = 8_000;

function formatDuration(ms: number): string {
    if (ms <= 0) return 'now';
    const minutes = Math.floor(ms / MINUTE_MS);
    if (minutes < 1) return '<1m';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h${minutes % 60}m`;
    const days = Math.floor(hours / 24);
    return `${days}d${hours % 24}h`;
}

function toEpochMs(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        if (!Number.isNaN(parsed)) return parsed;
    }
    return null;
}

function shortPath(): string {
    const cwd = process.cwd();
    const home = homedir();
    return cwd.startsWith(home) ? `~${cwd.slice(home.length)}` : cwd;
}

export default function (cmd: ModApi): void {
    let enabled = true;
    let modelId = '';
    let branch = '';
    let windows: UsageWindow[] = [];
    let period: BillingPeriod | null = null;

    const problems = new Map<string, string>();
    const fail = (where: string, reason: unknown) =>
        problems.set(where, reason instanceof Error ? reason.message : String(reason));

    const STATE_FILE = join(homedir(), '.commandcode', 'statusline.state.json');

    function saveState(): void {
        try {
            writeFileSync(STATE_FILE, JSON.stringify({enabled}, null, 2));
            problems.delete('state');
        } catch (error) {
            fail('state', error);
        }
    }

    function loadState(): void {
        try {
            const saved = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
            if (typeof saved.enabled === 'boolean') enabled = saved.enabled;
        } catch (error) {
            if (!String(error).includes('ENOENT')) fail('state', error);
        }
    }
    loadState();

    function readConfigModel(): string {
        try {
            const config = JSON.parse(readFileSync(join(homedir(), '.commandcode', 'config.json'), 'utf8'));
            return typeof config.model === 'string' ? config.model : '';
        } catch (error) {
            fail('config', error);
            return '';
        }
    }

    function readApiKey(): string {
        if (process.env.COMMAND_CODE_API_KEY) return process.env.COMMAND_CODE_API_KEY;
        try {
            const auth = JSON.parse(readFileSync(join(homedir(), '.commandcode', 'auth.json'), 'utf8'));
            return typeof auth.apiKey === 'string' ? auth.apiKey : '';
        } catch (error) {
            fail('auth', error);
            return '';
        }
    }

    async function refreshUsage(): Promise<void> {
        const apiKey = readApiKey();
        if (!apiKey) {
            fail('auth', 'no apiKey');
            render();
            return;
        }
        problems.delete('auth');

        const getJson = async (path: string): Promise<Record<string, any>> => {
            const response = await fetch(`https://api.commandcode.ai${path}`, {
                headers: {Authorization: `Bearer ${apiKey}`},
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json() as Promise<Record<string, any>>;
        };

        let orgId = '';
        try {
            const whoami = await getJson('/alpha/whoami');
            orgId = whoami?.orgId ?? whoami?.user?.orgId ?? whoami?.org?.id ?? whoami?.data?.orgId ?? '';
        } catch {}
        const orgQuery = orgId ? `?orgId=${encodeURIComponent(orgId)}` : '';

        try {
            const subscription = await getJson(`/alpha/billing/subscriptions${orgQuery}`);
            const billing = subscription?.data ?? subscription;
            const start = toEpochMs(billing?.currentPeriodStart);
            const end = toEpochMs(billing?.currentPeriodEnd);
            period = start != null && end != null && end > start ? {start, end} : null;
            problems.delete('period');
        } catch (error) {
            fail('period', error);
        }

        const next: UsageWindow[] = [];
        try {
            const raw = await getJson(`/alpha/billing/credits${orgQuery}`);
            const credits = raw?.credits ?? raw?.data ?? raw;
            const windowLimits = credits?.windowLimits ?? raw?.windowLimits;
            for (const [label, field] of [['5h', 'fiveHour'], ['1w', 'weekly']] as const) {
                const limit = windowLimits?.[field];
                if (!limit || typeof limit.used !== 'number') continue;
                next.push({
                    label,
                    used: limit.used,
                    cap: typeof limit.cap === 'number' ? limit.cap : null,
                    resetAt: toEpochMs(limit.resetAt),
                    exceeded: limit.exceeded === true,
                });
            }

            const monthly = credits?.credits?.monthlyCredits ?? raw?.credits?.monthlyCredits;
            if (monthly != null) {
                let used = NaN;
                let cap: number | null = null;
                let remaining: number | null = null;
                let resetAt: number | null = null;
                if (typeof monthly === 'object') {
                    used = Number(monthly.used);
                    cap = typeof monthly.cap === 'number' ? monthly.cap : null;
                    resetAt = toEpochMs(monthly.resetAt);
                } else {
                    remaining = Number(monthly);
                }
                if (!Number.isFinite(used)) {
                    try {
                        const summary = await getJson(`/alpha/usage/summary${orgQuery}`);
                        used = Number(summary?.totalCost ?? summary?.data?.totalCost ?? summary?.summary?.totalCost);
                        problems.delete('summary');
                    } catch (error) {
                        fail('summary', error);
                    }
                }
                if (remaining != null && Number.isFinite(used)) cap = used + remaining;
                if (!resetAt) resetAt = period?.end ?? null;
                const exceeded = remaining != null ? remaining <= 0 : cap != null && used >= cap;
                if (Number.isFinite(used)) next.push({label: '1m', used, cap, resetAt, exceeded});
            }
        } catch (error) {
            fail('credits', error);
            render();
            return;
        }
        problems.delete('credits');
        windows = next;
        render();
    }

    async function refreshBranch(): Promise<void> {
        try {
            const named = await cmd.exec({command: 'git', args: ['branch', '--show-current']});
            branch = named.stdout.trim();
            if (!branch) {
                const detached = await cmd.exec({command: 'git', args: ['rev-parse', '--short', 'HEAD']});
                branch = detached.code === 0 ? `@${detached.stdout.trim()}` : '';
            }
        } catch {
            branch = '';
        }
        render();
    }

    const moneyLeft = (w: UsageWindow) => w.cap && w.cap > 0 ? w.cap - w.used : Infinity;

    function bestWindow(): UsageWindow | null {
        if (!windows.length) return null;
        const blocked = windows.filter(w => w.exceeded);
        if (blocked.length) {
            const opensAt = (w: UsageWindow) => Math.min(w.resetAt ?? Infinity, period?.end ?? Infinity);
            return blocked.reduce((latest, c) => opensAt(c) > opensAt(latest) ? c : latest);
        }
        return windows.reduce<UsageWindow | null>(
            (best, c) => (!best || moneyLeft(c) < moneyLeft(best) ? c : best),
            null,
        );
    }

    function budgetText(): string {
        const w = bestWindow();
        if (!w) return '';
        if (w.exceeded) {
            const reset = w.resetAt ?? period?.end;
            const time = reset ? formatDuration(reset - Date.now()) : null;
            return `\x1b[38;2;227;100;100mexceeded${time ? `, renews ${time}` : ''}${C.reset}`;
        }
        if (w.cap == null || w.cap <= 0) return '';
        const percent = Math.round(((w.cap - w.used) / w.cap) * 100);
        const time = w.resetAt ? formatDuration(w.resetAt - Date.now()) : null;
        return `${C.budget}\uf241 ${percent}%${time ? ` (${time})` : ''}${C.reset}`;
    }

    function render(): void {
        if (!enabled || !cmd.ui.capabilities.status) {
            cmd.ui.setStatus(null);
            return;
        }

        const parts: string[] = [];

        parts.push(`${C.path}${shortPath()}${C.reset}`);

        if (branch) {
            parts.push(`${C.white}on${C.reset} ${C.branch}\ue0a0 ${branch}${C.reset}`);
        }

        if (modelId) {
            parts.push(`${C.white}via${C.reset} ${C.model}${modelId}${C.reset}`);
        }

        const budget = budgetText();
        if (budget) {
            parts.push(budget);
        }

        if (problems.size) {
            parts.push(`${C.budget}⚠ ${[...problems.keys()].join(',')}${C.reset}`);
        }

        cmd.ui.setStatus(parts.join(' '));
    }

    cmd.on('model_request_start', (event: ModelRequestStartEvent) => {
        const requested = typeof event?.model === 'string' ? event.model : '';
        if (!requested || requested === modelId) return;
        modelId = requested;
        render();
    });

    cmd.on('turn_end', (_event: TurnEndEvent) => {
        render();
    });

    cmd.on('config_setting_changed', (event: ConfigSettingChangedEvent) => {
        const setting = typeof event?.setting === 'string' ? event.setting : '';
        const value = typeof event?.value === 'string' ? event.value : '';
        if (/^model$/i.test(setting) && value) {
            modelId = value;
            render();
        }
    });

    cmd.hooks({
        onSessionStart: () => {
            if (!modelId) modelId = readConfigModel();
            render();
            void refreshUsage();
            void refreshBranch();
        },
        onSessionEnd: () => cmd.ui.setStatus(null),
    });

    cmd.addCommand({
        name: 'statusline',
        description: 'on|off|refresh',
        argumentHint: '[on|off|refresh]',
        handler: ({args}) => {
            const command = (typeof args === 'string' ? args : '').trim().toLowerCase();
            if (command === 'off') {
                enabled = false;
                saveState();
                render();
                return {message: 'statusline off'};
            }
            if (command === 'on') {
                enabled = true;
                saveState();
                render();
                return {message: 'statusline on'};
            }
            if (command === 'refresh') {
                void refreshUsage();
                void refreshBranch();
                return {message: 'refreshing...'};
            }
            return {message: `statusline ${enabled ? 'on' : 'off'} · /statusline on|off|refresh`};
        },
    });

    if (cmd.ui.capabilities.status) {
        const renderTimer = setInterval(() => render(), RENDER_INTERVAL_MS);
        const refreshTimer = setInterval(() => {
            void refreshUsage();
            void refreshBranch();
        }, REFRESH_INTERVAL_MS);
        renderTimer.unref?.();
        refreshTimer.unref?.();
    }
}