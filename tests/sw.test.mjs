// Exercises sw.js against a minimal mock of the service worker environment.
// Run: node tests/sw.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const swSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'sw.js'), 'utf8');

class MockRequest {
  constructor(url, init = {}) {
    this.url = new URL(url, 'https://example.test/').href;
    this.method = init.method || 'GET';
    this.mode = init.mode || 'cors';
    this.cache = init.cache;
  }
}

function makeEnv({ network = true, existingCaches = {} } = {}) {
  const stores = new Map(Object.entries(existingCaches).map(([k, v]) => [k, new Map(Object.entries(v))]));
  const fetched = [];
  const installRequests = [];
  const listeners = {};
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const s = stores.get(name);
      return {
        async addAll(reqs) { for (const r of reqs) installRequests.push(r); for (const r of reqs) s.set(new URL(r.url).pathname, `body:${new URL(r.url).pathname}`); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(k) { return stores.delete(k); },
    async match(req) {
      const url = new URL(typeof req === 'string' ? req : req.url, 'https://example.test/');
      for (const s of stores.values()) {
        const hit = s.get(url.pathname);
        if (hit !== undefined) return hit;
      }
      return undefined;
    },
  };
  const self = {
    location: { origin: 'https://example.test' },
    clients: { claim: async () => {} },
    addEventListener: (type, fn) => { listeners[type] = fn; },
  };
  const ctx = {
    self, caches, URL, Request: MockRequest,
    Response: { error: () => 'NETWORK_ERROR' },
    fetch: async (req) => { fetched.push(req.url); if (!network) throw new Error('offline'); return `network:${new URL(req.url).pathname}`; },
  };
  vm.runInNewContext(swSource, ctx);
  const run = async (type, extra = {}) => {
    let p;
    await listeners[type]({ waitUntil: (x) => { p = x; }, respondWith: (x) => { p = x; }, ...extra });
    return p;
  };
  return { stores, fetched, installRequests, run, listeners };
}

let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message}`); }
}

await test('install precaches the shell into a versioned cache, bypassing the HTTP cache', async () => {
  const env = makeEnv();
  await env.run('install');
  const names = [...env.stores.keys()];
  assert.equal(names.length, 1);
  assert.match(names[0], /^runner-v\d+$/);
  const cached = [...env.stores.get(names[0]).keys()];
  assert.ok(cached.includes('/index.html') && cached.includes('/scripts/game.js') && cached.includes('/styles/main.css'));
  assert.ok(env.installRequests.length > 10 && env.installRequests.every((r) => r.cache === 'reload'));
});

await test('activate deletes old runner caches but keeps the current one and unrelated ones', async () => {
  const env = makeEnv({ existingCaches: { 'runner-old': {}, 'other-app': {} } });
  await env.run('install');
  await env.run('activate');
  const names = [...env.stores.keys()];
  assert.ok(!names.includes('runner-old'));
  assert.ok(names.includes('other-app'));
  assert.ok(names.some((n) => n.startsWith('runner-v')));
});

await test('fetch serves cached files without touching the network (offline works)', async () => {
  const env = makeEnv({ network: false });
  await env.run('install');
  const res = await env.run('fetch', { request: new MockRequest('/scripts/game.js') });
  assert.equal(res, 'body:/scripts/game.js');
  assert.equal(env.fetched.length, 0);
});

await test('offline navigation to an uncached page falls back to the game', async () => {
  const env = makeEnv({ network: false });
  await env.run('install');
  const res = await env.run('fetch', { request: new MockRequest('/some/missing', { mode: 'navigate' }) });
  assert.equal(res, 'body:/index.html');
});

await test('non-GET and cross-origin requests are left alone', async () => {
  const env = makeEnv();
  await env.run('install');
  const calls = [];
  await env.listeners.fetch({ request: new MockRequest('/x', { method: 'POST' }), respondWith: () => calls.push('post') });
  await env.listeners.fetch({ request: new MockRequest('https://other.test/x'), respondWith: () => calls.push('xorigin') });
  assert.deepEqual(calls, []);
});

console.log(failed ? `\n${failed} test(s) failed` : '\nall service worker tests passed');
process.exit(failed ? 1 : 0);
