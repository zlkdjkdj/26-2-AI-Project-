import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directOrigin, directRequest, parseDirectQr, savedCamera, tailnetSdp } from '../src/directProtocol.js';
const id = 'a'.repeat(64), pair = 'b'.repeat(64), token = 'c'.repeat(64);
const origin = 'http://100.112.207.92:8787';
test('direct registration only accepts bounded, versioned Tailnet QR and strong credentials', () => {
  const qr = { app: 'atchacha-direct', version: 1, origin, id, pair };
  assert.deepEqual(parseDirectQr(JSON.stringify(qr)), { origin, id, pair });
  for (const bad of ['http://192.168.0.1:8787', 'https://example.com:8787', `${origin}/path`, 'http://100.128.0.1:8787', 'http://user@100.112.207.92:8787', `${origin}?secret=x`, 'http://100.112.207.92:8000']) {
    assert.throws(() => directOrigin(bad));
  }
  assert.throws(() => parseDirectQr(JSON.stringify({ ...qr, pair: '123456' })));
  assert.throws(() => parseDirectQr(JSON.stringify({ ...qr, app: 'atchacha-homecam' })));
  assert.throws(() => parseDirectQr('x'.repeat(1025)));
  assert.deepEqual(savedCamera({ origin, id, token }), { origin, id, token });
});
test('media candidates stay inside Tailnet and fail clearly when the VPN route is missing', () => {
  const sdp = 'v=0\r\na=fingerprint:sha-256 AA\r\na=candidate:1 1 udp 123 192.168.0.10 5000 typ host\r\na=candidate:2 1 udp 124 100.112.207.92 5001 typ host\r\na=candidate:3 1 udp 125 8.8.8.8 5002 typ srflx\r\n';
  const result = tailnetSdp(sdp);
  assert.match(result, /100\.112\.207\.92/);
  assert.doesNotMatch(result, /192\.168|8\.8\.8\.8/);
  assert.match(result, /fingerprint/);
  assert.throws(() => tailnetSdp('v=0\r\na=candidate:1 1 udp 123 192.168.0.1 5555 typ host\r\n'), /Tailscale/);
  assert.throws(() => tailnetSdp('v=0\r\n', { tailnetInterface: false, vpnNetwork: false }), /연결이 꺼져/);
  assert.throws(() => tailnetSdp('v=0\r\na=candidate:1 1 udp 123 192.168.0.1 5555 typ host\r\n', { tailnetInterface: true, vpnNetwork: true }), /T1\/V1\/C1/);
});
test('viewer credentials remain out of URLs; requests carry no browser cookies', async () => {
  await directRequest(origin, '/v1/status', { token }, async (url, init) => {
    assert.equal(url, `${origin}/v1/status`);
    assert.equal(init.headers.Authorization, `Bearer ${token}`);
    assert.equal(init.credentials, 'omit');
    assert.equal(init.redirect, 'error');
    return { ok: true, json: async () => ({ ready: true }) };
  });
  await assert.rejects(() => directRequest(origin, '/v1/status', { token }, async () => ({ ok: false, status: 401, json: async () => ({ error: '등록 해제' }) })), (error) => error.status === 401);
});
