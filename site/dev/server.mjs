// Local preview: serves web/ and runs the real application routes against the
// in-memory fixture. The fixture origin adapter exists only because the app's
// trusted-origin check requires HTTPS; deployed traffic uses the real origin.
import { createApplication } from '../functions/router.mjs';
import { createFakeDb } from './fake-db.mjs';

const port = Number(Deno.args[0] || 8091);
const webRoot = new URL('../web/', import.meta.url);
const LOCAL_ORIGIN = 'https://finstats.local';
const handle = createApplication({ db: createFakeDb(), origin: LOCAL_ORIGIN });

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

Deno.serve({ port, hostname: '127.0.0.1' }, async (request) => {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/functions/v1/app')) {
    const headers = new Headers(request.headers);
    headers.set('origin', LOCAL_ORIGIN);
    return handle({ request: new Request(request, { headers }) });
  }
  let path;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    return new Response('Not found', { status: 404 });
  }
  if (path === '/') path = '/index.html';
  if (path.includes('..') || path.includes('\\')) return new Response('Not found', { status: 404 });
  try {
    const body = await Deno.readFile(new URL('.' + path, webRoot));
    const ext = path.slice(path.lastIndexOf('.'));
    return new Response(body, {
      headers: { 'content-type': CONTENT_TYPES[ext] || 'application/octet-stream', 'cache-control': 'no-store' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
});

console.log(`FinStats local preview (in-memory fixture data): http://127.0.0.1:${port}/`);