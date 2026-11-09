import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { configureApplication } = require('../plugins/withTailnetWebRTC.cjs');
test('VPN collection is enabled before React creates the WebRTC module and applied once', () => {
  const original = 'override fun onCreate() {\n super.onCreate()\n loadReactNative(this)\n}';
  const updated = configureApplication(original);
  assert.ok(updated.indexOf('includeOtherUidNetworks:true') < updated.indexOf('loadReactNative(this)'));
  assert.match(updated, /requestVPN:true/);
  assert.match(updated, /getAllNetworksFromCache:false/);
  assert.match(updated, /WebRTC-NetworkMonitorAutoDetect\//);
  assert.equal(configureApplication(updated), updated);
  assert.throws(() => configureApplication('unsupported template'));
});
