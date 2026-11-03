import type { AlertProvider } from '../../contracts/src/index.ts';
import { redactSecrets } from './policy.ts';

export interface AlertTransportResult {
  ok: boolean;
  /** HTTP status, when a response was received at all. */
  status?: number;
  /** Seconds, from a 429 body. */
  retry_after?: number;
  /** Already redacted. */
  error?: string;
}

/**
 * The transport is an interface, not a `fetch` call, for one reason: without it
 * the retry policy can only be tested against the real Bot API, which means it
 * is not tested at all.
 */
export interface AlertTransport {
  readonly name: AlertProvider;
  send(chatId: string, text: string): Promise<AlertTransportResult>;
}

/**
 * Transport used when no bot token is configured.
 *
 * It succeeds, and that is the honest behaviour: from the dispatcher's point of
 * view the message was accepted. The lie would be calling the channel
 * `telegram`. `name: 'fake'` is recorded on every delivery, so a demo without
 * credentials can never be read as a working integration.
 */
export class FakeTransport implements AlertTransport {
  readonly name = 'fake' as const;
  readonly sent: Array<{ chatId: string; text: string }> = [];
  private readonly script: AlertTransportResult[];

  constructor(script: AlertTransportResult[] = []) {
    this.script = [...script];
  }

  async send(chatId: string, text: string): Promise<AlertTransportResult> {
    this.sent.push({ chatId, text });
    const next = this.script.shift();
    return next ?? { ok: true, status: 200 };
  }
}

export interface TelegramTransportOptions {
  token: string;
  /** Injected so tests can drive it without network access. */
  fetchImpl?: typeof fetch;
  apiBase?: string;
}

/**
 * Real Bot API transport.
 *
 * The token is read from the constructor argument (which the caller reads from
 * `process.env`) and never stored anywhere else. Every error string is scrubbed
 * before it can reach an audit event: `fetch` errors routinely include the
 * request URL, and for the Bot API the URL is the credential.
 */
export class TelegramTransport implements AlertTransport {
  readonly name = 'telegram' as const;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private readonly apiBase: string;

  constructor(options: TelegramTransportOptions) {
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.apiBase = (options.apiBase ?? 'https://api.telegram.org').replace(/\/$/, '');
  }

  async send(chatId: string, text: string): Promise<AlertTransportResult> {
    const url = `${this.apiBase}/bot${this.token}/sendMessage`;
    const scrub = (value: string) => redactSecrets(value, [this.token, chatId]);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
    } catch (error) {
      /* No status: the request never completed, so the retry policy treats it
         as retryable. The message may or may not have arrived. */
      return { ok: false, error: scrub((error as Error).message || 'network error') };
    }

    let body: { ok?: boolean; description?: string; parameters?: { retry_after?: number } } = {};
    try {
      body = (await response.json()) as typeof body;
    } catch {
      /* A non-JSON body from a 200 is not success. Leave `body` empty. */
    }

    if (response.ok && body.ok === true) {
      return { ok: true, status: response.status };
    }

    const retryAfter = body.parameters?.retry_after;
    return {
      ok: false,
      status: response.status,
      ...(typeof retryAfter === 'number' ? { retry_after: retryAfter } : {}),
      error: scrub(body.description ?? `HTTP ${response.status}`),
    };
  }
}

/**
 * Chooses the transport for this process.
 *
 * `configured: false` is returned alongside the fake transport so callers can
 * say "not configured" instead of "working" — the two are different facts and
 * the dashboard renders them differently.
 */
export function resolveTransport(options: {
  token?: string;
  chatId?: string;
  fetchImpl?: typeof fetch;
} = {}): { transport: AlertTransport; configured: boolean } {
  const token = options.token ?? process.env.TELEGRAM_BOT_TOKEN ?? '';
  if (token.trim() === '') {
    return { transport: new FakeTransport(), configured: false };
  }
  return {
    transport: new TelegramTransport({ token, ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}) }),
    configured: true,
  };
}
