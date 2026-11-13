import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  verifyFirebaseBearerToken,
  encryptSecret,
  decryptSecret,
  validateSafeHttpsEgress,
} from '../server_security.ts';
import {
  sanitizeSpreadsheetCell,
  generateTrueDocxBuffer,
  generateTruePptxBuffer,
  generateTrueXlsxBuffer,
  generateTruePdfBuffer,
} from '../server_exports.ts';
import {
  readTenantCollection,
  mutateTenantCollection,
  saveTenantByokKeys,
  getTenantByokKeys,
  reserveCredits,
  refundCredits,
  getTenantCreditBalance,
  purgeAllTenantData,
} from '../server_tenant_store.ts';
import { extractTextFromUploadedBase64 } from '../server_uploads.ts';

test('verifyFirebaseBearerToken rejects dummy, malformed, and forged JWT tokens', async () => {
  await assert.rejects(() => verifyFirebaseBearerToken(''));
  await assert.rejects(() => verifyFirebaseBearerToken('dummy-token'));

  // Unsigned/forged 3-part JWT targeting project raoneai
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'forged' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      aud: 'raoneai',
      iss: 'https://securetoken.google.com/raoneai',
      sub: 'attacker-uid',
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString('base64url');
  const forgedJwt = `${header}.${payload}.forgedsignature`;

  await assert.rejects(() => verifyFirebaseBearerToken(forgedJwt));
});

test('validateSafeHttpsEgress blocks SSRF targets, HTTP, embedded creds, and unapproved hosts', async () => {
  const blockedUrls = [
    'http://api.cometapi.com/v1',
    'https://127.0.0.1/v1',
    'https://169.254.169.254/latest/meta-data/',
    'https://10.0.0.1/secret',
    'https://localhost:3000/api/health',
    'https://user:pass@api.cometapi.com/v1',
    'https://evil.attacker.example/v1',
    'not-a-valid-url',
  ];

  for (const url of blockedUrls) {
    const res = await validateSafeHttpsEgress(url);
    assert.equal(res.ok, false, `Expected SSRF validation to block ${url}`);
  }
});

test('encryptSecret and decryptSecret round-trip with AES-256-GCM authenticated tag', () => {
  const secret = `sk-test-${crypto.randomUUID()}`;
  const cipher = encryptSecret(secret);
  assert.ok(cipher.startsWith('v1:'), 'Expected v1 AES-GCM prefix');
  assert.equal(cipher.includes(secret), false, 'Ciphertext must not expose plaintext');
  assert.equal(decryptSecret(cipher), secret);
});

test('OOXML and PDF exporters produce valid binary documents and neutralize spreadsheet formulas', async () => {
  assert.equal(sanitizeSpreadsheetCell('=CMD("calc")'), "'=CMD(\"calc\")");
  assert.equal(sanitizeSpreadsheetCell('+1+1'), "'+1+1");
  assert.equal(sanitizeSpreadsheetCell('-2+3'), "'-2+3");
  assert.equal(sanitizeSpreadsheetCell('@SUM(A1:A2)'), "'@SUM(A1:A2)");
  assert.equal(sanitizeSpreadsheetCell('Revenue Q4'), 'Revenue Q4');

  const sample = {
    title: 'Enterprise Audit Report',
    content: '# Executive Summary\n\n| Metric | Value |\n| --- | --- |\n| Margin | =100+20 |\n',
    slides: [
      {
        slideNumber: 1,
        title: 'Overview',
        subtitle: 'Security & Architecture',
        bulletPoints: ['Tenant isolation', 'AES-256-GCM BYOK vault'],
      },
    ],
  };

  const [docxBuf, pptxBuf, xlsxBuf, pdfBuf] = await Promise.all([
    generateTrueDocxBuffer(sample),
    generateTruePptxBuffer(sample),
    generateTrueXlsxBuffer(sample),
    generateTruePdfBuffer(sample),
  ]);

  assert.equal(docxBuf.subarray(0, 2).toString('ascii'), 'PK', 'DOCX must be valid ZIP/OOXML');
  assert.equal(pptxBuf.subarray(0, 2).toString('ascii'), 'PK', 'PPTX must be valid ZIP/OOXML');
  assert.equal(xlsxBuf.subarray(0, 2).toString('ascii'), 'PK', 'XLSX must be valid ZIP/OOXML');
  assert.equal(pdfBuf.subarray(0, 5).toString('ascii'), '%PDF-', 'PDF must have %PDF- header');
  assert.ok(docxBuf.length > 500 && pptxBuf.length > 500 && xlsxBuf.length > 500 && pdfBuf.length > 300);
});

test('tenant store isolates tenants, handles concurrent mutex writes, encrypts BYOK keys, and tracks credits atomically', async () => {
  const tenantA = `test_tenant_a_${crypto.randomUUID().slice(0, 8)}`;
  const tenantB = `test_tenant_b_${crypto.randomUUID().slice(0, 8)}`;

  try {
    // Concurrent writes to same tenant collection must preserve all mutations via mutex queue
    await Promise.all(
      Array.from({ length: 10 }, (_, idx) =>
        mutateTenantCollection<number[]>(tenantA, 'conversations', [], (curr) => [...curr, idx])
      )
    );

    const aItems = await readTenantCollection<number[]>(tenantA, 'conversations', []);
    const bItems = await readTenantCollection<number[]>(tenantB, 'conversations', []);
    assert.equal(aItems.length, 10);
    assert.equal(bItems.length, 0, 'Tenant B must remain isolated from Tenant A writes');

    // BYOK encryption isolation
    await saveTenantByokKeys(tenantA, { geminiApiKey: 'AIzaTestTenantAOnly' });
    const aKeys = await getTenantByokKeys(tenantA);
    const bKeys = await getTenantByokKeys(tenantB);
    assert.equal(aKeys.geminiApiKey, 'AIzaTestTenantAOnly');
    assert.equal(bKeys.geminiApiKey, undefined);

    // Atomic credit reservation and refund
    const initial = await getTenantCreditBalance(tenantA);
    assert.equal(initial.balance, 200);
    const reserved = await reserveCredits(tenantA, 15, 'test_op', 'ref-1');
    assert.equal(reserved.ok, true);
    assert.equal(reserved.balance, 185);
    const refunded = await refundCredits(tenantA, 15, 'test_op', 'ref-1');
    assert.equal(refunded, 200);
  } finally {
    await purgeAllTenantData(tenantA);
    await purgeAllTenantData(tenantB);
  }
});

test('extractTextFromUploadedBase64 validates magic bytes and extracts UTF-8 content', async () => {
  const validTextB64 = Buffer.from('# Quarter 4 Notes\nTotal users: 1400', 'utf-8').toString('base64');
  const textRes = await extractTextFromUploadedBase64({
    filename: 'notes.md',
    mimeType: 'text/markdown',
    base64Data: `data:text/markdown;base64,${validTextB64}`,
  });
  assert.match(textRes.extractedText, /Total users: 1400/);

  const forgedPdfB64 = Buffer.from('NOT_A_REAL_PDF_FILE', 'utf-8').toString('base64');
  await assert.rejects(
    () =>
      extractTextFromUploadedBase64({
        filename: 'fake.pdf',
        mimeType: 'application/pdf',
        base64Data: forgedPdfB64,
      }),
    /Invalid or corrupted PDF header signature/
  );

  const forgedDocxB64 = Buffer.from('NOT_A_ZIP_CONTAINER', 'utf-8').toString('base64');
  await assert.rejects(
    () =>
      extractTextFromUploadedBase64({
        filename: 'fake.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        base64Data: forgedDocxB64,
      }),
    /Invalid DOCX container/
  );

  await assert.rejects(
    () =>
      extractTextFromUploadedBase64({
        filename: 'empty.txt',
        mimeType: 'text/plain',
        base64Data: '',
      }),
    /empty/i
  );
});
