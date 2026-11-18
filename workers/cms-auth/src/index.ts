/**
 * What the CMS's "Sign in with GitHub" button talks to on zvb.bg.
 *
 * The editor has no GitHub account, so there is nothing to send them to GitHub for. Access
 * has already established who the visitor is by the time /admin will load at all, and the
 * only thing still missing is permission to write to the repository. So this endpoint skips
 * the OAuth round trip entirely and completes the CMS's handshake with a repository token
 * held as a Worker secret.
 *
 * It is a Worker route on the site's own host because the site itself is static files on
 * GitHub Pages and cannot answer a URL. Sitting under /admin means it inherits the Access
 * policy instead of needing a second application, and it keeps the popup on the CMS's own
 * origin, which is the origin Sveltia accepts the reply from.
 *
 * The token does reach the browser, because the CMS calls api.github.com directly from the
 * page. Anyone who can pass Access can therefore read it, which is why it should be a
 * fine-grained token limited to this one repository, with an expiry. That is the same
 * authority an editor already has through the CMS; the point is that it is no more.
 */

interface Env {
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  CMS_GITHUB_TOKEN?: string;
}

const PROVIDER = 'github';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET' } });
    }

    const provider = new URL(request.url).searchParams.get('provider') ?? PROVIDER;

    // Interpolated into the page below, so it is matched against a fixed value rather than
    // echoed.
    if (provider !== PROVIDER) {
      return handshake(request, {
        provider: PROVIDER,
        error: 'Only the GitHub backend is configured.',
      });
    }

    const identity = await verifyAccessJwt(request, {
      teamDomain: env.ACCESS_TEAM_DOMAIN,
      aud: env.ACCESS_AUD,
    });

    if (!identity) {
      return handshake(request, {
        provider,
        error: 'This page has to be opened through Cloudflare Access. Try signing in again.',
      });
    }

    if (!env.CMS_GITHUB_TOKEN) {
      return handshake(request, {
        provider,
        error: 'The site is missing its CMS_GITHUB_TOKEN secret, so the editor cannot reach GitHub.',
      });
    }

    return handshake(request, { provider, token: env.CMS_GITHUB_TOKEN });
  },
} satisfies ExportedHandler<Env>;

/**
 * The popup protocol the CMS expects: announce ourselves to the opener, wait for it to answer,
 * then reply with the credential. The origin of a message event is set by the browser and
 * cannot be forged by the sender, so it is what decides whether the token is handed over.
 */
function handshake(
  request: Request,
  { provider, token, error }: { provider: string; token?: string; error?: string },
): Response {
  const state = error ? 'error' : 'success';
  const payload = error ? { provider, error } : { provider, token };
  const origin = new URL(request.url).origin;

  const html = `<!doctype html><html lang="en"><body><script>
(() => {
  const message = 'authorization:${provider}:${state}:' + ${JSON.stringify(JSON.stringify(payload))};
  const hasToken = ${JSON.stringify(!error)};
  window.addEventListener('message', (event) => {
    if (event.data !== 'authorizing:${provider}') return;
    if (hasToken && event.origin !== ${JSON.stringify(origin)}) return;
    window.opener?.postMessage(message, event.origin);
  });
  window.opener?.postMessage('authorizing:${provider}', '*');
})();
</script></body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      // The page exists only to talk to its opener, so nothing else may frame or index it.
      'x-robots-tag': 'noindex, nofollow',
      'referrer-policy': 'no-referrer',
      'content-security-policy':
        "default-src 'none'; script-src 'unsafe-inline'; frame-ancestors 'none'",
    },
  });
}

// Verifies the JWT Cloudflare Access puts on every request it lets through.
//
// Access already gates /admin at the edge, so this is the second lock rather than the first.
// It matters because this route hands out a GitHub token: if the Access application were ever
// renamed, moved, or deleted, the edge gate would quietly stop applying and the route would
// still be there. Checking the assertion here means losing the policy costs an error rather
// than the token.
const JWKS_TTL_MS = 60 * 60 * 1000;

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
}

let cache: { url: string | null; keys: Jwk[] | null; fetchedAt: number } = {
  url: null,
  keys: null,
  fetchedAt: 0,
};

const decodeBase64Url = (value: string): Uint8Array =>
  Uint8Array.from(
    atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')),
    (c) => c.charCodeAt(0),
  );

const decodeJson = (value: string): unknown => JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));

async function getKeys(teamDomain: string): Promise<Jwk[]> {
  const url = `https://${teamDomain}/cdn-cgi/access/certs`;
  if (cache.url === url && cache.keys && Date.now() - cache.fetchedAt < JWKS_TTL_MS) {
    return cache.keys;
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Access certs returned ${response.status}`);

  const { keys } = (await response.json()) as { keys: Jwk[] };
  cache = { url, keys, fetchedAt: Date.now() };
  return keys;
}

/**
 * Resolves to the identity Access vouched for, or null if the request did not come through it.
 * Never throws for an untrusted request: the caller only needs to know yes or no.
 */
async function verifyAccessJwt(
  request: Request,
  { teamDomain, aud }: { teamDomain?: string; aud?: string },
): Promise<{ email: string | null; sub: string | null } | null> {
  if (!teamDomain || !aud) return null;

  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const [rawHeader, rawPayload, rawSignature] = parts;
    if (!rawHeader || !rawPayload || !rawSignature) return null;

    const header = decodeJson(rawHeader) as { alg?: string; kid?: string };
    const payload = decodeJson(rawPayload) as {
      iss?: string;
      aud?: string | string[];
      exp?: number;
      nbf?: number;
      email?: string;
      sub?: string;
    };

    if (header.alg !== 'RS256' || !header.kid) return null;
    if (payload.iss !== `https://${teamDomain}`) return null;
    // `aud` identifies the Access application, so a token minted for a different app on the
    // same team is not accepted here. Normalised to an array first: Cloudflare sends one, but
    // comparing against a bare string would match on substring rather than equality.
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(aud)) return null;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp <= now) return null;
    if (typeof payload.nbf === 'number' && payload.nbf > now + 60) return null;

    const jwk = (await getKeys(teamDomain)).find((k) => k.kid === header.kid);
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const signed = new TextEncoder().encode(`${rawHeader}.${rawPayload}`);
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      decodeBase64Url(rawSignature),
      signed,
    );

    return valid ? { email: payload.email ?? null, sub: payload.sub ?? null } : null;
  } catch {
    return null;
  }
}
