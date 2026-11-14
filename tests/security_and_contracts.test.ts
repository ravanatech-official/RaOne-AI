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
import { validateLocalLlmEndpoint, startManagedLlamaServer } from '../server_local_llm.ts';
import { parseSseBuffer, flushSseBuffer, extractSseTextDelta } from '../src/utils/sseParser.ts';

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

test('validateLocalLlmEndpoint blocks private LAN/metadata SSRF while honoring Cloud Run vs local loopback policy', async () => {
  const prevLoopback = process.env.ALLOW_LOCAL_LLM_LOOPBACK;
  const prevProcess = process.env.ALLOW_LOCAL_LLM_PROCESS;
  try {
    process.env.ALLOW_LOCAL_LLM_LOOPBACK = 'true';
    const blocked = [
      'http://169.254.169.254/latest/meta-data',
      'http://192.168.1.50:8080/v1',
      'http://10.0.0.5:11434/v1',
      'http://example.com/v1',
      'http://127.0.0.1:22/v1',
      'https://user:pass@tunnel.example.com/v1',
    ];
    for (const url of blocked) {
      const res = await validateLocalLlmEndpoint(url);
      assert.equal(res.ok, false, `Expected local LLM validator to block ${url}`);
    }

    const localOk = await validateLocalLlmEndpoint('http://127.0.0.1:8080');
    assert.equal(localOk.ok, true);
    if (localOk.ok) {
      assert.equal(localOk.normalizedBaseUrl, 'http://127.0.0.1:8080/v1');
      assert.equal(localOk.isLoopback, true);
    }

    process.env.ALLOW_LOCAL_LLM_LOOPBACK = 'false';
    const deniedInCloud = await validateLocalLlmEndpoint('http://127.0.0.1:8080');
    assert.equal(deniedInCloud.ok, false);

    process.env.ALLOW_LOCAL_LLM_PROCESS = 'true';
    await assert.rejects(
      () => startManagedLlamaServer({ modelFile: '../../etc/passwd.gguf' }),
      /Invalid GGUF|not found/i
    );
  } finally {
    if (prevLoopback === undefined) delete process.env.ALLOW_LOCAL_LLM_LOOPBACK;
    else process.env.ALLOW_LOCAL_LLM_LOOPBACK = prevLoopback;
    if (prevProcess === undefined) delete process.env.ALLOW_LOCAL_LLM_PROCESS;
    else process.env.ALLOW_LOCAL_LLM_PROCESS = prevProcess;
  }
});

test('parseSseBuffer and flushSseBuffer handle split frames, CRLF boundaries, no-space data:, and EOF flush', () => {
  // Simulate split chunk ending mid-JSON with CRLF framing
  const packet1 = 'data: {"type":"start","source":"gemini","model":"gemini-2.5-flash"}\r\n\r\ndata:{"type":"chunk","text":"Ayubo';
  const step1 = parseSseBuffer(packet1);
  assert.equal(step1.events.length, 1);
  assert.equal(step1.events[0].json.type, 'start');
  assert.equal(step1.rest, 'data:{"type":"chunk","text":"Ayubo');

  // Second packet completes first chunk and adds another without trailing blank line (EOF)
  const packet2 = `${step1.rest}wan!"}\r\n\r\n: keepalive\r\n\r\ndata: {"type":"chunk","text":" RaOne"}`;
  const step2 = parseSseBuffer(packet2);
  assert.equal(step2.events.length, 1);
  assert.equal(extractSseTextDelta(step2.events[0].json), 'Ayubowan!');

  // Flush final trailing event at EOF plus ignore [DONE]
  const flushed = flushSseBuffer(step2.rest);
  assert.equal(flushed.length, 1);
  assert.equal(extractSseTextDelta(flushed[0].json), ' RaOne');

  assert.equal(flushSseBuffer('data: [DONE]\n\n').length, 0);
  assert.equal(extractSseTextDelta({ choices: [{ delta: { content: 'Delta' } }] }), 'Delta');
});

test('Code Studio engine decomposes, compiles, validates JS syntax via vm.Script, and versions multi-file builds', async () => {
  const {
    normalizeStudioMode,
    decomposeHtmlIntoFiles,
    compileFilesIntoHtmlBundle,
    validateStudioProject,
    materializeProjectFromRawOutput,
  } = await import('../server_studio_engine.ts');

  assert.equal(normalizeStudioMode('Fullstack mode'), 'Fullstack mode');
  assert.equal(normalizeStudioMode('mobile'), 'Mobile mode');

  const sampleHtml = `<!DOCTYPE html><html><head><title>Demo</title><style>body{color:#fff}</style></head><body><div id="app">Hi</div><script>const x = 42; console.log(x);</script></body></html>`;
  const files = decomposeHtmlIntoFiles(sampleHtml, 'Demo App', 'Build demo', 'Fullstack mode');
  assert.ok(files['index.html'].includes('<div id="app">Hi</div>'));
  assert.ok(files['styles.css'].includes('color:#fff'));
  assert.ok(files['app.js'].includes('const x = 42'));
  assert.ok(files['api_routes.js'].includes('__RAONE_API_ROUTES__'));

  const recompiled = compileFilesIntoHtmlBundle(files);
  const validDiag = validateStudioProject(files, recompiled);
  assert.equal(validDiag.syntaxOk, true);
  assert.equal(validDiag.errors.length, 0);

  const brokenHtml = `<!DOCTYPE html><html><head></head><body><script>function broken( { return ;</script></body></html>`;
  const brokenDiag = validateStudioProject({ 'index.html': brokenHtml }, brokenHtml);
  assert.equal(brokenDiag.syntaxOk, false);
  assert.ok(brokenDiag.errors[0].includes('JavaScript Syntax Error'));

  const jsonModelOut = JSON.stringify({
    title: 'Sprint Pulse',
    description: 'Fullstack Kanban',
    files: {
      'index.html': '<!DOCTYPE html><html><head></head><body><main>Board</main></body></html>',
      'styles.css': 'main { padding: 16px; }',
      'app.js': 'window.__READY__ = true;',
    },
  });
  const mat1 = materializeProjectFromRawOutput({
    rawText: jsonModelOut,
    prompt: 'Build Sprint Pulse',
    category: 'Productivity',
    mode: 'Fullstack mode',
    providerUsed: 'gemini',
    modelUsed: 'gemini-4-hydrogen',
  });
  assert.ok(mat1);
  assert.equal(mat1?.versions?.length, 1);
  assert.equal(mat1?.currentVersion, 1);
  assert.equal(mat1?.diagnostics?.syntaxOk, true);
});

test('studioCompiler creates valid PK ZIP archives and injects preview telemetry bridge', async () => {
  const { bundleFilesToHtml, injectPreviewTelemetry, createProjectZipBlob } = await import(
    '../src/utils/studioCompiler.ts'
  );

  const compiled = bundleFilesToHtml({
    'index.html': '<!DOCTYPE html><html><head></head><body><h1>App</h1></body></html>',
    'styles.css': 'h1 { color: red; }',
    'app.js': 'console.log("ok");',
  });
  assert.ok(compiled.includes('<style>'));
  assert.ok(compiled.includes('console.log("ok")'));

  const instrumented = injectPreviewTelemetry(compiled, true);
  assert.ok(instrumented.includes('data-raone-telemetry="true"'));
  assert.ok(instrumented.includes('raone-preview'));

  const zipBlob = createProjectZipBlob('Test Project', {
    'index.html': compiled,
    'styles.css': 'h1 { color: red; }',
    'app.js': 'console.log("ok");',
  });
  const buf = Buffer.from(await zipBlob.arrayBuffer());
  assert.equal(buf.subarray(0, 2).toString('ascii'), 'PK');
  assert.ok(buf.length > 150);
});

test('Vision Studio engine compiles camera/lighting specs, enhances 2-word prompts, routes Nano Banana tiers, and secures assets', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const {
    compileVisionPrompt,
    compileVisionEditInstruction,
    fallbackEnhanceVisionPrompt,
    selectGeminiImageEngine,
    normalizeAspectRatioForGemini,
    computeVisionDimensions,
    resolveTenantVisionAssetPath,
    saveTenantVisionAsset,
  } = await import('../server_vision_engine.ts');

  const compiled = compileVisionPrompt({
    prompt: 'golden cybernetic lion',
    negativePrompt: 'blurry, watermark',
    model: 'Flux 1.1 Pro (LDM)',
    style: 'Cinematic Photoreal',
    aspectRatio: '16:9',
    photoReal: true,
    alchemy: true,
    cameraSpec: {
      shotType: 'Low-Angle Hero',
      lens: '85mm Portrait Telephoto',
      aperture: 'f/1.8 Shallow Depth',
      lighting: 'Golden Hour Warm Sun',
      colorGrade: 'Kodak Portra 400 Warm',
    },
  });
  assert.ok(compiled.includes('golden cybernetic lion'));
  assert.ok(compiled.includes('85mm Portrait Telephoto'));
  assert.ok(compiled.includes('Golden Hour Warm Sun'));
  assert.ok(compiled.includes('blurry, watermark'));

  const editInstr = compileVisionEditInstruction({
    instruction: 'change jacket to black leather',
    operationType: 'inpaint',
    hasMask: true,
    hasReferenceImages: false,
    preservationStrength: 85,
  });
  assert.ok(editInstr.includes('INPAINT'));
  assert.ok(editInstr.includes('painted edit mask'));
  assert.ok(editInstr.includes('85%'));

  const enhanced = fallbackEnhanceVisionPrompt('red car', { mode: 'product', style: 'Commercial Product Studio' });
  assert.ok(enhanced.enhancedPrompt.includes('red car'));
  assert.ok(enhanced.enhancedPrompt.length > 60);
  assert.ok(enhanced.suggestedNegativePrompt.length > 10);

  assert.equal(
    selectGeminiImageEngine({ modelProfile: 'Nano Banana Flash Lite', resolution: '1K', aspectRatio: '16:9' }),
    'gemini-3.1-flash-lite-image'
  );
  assert.equal(
    selectGeminiImageEngine({ modelProfile: 'Nano Banana Flash Lite', resolution: '4K', aspectRatio: '16:9' }),
    'gemini-nano-banana-2.1'
  );
  assert.equal(normalizeAspectRatioForGemini('21:9', 'gemini-nano-banana-2.1'), '4:1');
  assert.equal(computeVisionDimensions('1:1', '2K'), '1536x1536');

  // Path traversal guard + asset write/cleanup
  assert.equal(resolveTenantVisionAssetPath('test_vision_t', '../../etc/passwd'), null);
  const testId = `test-vis-${Date.now()}`;
  const saved = await saveTenantVisionAsset(
    'test_vision_t',
    testId,
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64'),
    'image/png'
  );
  assert.ok(saved.imageUrl.startsWith('/api/vision/assets/'));
  const resolved = resolveTenantVisionAssetPath('test_vision_t', saved.assetFilename);
  assert.ok(resolved && fs.existsSync(resolved));
  fs.rmSync(path.join(process.cwd(), 'data', 'tenants', 'test_vision_t'), { recursive: true, force: true });
});


