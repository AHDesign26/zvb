import { CONTACT_WORKER_URL, TURNSTILE_SITE_KEY } from '../config/contact';

interface TurnstileOptions {
  sitekey: string;
  size?: 'normal' | 'compact' | 'flexible' | 'invisible';
  action?: string;
  appearance?: 'always' | 'execute' | 'interaction-only';
}

interface TurnstileApi {
  render: (el: string | HTMLElement, options: TurnstileOptions) => string;
  execute: (widget: string | HTMLElement, options?: { action?: string }) => Promise<string>;
  reset: (widget: string | HTMLElement) => void;
  remove: (widget: string | HTMLElement) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function waitForTurnstile(timeoutMs = 8000): Promise<TurnstileApi> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile);
      return;
    }
    const start = Date.now();
    const interval = window.setInterval(() => {
      if (window.turnstile) {
        window.clearInterval(interval);
        resolve(window.turnstile);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        window.clearInterval(interval);
        reject(new Error('Turnstile failed to load'));
      }
    }, 50);
  });
}

export interface InitOptions {
  formId: string;
  statusId: string;
  turnstileContainerId: string;
  type: 'contact' | 'request';
  messages: {
    success: string;
    error: string;
    captcha: string;
    rateLimited: string;
    validation: string;
  };
}

export async function initContactForm(options: InitOptions): Promise<void> {
  const form = document.getElementById(options.formId);
  const status = document.getElementById(options.statusId);
  const container = document.getElementById(options.turnstileContainerId);
  if (!(form instanceof HTMLFormElement) || !status || !container) return;

  let widgetId: string;
  try {
    const turnstile = await waitForTurnstile();
    widgetId = turnstile.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      size: 'invisible',
      appearance: 'interaction-only',
      action: options.type,
    });
  } catch {
    // Turnstile couldn't load — fall back to letting the user submit without it.
    // The Worker will reject with captcha_failed, which is the safer failure mode.
    return;
  }

  const setStatus = (text: string, kind: 'success' | 'error' | 'none') => {
    status.textContent = text;
    status.dataset.state = kind;
    status.className =
      kind === 'success'
        ? 'mt-6 text-sm font-semibold text-emerald-700 text-center'
        : kind === 'error'
          ? 'mt-6 text-sm font-semibold text-rose-700 text-center'
          : 'mt-6 text-sm text-center';
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('', 'none');

    const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const prevLabel = submitBtn?.innerHTML;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.sending = 'true';
    }

    try {
      const turnstile = window.turnstile;
      if (!turnstile) throw new Error('no_turnstile');
      const token = await turnstile.execute(widgetId, { action: options.type });

      const fd = new FormData(form);
      const body: Record<string, string> = {
        form_type: options.type,
        'cf-turnstile-response': token,
      };
      fd.forEach((value, key) => {
        if (typeof value === 'string') {
          // Field names come from our own form markup, not user input.
          // eslint-disable-next-line security/detect-object-injection
          body[key] = value;
        }
      });

      const res = await fetch(CONTACT_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        form.reset();
        setStatus(options.messages.success, 'success');
      } else {
        let errorCode = 'unknown';
        try {
          const data = (await res.json()) as { error?: string };
          if (typeof data.error === 'string') errorCode = data.error;
        } catch {
          // fall through to generic error
        }
        const map: Record<string, string> = {
          captcha_failed: options.messages.captcha,
          rate_limited: options.messages.rateLimited,
          validation_failed: options.messages.validation,
        };
        // Keys are a fixed allow-list above; fall back to generic error for anything else.
        // eslint-disable-next-line security/detect-object-injection
        setStatus(map[errorCode] ?? options.messages.error, 'error');
      }
    } catch {
      setStatus(options.messages.error, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        delete submitBtn.dataset.sending;
        if (prevLabel !== undefined) submitBtn.innerHTML = prevLabel;
      }
      window.turnstile?.reset(widgetId);
    }
  });
}
