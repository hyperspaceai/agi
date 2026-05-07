#!/usr/bin/env node
/*
 * Reference signer for Research Receipts (RFC-001).
 *
 * Reads an unsigned receipt body, generates an Ed25519 keypair (or uses
 * a provided one), produces the canonical signature, computes the
 * receiptId, and writes the complete signed receipt.
 *
 * Usage:
 *   node scripts/sign-receipt.js <unsigned-body.json> [output.json]
 *
 * The unsigned body must include all fields except `receiptId`,
 * `signature.value`, and (optionally) `signature.publicKey`. If no
 * publicKey is present, a fresh keypair is generated and the private
 * key is printed to stderr.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { canonicalize, base32Encode } = require('./validate-receipt');

function signReceipt(body, privateKey, publicKeyB64) {
  // Build the body to be hashed/signed: receipt without receiptId or
  // signature.value. The signature publicKey/alg ARE included.
  const bodyForHash = { ...body };
  delete bodyForHash.receiptId;
  bodyForHash.signature = {
    alg: 'ed25519',
    publicKey: publicKeyB64,
  };

  const canonical = canonicalize(bodyForHash);
  const sigBytes = crypto.sign(null, Buffer.from(canonical), privateKey);
  const digest = crypto.createHash('sha256').update(canonical).digest();
  const receiptId = 'rcpt_' + base32Encode(digest).slice(0, 52);

  return {
    ...body,
    receiptId,
    signature: {
      alg: 'ed25519',
      publicKey: publicKeyB64,
      value: sigBytes.toString('base64'),
    },
  };
}

function exportEd25519PublicKeyRaw(publicKey) {
  // Strip the SPKI DER prefix (12 bytes) to get the raw 32-byte public key.
  const der = publicKey.export({ format: 'der', type: 'spki' });
  return der.subarray(der.length - 32).toString('base64');
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: sign-receipt.js <unsigned-body.json> [output.json]');
    process.exit(2);
  }
  const inputPath = args[0];
  const outputPath = args[1] || inputPath.replace(/\.json$/, '.signed.json');

  const body = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  let privateKey, publicKeyB64;
  if (body.signature?.publicKey && process.env.HYPERSPACE_PRIVATE_KEY) {
    publicKeyB64 = body.signature.publicKey;
    privateKey = crypto.createPrivateKey({
      key: Buffer.from(process.env.HYPERSPACE_PRIVATE_KEY, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });
  } else {
    const kp = crypto.generateKeyPairSync('ed25519');
    privateKey = kp.privateKey;
    publicKeyB64 = exportEd25519PublicKeyRaw(kp.publicKey);
    const privDer = privateKey.export({ format: 'der', type: 'pkcs8' });
    console.error('# Generated fresh Ed25519 keypair');
    console.error('# HYPERSPACE_PRIVATE_KEY (base64, save securely):');
    console.error(privDer.toString('base64'));
    console.error('# Public key (base64):');
    console.error(publicKeyB64);
  }

  const signed = signReceipt(body, privateKey, publicKeyB64);
  fs.writeFileSync(outputPath, JSON.stringify(signed, null, 2) + '\n');
  console.error(`# Wrote signed receipt to ${outputPath}`);
  console.error(`# receiptId: ${signed.receiptId}`);
}

if (require.main === module) {
  main(process.argv);
}

module.exports = { signReceipt };
