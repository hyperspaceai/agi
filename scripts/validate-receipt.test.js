'use strict';

/*
 * Unit tests for scripts/validate-receipt.js using Node.js native test runner.
 * Run with: node --test scripts/validate-receipt.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { validateReceipt, canonicalize, base32Encode } = require('./validate-receipt');
const { signReceipt } = require('./sign-receipt');

// ---------------------------------------------------------------- //
// Helpers
// ---------------------------------------------------------------- //
function makeUnsignedBody(overrides = {}) {
  return {
    $schema: 'https://hyper.space/schemas/research-receipt-v1.json',
    version: 1,
    project: 'gpt2-tinystories',
    runNumber: 1,
    peerId: '12D3KooWTestTestTestTestTestTestTestTestTestTestTest',
    inputs: {
      configHash: 'sha256:' + 'a'.repeat(64),
      configRef: 'projects/gpt2-tinystories/baseline/config.yaml',
      datasetHash: 'sha256:' + 'b'.repeat(64),
      parentReceipts: [],
      seed: 42,
    },
    environment: {
      cliVersion: 'v6.0.0',
      modelArchHash: 'sha256:' + 'c'.repeat(64),
      deterministic: true,
      gpu: 'H100',
      platform: 'linux-x86_64',
      nodeVersion: 'v22.22.1',
    },
    result: {
      metric: 'val_loss',
      value: 1.23,
      unit: 'nats',
      delta: -0.05,
      isNewBest: true,
      additional: { trainLoss: 1.10, durationSec: 287, lossCurve: [1.5, 1.4, 1.23] },
    },
    proof: { level: 'signed' },
    timestamp: '2026-05-07T12:34:56.789Z',
    ...overrides,
  };
}

function signWithFreshKey(body) {
  const kp = crypto.generateKeyPairSync('ed25519');
  const der = kp.publicKey.export({ format: 'der', type: 'spki' });
  const pubB64 = der.subarray(der.length - 32).toString('base64');
  return signReceipt(body, kp.privateKey, pubB64);
}

// ---------------------------------------------------------------- //
// canonicalize
// ---------------------------------------------------------------- //
test('canonicalize sorts object keys alphabetically', () => {
  const a = canonicalize({ b: 1, a: 2, c: 3 });
  const b = canonicalize({ a: 2, b: 1, c: 3 });
  assert.equal(a, b);
  assert.equal(a, '{"a":2,"b":1,"c":3}');
});

test('canonicalize handles nested objects and arrays', () => {
  const c = canonicalize({ z: [1, { y: 2, x: 3 }], a: null });
  assert.equal(c, '{"a":null,"z":[1,{"x":3,"y":2}]}');
});

test('canonicalize is deterministic across equivalent inputs', () => {
  const obj1 = { foo: 'bar', nested: { x: 1, y: 2 } };
  const obj2 = { nested: { y: 2, x: 1 }, foo: 'bar' };
  assert.equal(canonicalize(obj1), canonicalize(obj2));
});

// ---------------------------------------------------------------- //
// base32Encode
// ---------------------------------------------------------------- //
test('base32Encode produces RFC4648 alphabet output', () => {
  const out = base32Encode(Buffer.from([0xff, 0xff, 0xff, 0xff, 0xff]));
  assert.match(out, /^[A-Z2-7]+$/);
  assert.equal(out, '77777777');
});

test('base32Encode of zero buffer is all A', () => {
  const out = base32Encode(Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00]));
  assert.equal(out, 'AAAAAAAA');
});

// ---------------------------------------------------------------- //
// validateReceipt — happy path
// ---------------------------------------------------------------- //
test('validateReceipt accepts a properly signed receipt', () => {
  const signed = signWithFreshKey(makeUnsignedBody());
  const result = validateReceipt(signed);
  assert.equal(result.valid, true, JSON.stringify(result, null, 2));
  assert.equal(result.checks.schema, true);
  assert.equal(result.checks.receiptId, true);
  assert.equal(result.checks.signature, true);
});

test('validateReceipt rejects a tampered result.value', () => {
  const signed = signWithFreshKey(makeUnsignedBody());
  signed.result.value = 999.99;
  const result = validateReceipt(signed);
  assert.equal(result.valid, false);
  assert.ok(!result.checks.receiptId || !result.checks.signature);
});

test('validateReceipt rejects an invalid signature', () => {
  const signed = signWithFreshKey(makeUnsignedBody());
  signed.signature.value = Buffer.alloc(64, 0).toString('base64');
  const result = validateReceipt(signed);
  assert.equal(result.valid, false);
  assert.equal(result.checks.signature, false);
});

test('validateReceipt rejects a mismatched receiptId', () => {
  const signed = signWithFreshKey(makeUnsignedBody());
  const last3 = signed.receiptId.slice(-3);
  const replacement = last3 === 'AAA' ? 'BBB' : 'AAA';
  signed.receiptId = signed.receiptId.slice(0, -3) + replacement;
  const result = validateReceipt(signed);
  assert.equal(result.valid, false);
});

// ---------------------------------------------------------------- //
// validateReceipt — schema errors
// ---------------------------------------------------------------- //
test('validateReceipt rejects missing required fields', () => {
  const signed = signWithFreshKey(makeUnsignedBody());
  delete signed.peerId;
  const result = validateReceipt(signed);
  assert.equal(result.valid, false);
  assert.equal(result.checks.schema, false);
  assert.ok(result.errors.some(e => e.includes('peerId')));
});

test('validateReceipt rejects unsupported version', () => {
  const signed = signWithFreshKey(makeUnsignedBody({ version: 2 }));
  const result = validateReceipt(signed);
  assert.equal(result.valid, false);
  assert.equal(result.checks.schema, false);
});

test('validateReceipt rejects malformed configHash', () => {
  const body = makeUnsignedBody();
  body.inputs.configHash = 'md5:notarealhash';
  const signed = signWithFreshKey(body);
  const result = validateReceipt(signed);
  assert.equal(result.valid, false);
  assert.equal(result.checks.schema, false);
});

test('validateReceipt rejects unknown proof level', () => {
  const body = makeUnsignedBody();
  body.proof = { level: 'magical-trust-me-bro' };
  const signed = signWithFreshKey(body);
  const result = validateReceipt(signed);
  assert.equal(result.valid, false);
  assert.equal(result.checks.schema, false);
});

test('validateReceipt rejects unsupported signature algorithm', () => {
  const body = makeUnsignedBody();
  const signed = signWithFreshKey(body);
  signed.signature.alg = 'rsa-pss';
  const result = validateReceipt(signed);
  assert.equal(result.valid, false);
});

// ---------------------------------------------------------------- //
// signReceipt round-trip
// ---------------------------------------------------------------- //
test('signReceipt + validateReceipt round-trip preserves all fields', () => {
  const body = makeUnsignedBody();
  const signed = signWithFreshKey(body);
  for (const k of Object.keys(body)) {
    assert.deepEqual(signed[k], body[k], `field ${k} mutated`);
  }
  assert.match(signed.receiptId, /^rcpt_[A-Z2-7]{52}$/);
  assert.ok(signed.signature.value);
});

test('signReceipt produces deterministic receiptId for same body + same key (Ed25519 RFC 8032)', () => {
  const body = makeUnsignedBody();
  const kp = crypto.generateKeyPairSync('ed25519');
  const der = kp.publicKey.export({ format: 'der', type: 'spki' });
  const pubB64 = der.subarray(der.length - 32).toString('base64');

  const a = signReceipt(JSON.parse(JSON.stringify(body)), kp.privateKey, pubB64);
  const b = signReceipt(JSON.parse(JSON.stringify(body)), kp.privateKey, pubB64);
  assert.equal(a.receiptId, b.receiptId);
  assert.equal(a.signature.value, b.signature.value);
});

test('signReceipt produces different receiptId for different keys', () => {
  const body = makeUnsignedBody();
  const a = signWithFreshKey(JSON.parse(JSON.stringify(body)));
  const b = signWithFreshKey(JSON.parse(JSON.stringify(body)));
  assert.notEqual(a.receiptId, b.receiptId);
});
