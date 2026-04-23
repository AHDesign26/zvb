import { z } from 'zod';

interface Env {
  TURNSTILE_SECRET: string;
  RESEND_API_KEY: string;
  OWNER_EMAIL: string;
  FROM_EMAIL: string;
  ALLOWED_ORIGINS: string;
  CONTACT_RL: KVNamespace;
}

const MAX_BODY_BYTES = 16 * 1024;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_S = 600;

const ContactSchema = z
  .object({
    form_type: z.enum(['contact', 'request']),
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(200),
    phone: z.string().trim().max(40).optional().or(z.literal('')),
    company: z.string().trim().max(200).optional().or(z.literal('')),
    interest: z.string().trim().max(200).optional().or(z.literal('')),
    projectType: z.string().trim().max(200).optional().or(z.literal('')),
    message: z.string().trim().max(5000).optional().or(z.literal('')),
    details: z.string().trim().max(5000).optional().or(z.literal('')),
    // Honeypot: must be empty or absent. Bots fill this.
    website: z.string().max(0).optional(),
    'cf-turnstile-response': z.string().min(1).max(4096),
  })
  .refine((d) => (d.message ?? '').length > 0 || (d.details ?? '').length > 0, {
    message: 'Either message or details is required',
    path: ['message'],
  });

type ContactInput = z.infer<typeof ContactSchema>;

function corsHeaders(origin: string, allowed: string[]): Record<string, string> {
  const match = allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': match ? origin : allowed[0] ?? '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...cors,
    },
  });
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function verifyTurnstile(
  token: string,
  secret: string,
  remoteIp: string | null,
): Promise<boolean> {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.append('remoteip', remoteIp);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  });
  if (!res.ok) return false;
  const json = (await res.json()) as { success: boolean };
  return json.success === true;
}

async function sendViaResend(
  apiKey: string,
  payload: { from: string; to: string; subject: string; reply_to?: string; html: string },
): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend ${res.status}: ${text}`);
  }
}

function ownerEmailHtml(data: ContactInput): string {
  const rows: Array<[string, string | undefined]> = [
    ['Тип форма', data.form_type === 'request' ? 'Заявка за проект' : 'Контакт (начална страница)'],
    ['Име', data.name],
    ['Имейл', data.email],
    ['Телефон', data.phone || undefined],
    ['Фирма', data.company || undefined],
    ['Интерес / Услуга', data.interest || data.projectType || undefined],
  ];
  const tableRows = rows
    .filter(([, v]) => v && v.length > 0)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-weight:600;color:#1a237e;">${escapeHtml(k)}</td><td style="padding:8px 16px;border-bottom:1px solid #e2e8f0;">${escapeHtml(v ?? '')}</td></tr>`,
    )
    .join('');

  const body = (data.details || data.message || '').trim();
  const bodyBlock = body
    ? `<h3 style="margin:24px 0 8px;color:#1a237e;font-family:sans-serif;">Съобщение</h3><div style="white-space:pre-wrap;padding:16px;background:#f8fafc;border-left:4px solid #ffc107;border-radius:4px;font-family:sans-serif;">${escapeHtml(body)}</div>`
    : '';

  return `
<!doctype html>
<html><body style="font-family:Inter,Arial,sans-serif;background:#f9f9f9;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
    <div style="background:#1a237e;color:#ffc107;padding:20px 24px;font-weight:700;font-size:14px;letter-spacing:0.1em;text-transform:uppercase;">Ново запитване — zvb.bg</div>
    <div style="padding:24px;">
      <table style="width:100%;border-collapse:collapse;font-family:sans-serif;font-size:14px;">${tableRows}</table>
      ${bodyBlock}
    </div>
  </div>
</body></html>`;
}

function senderEmailHtml(data: ContactInput): string {
  return `
<!doctype html>
<html><body style="font-family:Inter,Arial,sans-serif;background:#f9f9f9;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
    <div style="background:#1a237e;color:#ffc107;padding:20px 24px;font-weight:700;font-size:14px;letter-spacing:0.1em;text-transform:uppercase;">ZVB</div>
    <div style="padding:24px;color:#1a1c1c;font-family:sans-serif;">
      <h2 style="color:#1a237e;margin:0 0 16px;">Здравейте, ${escapeHtml(data.name)}!</h2>
      <p>Благодарим, че се свързахте с нас. Получихме вашето запитване и ще се свържем с вас в рамките на <strong>24 часа</strong> в работни дни.</p>
      <p style="margin-top:24px;">Ако искате да добавите нещо към заявката, отговорете директно на този имейл.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
      <p style="font-size:13px;color:#455a64;">ZVB — Електрически и умни системи<br>
        Телефон: +359 87 7944353<br>
        <a href="https://zvb.bg" style="color:#1a237e;">zvb.bg</a>
      </p>
    </div>
  </div>
</body></html>`;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('Origin') ?? '';
    const allowed = env.ALLOWED_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const cors = corsHeaders(origin, allowed);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'method_not_allowed' }, 405, cors);
    }

    if (!allowed.includes(origin)) {
      return jsonResponse({ error: 'origin_not_allowed' }, 403, cors);
    }

    const ct = request.headers.get('Content-Type') ?? '';
    if (!ct.toLowerCase().includes('application/json')) {
      return jsonResponse({ error: 'unsupported_content_type' }, 415, cors);
    }

    const contentLength = Number(request.headers.get('Content-Length') ?? '0');
    if (contentLength > MAX_BODY_BYTES) {
      return jsonResponse({ error: 'payload_too_large' }, 413, cors);
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const rlKey = `rl:${ip}`;
    const current = await env.CONTACT_RL.get(rlKey);
    const count = current ? parseInt(current, 10) : 0;
    if (Number.isFinite(count) && count >= RATE_LIMIT_MAX) {
      return jsonResponse({ error: 'rate_limited' }, 429, cors);
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return jsonResponse({ error: 'invalid_json' }, 400, cors);
    }

    const parsed = ContactSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonResponse({ error: 'validation_failed' }, 400, cors);
    }
    const data = parsed.data;

    if (data.website && data.website.length > 0) {
      // Honeypot tripped — pretend success, don't email, don't increment rate.
      return jsonResponse({ ok: true }, 200, cors);
    }

    const captchaOk = await verifyTurnstile(
      data['cf-turnstile-response'],
      env.TURNSTILE_SECRET,
      ip === 'unknown' ? null : ip,
    );
    if (!captchaOk) {
      return jsonResponse({ error: 'captcha_failed' }, 400, cors);
    }

    await env.CONTACT_RL.put(rlKey, String(count + 1), {
      expirationTtl: RATE_LIMIT_WINDOW_S,
    });

    const subject =
      data.form_type === 'request'
        ? `Заявка за проект от ${data.name}`
        : `Ново запитване от ${data.name}`;

    try {
      await sendViaResend(env.RESEND_API_KEY, {
        from: env.FROM_EMAIL,
        to: env.OWNER_EMAIL,
        reply_to: data.email,
        subject,
        html: ownerEmailHtml(data),
      });
      await sendViaResend(env.RESEND_API_KEY, {
        from: env.FROM_EMAIL,
        to: data.email,
        subject: 'Благодарим за вашето запитване — ZVB',
        html: senderEmailHtml(data),
      });
    } catch {
      return jsonResponse({ error: 'email_send_failed' }, 502, cors);
    }

    return jsonResponse({ ok: true }, 200, cors);
  },
};
