#!/usr/bin/env node
/*
 * Reference validator for Research Receipts (RFC-001).
 *
 * Performs the validation algorithm steps that don't require external
 * dependencies (proof systems, network lookups):
 *   1. Parse receipt JSON; reject if not schema-conformant.
 *   2. Canonicalize body (excluding signature) via JCS (RFC 8785).
 *   3. Verify Ed25519 signature against signature.publicKey.
 *   4. Recompute receiptId; reject if mismatched.
 *   7. Run proof verification for declared level (signed: nothing further).
 *
 * Steps 5, 6, 8, 9 (config/dataset hash resolution, project policy lookup,
 * proof-level enforcement, transitive parent verification) are out of
 * scope for this reference impl and tracked as follow-up work.
 *
 * Usage:
 *   node scripts/validate-receipt.js <path-to-receipt.json>
 *   node scripts/validate-receipt.js --all                    # validate all receipts in projects/
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// ---------------------------------------------------------------- //
// JCS canonicalization (RFC 8785) — minimal implementation.
// For a production system, use the `canonicalize` npm package.
// ---------------------------------------------------------------- //
function canonicalize(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  const keys = Object.keys(value).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
}

// ---------------------------------------------------------------- //
// Schema validation — we hand-roll a small subset to avoid pulling in ajv
// for a reference impl. Real validators should use ajv + the published
// JSON Schema in schemas/research-receipt-v1.schema.json.
// ---------------------------------------------------------------- //
function validateSchema(r) {
  const errors = [];
  const required = [
    'version', 'receiptId', 'project', 'runNumber', 'peerId',
    'inputs', 'environment', 'result', 'proof', 'signature', 'timestamp'
  ];
  for (const k of required) {
    if (!(k in r)) errors.push(`missing required field: ${k}`);
  }
  if (r.version !== 1) errors.push(`unsupported version: ${r.version}`);
  if (!/^rcpt_[A-Z2-7]{52}$/.test(r.receiptId || '')) {
    errors.push(`invalid receiptId format: ${r.receiptId}`);
  }
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(r.project || '')) {
    errors.push(`invalid project slug: ${r.project}`);
  }
  if (r.inputs) {
    for (const k of ['configHash', 'configRef', 'datasetHash', 'seed']) {
      if (!(k in r.inputs)) errors.push(`missing inputs.${k}`);
    }
    if (r.inputs.configHash && !/^sha256:[a-f0-9]{64}$/.test(r.inputs.configHash)) {
      errors.push(`invalid inputs.configHash format`);
    }
  }
  if (r.proof && !['signed', 'replay', 'zk-jolt', 'zk-groth16', 'zk-sp1', 'tee-attestation'].includes(r.proof.level)) {
    errors.push(`unknown proof level: ${r.proof.level}`);
  }
  if (r.signature && r.signature.alg !== 'ed25519') {
    errors.push(`unsupported signature alg: ${r.signature.alg}`);
  }
  return errors;
}

// ---------------------------------------------------------------- //
// Base32 (RFC 4648, no padding, uppercase A-Z2-7) — used for receiptId.
// ---------------------------------------------------------------- //
function base32Encode(buf) {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return out;
}

// ---------------------------------------------------------------- //
// Receipt validation.
// ---------------------------------------------------------------- //
function validateReceipt(receipt) {
  const result = { valid: false, receiptId: receipt.receiptId, checks: {}, errors: [] };

  // Step 1: schema
  const schemaErrors = validateSchema(receipt);
  result.checks.schema = schemaErrors.length === 0;
  if (!result.checks.schema) {
    result.errors.push(...schemaErrors);
    return result;
  }

  // Step 2 + 4: canonicalize body without the signature.value, recompute receiptId.
  // The receiptId itself is also excluded from the body it commits to (otherwise
  // we'd have a chicken-and-egg problem: id depends on body which contains id).
  const { signature, receiptId, ...body } = receipt;
  // We DO include the publicKey + alg in the body so the signer commits to which
  // key signed. We do NOT include signature.value.
  const bodyForHash = { ...body, signature: { alg: signature.alg, publicKey: signature.publicKey } };
  const canonical = canonicalize(bodyForHash);
  const digest = crypto.createHash('sha256').update(canonical).digest();
  const computedId = 'rcpt_' + base32Encode(digest).slice(0, 52);
  result.checks.receiptId = computedId === receiptId;
  if (!result.checks.receiptId) {
    result.errors.push(`receiptId mismatch: declared=${receiptId} computed=${computedId}`);
  }

  // Step 3: signature verification.
  try {
    const pubKey = crypto.createPublicKey({
      key: Buffer.concat([
        // Ed25519 SPKI prefix (DER): 12 bytes for OID + algorithm identifier.
        Buffer.from('302a300506032b6570032100', 'hex'),
        Buffer.from(signature.publicKey, 'base64'),
      ]),
      format: 'der',
      type: 'spki',
    });
    const sigBytes = Buffer.from(signature.value, 'base64');
    result.checks.signature = crypto.verify(null, Buffer.from(canonical), pubKey, sigBytes);
    if (!result.checks.signature) {
      result.errors.push('Ed25519 signature does not verify against the canonical body');
    }
  } catch (err) {
    result.checks.signature = false;
    result.errors.push(`signature verification error: ${err.message}`);
  }

  // Step 7: proof-level-specific verification.
  switch (receipt.proof.level) {
    case 'signed':
      // Already covered by step 3.
      result.checks.proof = result.checks.signature;
      break;
    case 'replay':
      // Reference impl does not run replays — would require sandboxed exec.
      result.checks.proof = 'skipped (replay verification not implemented in reference validator)';
      break;
    case 'zk-jolt':
    case 'zk-groth16':
    case 'zk-sp1':
      // Reference impl does not verify zk proofs — would require linking the
      // appropriate proof-system library. Production validators must wire
      // these in.
      result.checks.proof = 'skipped (zk verification requires external proof-system library)';
      break;
    case 'tee-attestation':
      result.checks.proof = 'skipped (TEE attestation verification not implemented in reference validator)';
      break;
  }

  result.valid = result.checks.schema
              && result.checks.receiptId
              && result.checks.signature;
  return result;
}

// ---------------------------------------------------------------- //
// CLI entrypoint.
// ---------------------------------------------------------------- //
function findAllReceipts(rootDir) {
  const receipts = [];
  const projectsDir = path.join(rootDir, 'projects');
  if (!fs.existsSync(projectsDir)) return receipts;
  for (const project of fs.readdirSync(projectsDir, { withFileTypes: true })) {
    if (!project.isDirectory()) continue;
    const receiptsDir = path.join(projectsDir, project.name, 'receipts');
    if (!fs.existsSync(receiptsDir)) continue;
    for (const file of fs.readdirSync(receiptsDir)) {
      if (file.endsWith('.json')) {
        receipts.push(path.join(receiptsDir, file));
      }
    }
  }
  return receipts;
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    console.error('Usage: validate-receipt.js <path>... | --all');
    process.exit(2);
  }

  let paths;
  if (args[0] === '--all') {
    paths = findAllReceipts(process.cwd());
    if (paths.length === 0) {
      console.log('No receipts found under projects/*/receipts/');
      process.exit(0);
    }
  } else {
    paths = args;
  }

  let allValid = true;
  for (const p of paths) {
    const json = JSON.parse(fs.readFileSync(p, 'utf8'));
    const result = validateReceipt(json);
    const tag = result.valid ? 'VALID  ' : 'INVALID';
    console.log(`[${tag}] ${p}`);
    for (const [k, v] of Object.entries(result.checks)) {
      console.log(`           ${k}: ${v}`);
    }
    for (const err of result.errors) {
      console.log(`           ! ${err}`);
    }
    if (!result.valid) allValid = false;
  }
  process.exit(allValid ? 0 : 1);
}

if (require.main === module) {
  main(process.argv);
}

module.exports = { validateReceipt, canonicalize, base32Encode };
