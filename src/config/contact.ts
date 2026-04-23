// Public config for the contact form.
// These values are meant to be inlined into the built HTML — the Turnstile
// site key is a public identifier (not a secret) and the Worker URL is the
// endpoint the site POSTs submissions to.
//
// After deploying the Worker, paste the deployed URL here.
// After registering the site with Cloudflare Turnstile, paste the site key.

export const CONTACT_WORKER_URL = 'https://zvb-contact.hamiddarabi.workers.dev/';

export const TURNSTILE_SITE_KEY = 'REPLACE_WITH_TURNSTILE_SITE_KEY';
