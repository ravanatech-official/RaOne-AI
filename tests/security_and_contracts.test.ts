import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  verifyFirebaseBearerToken,
  encryptSecret,
  decryptSecret,
  validateSafeHttpsEgress,
  hashDemoPasscodeScrypt,
  verifyDemoPasscodeScrypt,
  verifyEnvDemoPasscode,
  createSignedDemoSessionToken,
  verifySignedDemoSessionToken,
  resolveActorMiddleware,
  requireVerifiedAuth,
  requireFirebaseJwtOnly,
  sanitizePrototypeKeysDeep,
  isAdminEmail,
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

  // Unsigned/forged 3-part JWT targeting project ravanatek
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'forged' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      aud: 'ravanatek',
      iss: 'https://securetoken.google.com/ravanatek',
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

// ===========================================================================
// Phase 1 Cloud-Native Architecture Tests (Firestore / GCS / Auth / Routing)
// ===========================================================================

test('Local persistence & 5-studio + Files Library full lifecycle survives reads, downloads, bulk ZIP, and purge', async () => {
  const { saveTenantVisionAsset, readTenantVisionAssetBuffer } = await import('../server_vision_engine.ts');
  const { saveTenantCinemaAssetBuffer, readTenantCinemaAssetBuffer } = await import('../server_cinema_engine.ts');
  const { saveTenantMusicAssetBuffer, readTenantMusicAssetBuffer } = await import('../server_music_engine.ts');
  const { saveTenantDocAssetBuffer, readTenantDocAssetBuffer } = await import('../server_document_engine.ts');
  const {
    listUnifiedLibraryAssets,
    resolveLibraryDownloadAsset,
    buildLibraryBulkZip,
    purgeLibraryAssets,
  } = await import('../server_library_engine.ts');

  const tenantId = `test_phase1_local_${crypto.randomUUID().slice(0, 8)}`;
  try {
    // 1. Create Code App
    await mutateTenantCollection<any[]>(tenantId, 'studio_apps', [], () => [
      {
        id: 'app_1',
        title: 'Phase1 Demo App',
        category: 'SaaS',
        files: {
          'index.html': '<!DOCTYPE html><html><body><h1>Hi</h1></body></html>',
          'app.js': 'console.log(1);',
        },
        createdAt: new Date().toISOString(),
      },
    ]);

    // 2. Vision asset
    const vis = await saveTenantVisionAsset(
      tenantId,
      'vis_1',
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64'),
      'image/png'
    );
    await mutateTenantCollection<any[]>(tenantId, 'vision_images', [], () => [
      {
        id: 'vis_1',
        prompt: 'Cyberpunk skyline',
        imageUrl: vis.imageUrl,
        assetFilename: vis.assetFilename,
        createdAt: new Date().toISOString(),
      },
    ]);
    assert.ok(await readTenantVisionAssetBuffer(tenantId, vis.assetFilename));

    // 3. Cinema asset
    const cin = await saveTenantCinemaAssetBuffer(tenantId, 'mov_1', 'mp4', Buffer.from('FAKE_MP4_STREAM'));
    await mutateTenantCollection<any[]>(tenantId, 'motion_videos', [], () => [
      {
        id: 'mov_1',
        prompt: 'Drone sunrise',
        videoUrl: cin.url,
        assetFilename: cin.filename,
        createdAt: new Date().toISOString(),
      },
    ]);
    assert.ok(await readTenantCinemaAssetBuffer(tenantId, cin.filename));

    // 4. Music asset
    const mus = await saveTenantMusicAssetBuffer(tenantId, 'aud_1', 'mp3', Buffer.from('ID3_FAKE_MP3'));
    await mutateTenantCollection<any[]>(tenantId, 'audio_tracks', [], () => [
      {
        id: 'aud_1',
        title: 'Midnight Synth',
        prompt: 'Synthwave',
        audioUrl: mus.url,
        assetFilename: mus.filename,
        createdAt: new Date().toISOString(),
      },
    ]);
    assert.ok(await readTenantMusicAssetBuffer(tenantId, mus.filename));

    // 5. Document asset
    const docAsset = await saveTenantDocAssetBuffer(tenantId, 'doc_1', 'md', Buffer.from('# Spec\nContent', 'utf-8'));
    await mutateTenantCollection<any[]>(tenantId, 'documents', [], () => [
      {
        id: 'doc_1',
        title: 'Cloud Spec',
        content: '# Spec\nContent',
        docAssetFilename: docAsset.filename,
        createdAt: new Date().toISOString(),
      },
    ]);
    assert.ok(await readTenantDocAssetBuffer(tenantId, docAsset.filename));

    // 6. Verify unified library recognizes all 5 studios + downloads + bulk zip
    const vault = await listUnifiedLibraryAssets(tenantId);
    assert.equal(vault.stats.totalAssets, 5);
    assert.equal(vault.stats.byStudio.code.count, 1);
    assert.equal(vault.stats.byStudio.vision.count, 1);
    assert.equal(vault.stats.byStudio.cinema.count, 1);
    assert.equal(vault.stats.byStudio.music.count, 1);
    assert.equal(vault.stats.byStudio.document.count, 1);

    const dlVision = await resolveLibraryDownloadAsset({ tenantId, studio: 'vision', rawId: 'vis_1', format: 'png' });
    assert.ok(dlVision && dlVision.buffer.length === 8);

    const zip = await buildLibraryBulkZip(tenantId, [
      { studio: 'code', rawId: 'app_1', format: 'zip' },
      { studio: 'vision', rawId: 'vis_1', format: 'png' },
      { studio: 'music', rawId: 'aud_1', format: 'mp3' },
    ]);
    assert.equal(zip.buffer.subarray(0, 2).toString('ascii'), 'PK');

    // 7. Purge one item & verify binary removal
    await purgeLibraryAssets(tenantId, ['vision:vis_1', 'document:doc_1']);
    assert.equal(await readTenantVisionAssetBuffer(tenantId, vis.assetFilename), null);
    assert.equal(await readTenantDocAssetBuffer(tenantId, docAsset.filename), null);
  } finally {
    await purgeAllTenantData(tenantId);
  }
});

test('Mocked Cloud Firestore & GCS adapters enforce schema, byte-range streaming, tenant isolation, and fail loudly without local fallback', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { EventEmitter } = await import('node:events');
  const { PassThrough } = await import('node:stream');
  const {
    FirestoreStructuredPersistenceProvider,
    GcsMediaStorageProvider,
    CloudPersistenceError,
    setCloudAdaptersForTesting,
    resetCloudAdaptersForTesting,
    getStructuredPersistenceProvider,
    getMediaStorageProvider,
    migrateLocalTenantToCloud,
  } = await import('../server_cloud_persistence.ts');

  // Lightweight in-memory Firestore mock honoring collection/doc/orderBy/startAfter/limit/count/runTransaction/batch
  const firestoreStore = new Map<string, Record<string, any>>();
  const createDocRef = (docPath: string): any => ({
    id: docPath.split('/').pop()!,
    path: docPath,
    collection: (sub: string) => createColRef(`${docPath}/${sub}`),
    get: async () => ({
      id: docPath.split('/').pop()!,
      exists: firestoreStore.has(docPath),
      data: () => (firestoreStore.has(docPath) ? structuredClone(firestoreStore.get(docPath)) : undefined),
    }),
    set: async (data: Record<string, any>) => {
      firestoreStore.set(docPath, structuredClone(data));
    },
    delete: async () => {
      firestoreStore.delete(docPath);
    },
    listCollections: async () => {
      const prefix = `${docPath}/`;
      const names = new Set<string>();
      for (const k of firestoreStore.keys()) {
        if (k.startsWith(prefix)) {
          const rest = k.slice(prefix.length).split('/')[0];
          if (rest) names.add(rest);
        }
      }
      return Array.from(names).map((n) => createColRef(`${docPath}/${n}`));
    },
  });

  const buildQuery = (colPath: string, opts?: { orderField?: string; after?: number; lim?: number }): any => ({
    orderBy: (field: string) => buildQuery(colPath, { ...opts, orderField: field }),
    startAfter: (val: number) => buildQuery(colPath, { ...opts, after: val }),
    limit: (lim: number) => buildQuery(colPath, { ...opts, lim }),
    count: () => ({
      get: async () => {
        const prefix = `${colPath}/`;
        let count = 0;
        for (const k of firestoreStore.keys()) {
          if (k.startsWith(prefix) && !k.slice(prefix.length).includes('/')) count++;
        }
        return { data: () => ({ count }) };
      },
    }),
    get: async () => {
      const prefix = `${colPath}/`;
      let rows: Array<{ id: string; ref: any; data: Record<string, any> }> = [];
      for (const [k, v] of firestoreStore.entries()) {
        if (k.startsWith(prefix) && !k.slice(prefix.length).includes('/')) {
          rows.push({ id: k.slice(prefix.length), ref: createDocRef(k), data: structuredClone(v) });
        }
      }
      if (opts?.orderField) {
        rows.sort((a, b) => Number(a.data[opts.orderField!] ?? 0) - Number(b.data[opts.orderField!] ?? 0));
      }
      if (opts?.after !== undefined) {
        rows = rows.filter((r) => Number(r.data[opts?.orderField || '_orderIndex'] ?? 0) > opts.after!);
      }
      if (opts?.lim !== undefined) {
        rows = rows.slice(0, opts.lim);
      }
      return {
        empty: rows.length === 0,
        docs: rows.map((r) => ({ id: r.id, ref: r.ref, data: () => r.data })),
      };
    },
  });

  const createColRef = (colPath: string): any => ({
    ...buildQuery(colPath),
    doc: (id: string) => createDocRef(`${colPath}/${id}`),
  });

  const mockDb: any = {
    collection: (name: string) => createColRef(name),
    runTransaction: async (fn: (tx: any) => Promise<any>) => {
      const ops: Array<() => void> = [];
      const tx = {
        get: async (target: any) => target.get(),
        set: (docRef: any, data: Record<string, any>) => ops.push(() => firestoreStore.set(docRef.path, structuredClone(data))),
        delete: (docRef: any) => ops.push(() => firestoreStore.delete(docRef.path)),
      };
      const result = await fn(tx);
      for (const op of ops) op();
      return result;
    },
    batch: () => {
      const ops: Array<() => void> = [];
      return {
        delete: (docRef: any) => ops.push(() => firestoreStore.delete(docRef.path)),
        commit: async () => {
          for (const op of ops) op();
        },
      };
    },
  };

  // In-memory GCS Bucket mock
  const gcsObjects = new Map<string, { data: Buffer; metadata: Record<string, any> }>();
  const mockBucket: any = {
    file: (objectPath: string) => ({
      save: async (buf: Buffer, opts: any) => {
        gcsObjects.set(objectPath, {
          data: Buffer.from(buf),
          metadata: {
            contentType: opts?.contentType || 'application/octet-stream',
            size: buf.length,
            timeCreated: new Date().toISOString(),
            updated: new Date().toISOString(),
            metadata: opts?.metadata?.metadata || {},
          },
        });
      },
      createWriteStream: (opts: any) => {
        const pt = new PassThrough();
        const chunks: Buffer[] = [];
        pt.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        pt.on('finish', () => {
          const buf = Buffer.concat(chunks);
          gcsObjects.set(objectPath, {
            data: buf,
            metadata: {
              contentType: opts?.contentType || 'application/octet-stream',
              size: buf.length,
              timeCreated: new Date().toISOString(),
              updated: new Date().toISOString(),
              metadata: opts?.metadata?.metadata || {},
            },
          });
        });
        return pt;
      },
      createReadStream: (rangeOpts?: { start?: number; end?: number }) => {
        const pt = new PassThrough();
        const entry = gcsObjects.get(objectPath);
        if (!entry) {
          queueMicrotask(() => pt.destroy(new Error('NoSuchKey')));
        } else {
          const start = rangeOpts?.start ?? 0;
          const end = rangeOpts?.end !== undefined ? rangeOpts.end + 1 : entry.data.length;
          pt.end(entry.data.subarray(start, end));
        }
        return pt;
      },
      exists: async () => [gcsObjects.has(objectPath)],
      download: async () => [Buffer.from(gcsObjects.get(objectPath)!.data)],
      getMetadata: async () => [structuredClone(gcsObjects.get(objectPath)!.metadata)],
      setMetadata: async (patch: any) => {
        const entry = gcsObjects.get(objectPath)!;
        if (patch.contentType) entry.metadata.contentType = patch.contentType;
        entry.metadata.metadata = { ...(entry.metadata.metadata || {}), ...(patch.metadata || {}) };
        entry.metadata.updated = new Date().toISOString();
      },
      getSignedUrl: async ({ expires }: { expires: number }) => [
        `https://storage.googleapis.com/raoneai-mock/${objectPath}?X-Goog-Expires=${Math.round((expires - Date.now()) / 1000)}`,
      ],
      delete: async () => {
        gcsObjects.delete(objectPath);
      },
    }),
    deleteFiles: async ({ prefix }: { prefix: string }) => {
      for (const k of Array.from(gcsObjects.keys())) {
        if (k.startsWith(prefix)) gcsObjects.delete(k);
      }
    },
  };

  const fsProvider = new FirestoreStructuredPersistenceProvider(() => mockDb);
  const gcsProvider = new GcsMediaStorageProvider(
    () => mockBucket,
    () => fsProvider
  );

  const prevBackend = process.env.STORAGE_BACKEND;
  const prevBucket = process.env.GCS_BUCKET_NAME;

  try {
    setCloudAdaptersForTesting({ structured: fsProvider, media: gcsProvider });

    // 1. Firestore singleton + array subcollections + undefined stripping + pagination + tenant isolation
    await fsProvider.mutateTenantCollection<Record<string, any>>('user_alice', 'settings', {}, () => ({
      theme: 'dark',
      language: 'si',
      optionalEmpty: undefined,
    }));
    const aliceSettings = await fsProvider.readTenantCollection<Record<string, any>>('user_alice', 'settings', {});
    assert.equal(aliceSettings.theme, 'dark');
    assert.equal('optionalEmpty' in aliceSettings, false);

    const bobSettings = await fsProvider.readTenantCollection<Record<string, any>>('user_bob', 'settings', {});
    assert.deepEqual(bobSettings, {});

    await fsProvider.mutateTenantCollection<any[]>('user_alice', 'vision_images', [], () => [
      { id: 'v1', prompt: 'One' },
      { id: 'v2', prompt: 'Two' },
      { id: 'v3', prompt: 'Three' },
    ]);
    const page1 = await fsProvider.listTenantCollectionPaginated<any>('user_alice', 'vision_images', { limit: 2 });
    assert.equal(page1.items.length, 2);
    assert.equal(page1.total, 3);
    assert.equal(page1.hasMore, true);
    const page2 = await fsProvider.listTenantCollectionPaginated<any>('user_alice', 'vision_images', {
      limit: 2,
      cursor: page1.nextCursor,
    });
    assert.equal(page2.items.length, 1);
    assert.equal(page2.items[0].id, 'v3');
    assert.equal(page2.hasMore, false);

    // 2. Credit ledger Firestore transaction
    const { balance } = await getTenantCreditBalance('user_alice');
    assert.equal(balance, 200);
    const resTx = await reserveCredits('user_alice', 40, 'cloud_gen', 'ref-cloud-1');
    assert.equal(resTx.ok, true);
    assert.equal(resTx.balance, 160);

    // 3. GCS upload, streaming saveFromFile, metadata, signed URL, byte-range HTTP 206, delete
    const savedImg = await gcsProvider.saveBuffer({
      tenantId: 'user_alice',
      category: 'vision',
      filename: 'render_1.png',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      mimeType: 'image/png',
      originalName: 'Hero Render.png',
    });
    assert.equal(savedImg.objectPath, 'tenants/user_alice/vision/render_1.png');
    assert.equal(savedImg.storageProvider, 'cloud');
    assert.ok(savedImg.checksum);
    assert.equal(gcsObjects.has('tenants/user_alice/vision/render_1.png'), true);
    assert.equal(await gcsProvider.exists('user_bob', 'vision', 'render_1.png'), false);

    const signedUrl = await gcsProvider.getSignedDownloadUrl('user_alice', 'vision', 'render_1.png', 1800);
    assert.ok(signedUrl && signedUrl.includes('tenants/user_alice/vision/render_1.png'));

    // Reject disallowed MIME for vision category
    await assert.rejects(
      () =>
        gcsProvider.saveBuffer({
          tenantId: 'user_alice',
          category: 'vision',
          filename: 'bad.sh',
          buffer: Buffer.from('#!/bin/sh'),
          mimeType: 'application/x-sh',
        }),
      /not allowed/i
    );

    // Byte-Range 206 test on Cinema MP4 in mocked GCS
    const videoPayload = Buffer.from('0123456789ABCDEF');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'raone-gcs-test-'));
    try {
      const srcVideo = path.join(tmpDir, 'clip.mp4');
      fs.writeFileSync(srcVideo, videoPayload);
      const vidMeta = await gcsProvider.saveFromFile({
        tenantId: 'user_alice',
        category: 'cinema',
        filename: 'clip.mp4',
        localFilePath: srcVideo,
        mimeType: 'video/mp4',
      });
      assert.equal(vidMeta.objectPath, 'tenants/user_alice/cinema/clip.mp4');

      const mockReq: any = { headers: { range: 'bytes=4-9' } };
      const headersOut: Record<string, string> = {};
      const chunksOut: Buffer[] = [];
      const mockRes: any = Object.assign(new EventEmitter(), {
        statusCode: 200,
        headersSent: false,
        writable: true,
        setHeader: (k: string, v: string) => {
          headersOut[k.toLowerCase()] = String(v);
        },
        status: (code: number) => {
          mockRes.statusCode = code;
          return mockRes;
        },
        write: (chunk: any) => {
          chunksOut.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          return true;
        },
        end: (chunk?: any) => {
          if (chunk) chunksOut.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          mockRes.emit('finish');
        },
        destroy: () => {},
      });
      const streamed = await gcsProvider.streamHttpResponse(mockReq, mockRes, 'user_alice', 'cinema', 'clip.mp4');
      assert.equal(streamed, true);
      await new Promise<void>((r) => mockRes.on('finish', () => r()));
      assert.equal(mockRes.statusCode, 206);
      assert.equal(headersOut['content-range'], 'bytes 4-9/16');
      assert.equal(Buffer.concat(chunksOut).toString('utf-8'), '456789');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    await gcsProvider.deleteAsset('user_alice', 'vision', 'render_1.png');
    assert.equal(await gcsProvider.exists('user_alice', 'vision', 'render_1.png'), false);

    // 4. Strict Cloud Failure Policy: NEVER silently fall back to local disk when cloud fails or is misconfigured
    resetCloudAdaptersForTesting();
    process.env.STORAGE_BACKEND = 'cloud';
    process.env.GCS_BUCKET_NAME = '';
    assert.throws(() => getMediaStorageProvider(), CloudPersistenceError);

    const failingFs = new FirestoreStructuredPersistenceProvider(() => {
      throw new Error('Simulated Firestore network outage');
    });
    await assert.rejects(
      () => failingFs.readTenantCollection('user_alice', 'settings', {}),
      (err: any) => err instanceof CloudPersistenceError && err.code === 'FIRESTORE_INIT_FAILED'
    );
    // Explicitly ensure no local data was written during cloud failures
    assert.equal(fs.existsSync(path.join(process.cwd(), 'data', 'tenants', 'user_alice', 'settings.json')), false);

    // Migration guard in local mode
    process.env.STORAGE_BACKEND = 'local';
    await assert.rejects(() => migrateLocalTenantToCloud('user_alice'), /MIGRATION_REQUIRES_CLOUD_MODE|STORAGE_BACKEND=cloud/);
  } finally {
    resetCloudAdaptersForTesting();
    if (prevBackend === undefined) delete process.env.STORAGE_BACKEND;
    else process.env.STORAGE_BACKEND = prevBackend;
    if (prevBucket === undefined) delete process.env.GCS_BUCKET_NAME;
    else process.env.GCS_BUCKET_NAME = prevBucket;
  }
});

test('Authentication middleware enforces Firebase JWTs, derives authoritative tenantId, isolates media cookies, and blocks tampered cookies', async () => {
  const { resolveActorMiddleware, requireVerifiedAuth, setTokenVerifierForTesting } = await import(
    '../server_security.ts'
  );

  const prevStrict = process.env.REQUIRE_FIREBASE_AUTH;

  const invokeMw = (mw: any, opts: { method?: string; path: string; headers?: Record<string, string>; actor?: any }) =>
    new Promise<{ nextCalled: boolean; status: number; body: any; setCookies: string[]; req: any }>((resolve) => {
      const setCookies: string[] = [];
      let status = 200;
      let body: any = null;
      const req: any = {
        method: opts.method || 'GET',
        baseUrl: '',
        path: opts.path,
        headers: opts.headers || {},
        requestId: 'req_test_1234',
        actor: opts.actor,
      };
      const res: any = {
        setHeader: () => {},
        append: (name: string, val: string) => {
          if (name.toLowerCase() === 'set-cookie') setCookies.push(val);
        },
        status: (code: number) => {
          status = code;
          return res;
        },
        json: (payload: any) => {
          body = payload;
          resolve({ nextCalled: false, status, body, setCookies, req });
          return res;
        },
      };
      mw(req, res, () => resolve({ nextCalled: true, status, body, setCookies, req }));
    });

  try {
    process.env.REQUIRE_FIREBASE_AUTH = 'true';
    setTokenVerifierForTesting(async (tok) => {
      if (tok === 'valid.alice.jwt') {
        return { uid: 'alice_123', email: 'alice@raone.ai', emailVerified: true };
      }
      if (tok === 'expired.alice.jwt') {
        throw new Error('Firebase ID token has expired.');
      }
      throw new Error('Invalid Firebase ID token signature.');
    });

    // 1. Missing token rejected with 401 on protected routes
    const unauthRes = await invokeMw(resolveActorMiddleware, { method: 'POST', path: '/api/chat' });
    assert.equal(unauthRes.nextCalled, false);
    assert.equal(unauthRes.status, 401);
    assert.equal(unauthRes.body.code, 'AUTH_REQUIRED');

    // 2. Public health/capabilities/share routes remain accessible without token
    const healthRes = await invokeMw(resolveActorMiddleware, { method: 'GET', path: '/api/health' });
    assert.equal(healthRes.nextCalled, true);
    const shareRes = await invokeMw(resolveActorMiddleware, { method: 'GET', path: '/api/motion/share/pub123' });
    assert.equal(shareRes.nextCalled, true);

    // 3. Invalid & expired tokens rejected with 401
    const expiredRes = await invokeMw(resolveActorMiddleware, {
      method: 'GET',
      path: '/api/projects',
      headers: { authorization: 'Bearer expired.alice.jwt' },
    });
    assert.equal(expiredRes.nextCalled, false);
    assert.equal(expiredRes.status, 401);
    assert.equal(expiredRes.body.code, 'TOKEN_VERIFICATION_FAILED');

    // 4. Valid token binds authoritative tenant user_alice_123 (even if client sends forged header) & issues signed HttpOnly cookie
    const aliceRes = await invokeMw(resolveActorMiddleware, {
      method: 'GET',
      path: '/api/projects',
      headers: {
        authorization: 'Bearer valid.alice.jwt',
        'x-tenant-id': 'user_attacker_spoof',
      },
    });
    assert.equal(aliceRes.nextCalled, true);
    assert.equal(aliceRes.req.actor.tenantId, 'user_alice_123');
    assert.equal(aliceRes.req.actor.isAuthenticated, true);
    assert.equal(aliceRes.setCookies.length, 1);
    assert.ok(aliceRes.setCookies[0].includes('HttpOnly'));

    const cookiePair = aliceRes.setCookies[0].split(';')[0];

    // 5. Signed cookie grants GET media asset access for Alice ONLY
    const mediaCookieOk = await invokeMw(resolveActorMiddleware, {
      method: 'GET',
      path: '/api/vision/assets/render.png',
      headers: { cookie: cookiePair },
    });
    assert.equal(mediaCookieOk.nextCalled, true);
    assert.equal(mediaCookieOk.req.actor.tenantId, 'user_alice_123');
    assert.equal(mediaCookieOk.req.actor.authSource, 'firebase_media_cookie');

    // 6. Cookie-only is rejected on non-media POST mutations under REQUIRE_FIREBASE_AUTH=true
    const cookiePostDenied = await invokeMw(resolveActorMiddleware, {
      method: 'POST',
      path: '/api/vision/generate',
      headers: { cookie: cookiePair },
    });
    assert.equal(cookiePostDenied.nextCalled, false);
    assert.equal(cookiePostDenied.status, 401);

    // 7. Tampered media cookie rejected with 401
    const tamperedCookie = await invokeMw(resolveActorMiddleware, {
      method: 'GET',
      path: '/api/vision/assets/render.png',
      headers: { cookie: `${cookiePair}tampered` },
    });
    assert.equal(tamperedCookie.nextCalled, false);
    assert.equal(tamperedCookie.status, 401);

    // 8. requireVerifiedAuth rejects guest actors
    const guestBlocked = await invokeMw(requireVerifiedAuth, {
      method: 'POST',
      path: '/api/account/delete',
      actor: { uid: 'guest', tenantId: 'guest_workspace', isAuthenticated: false, authSource: 'guest_workspace' },
    });
    assert.equal(guestBlocked.nextCalled, false);
    assert.equal(guestBlocked.status, 401);
  } finally {
    setTokenVerifierForTesting(null);
    if (prevStrict === undefined) delete process.env.REQUIRE_FIREBASE_AUTH;
    else process.env.REQUIRE_FIREBASE_AUTH = prevStrict;
  }
});

test('Firebase Hosting rewrite, relative /api routing, and .env.example follow Cloud-Native Architecture B', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const firebaseJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase.json'), 'utf-8'));
  const rewrites: any[] = firebaseJson?.hosting?.rewrites || [];
  assert.ok(rewrites.length >= 2, 'Expected both API rewrite and SPA fallback rewrite');
  assert.equal(rewrites[0].source, '/api/**');
  assert.equal(rewrites[0].run?.serviceId, 'raone-ai-backend');
  assert.equal(rewrites[0].run?.region, 'asia-southeast1');
  assert.equal(rewrites[rewrites.length - 1].source, '**');
  assert.equal(rewrites[rewrites.length - 1].destination, '/index.html');

  const apiTs = fs.readFileSync(path.join(process.cwd(), 'src', 'utils', 'api.ts'), 'utf-8');
  assert.equal(apiTs.includes('.run.app'), false, 'src/utils/api.ts must not hardcode temporary Cloud Run URLs');
  assert.equal(apiTs.includes('348832701843'), false);

  const envExample = fs.readFileSync(path.join(process.cwd(), '.env.example'), 'utf-8');
  for (const requiredKey of [
    'STORAGE_BACKEND=',
    'GCS_BUCKET_NAME=',
    'FIREBASE_PROJECT_ID=ravanatek',
    'REQUIRE_FIREBASE_AUTH=',
    'ALLOWED_ORIGINS=https://ravanatek.web.app',
    'TENANT_ENCRYPTION_SECRET=',
    'COMET_API_BASE_URL=',
    'VITE_API_BASE_URL=',
  ]) {
    assert.ok(envExample.includes(requiredKey), `.env.example missing ${requiredKey}`);
  }

  const { getStorageBackendMode } = await import('../server_cloud_persistence.ts');
  const { isFirebaseAuthRequired } = await import('../server_security.ts');
  const prevNodeEnv = process.env.NODE_ENV;
  const prevStorage = process.env.STORAGE_BACKEND;
  const prevAuth = process.env.REQUIRE_FIREBASE_AUTH;
  try {
    delete process.env.STORAGE_BACKEND;
    delete process.env.REQUIRE_FIREBASE_AUTH;
    process.env.NODE_ENV = 'production';
    assert.equal(getStorageBackendMode(), 'cloud');
    assert.equal(isFirebaseAuthRequired(), true);
  } finally {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
    if (prevStorage === undefined) delete process.env.STORAGE_BACKEND;
    else process.env.STORAGE_BACKEND = prevStorage;
    if (prevAuth === undefined) delete process.env.REQUIRE_FIREBASE_AUTH;
    else process.env.REQUIRE_FIREBASE_AUTH = prevAuth;
  }
});

test('SaaS pricing catalog, daily free-tier quotas, webhook idempotency, disposable email check, and multi-provider fallbacks operate reliably', async () => {
  const {
    PLAN_ALLOWANCES,
    CREDIT_COSTS,
    PRICING_PLANS,
    TOPUP_PACKS,
    computeEffectiveCreditCost,
  } = await import('../src/lib/pricingCatalog.ts');
  const { isDisposableEmailDomain } = await import('../server_security.ts');
  const {
    checkAndConsumeDailyFreeQuota,
    recordWebhookEventIdempotent,
    purgeAllTenantData,
  } = await import('../server_tenant_store.ts');
  const {
    isBillingOrQuotaFailure,
    synthesizeProceduralMusicFfmpeg,
  } = await import('../server_media_providers.ts');

  // 1. Competitive Pricing Catalog & BYOK 0-credit guarantee
  assert.equal(PLAN_ALLOWANCES.free, 200);
  assert.equal(PLAN_ALLOWANCES.plus, 2500);
  assert.equal(PLAN_ALLOWANCES.ultimate, 8000);
  assert.equal(PRICING_PLANS.plus.monthlyPriceUsd, 12);
  assert.equal(PRICING_PLANS.ultimate.monthlyPriceUsd, 29);
  assert.equal(TOPUP_PACKS.length, 2);
  assert.equal(computeEffectiveCreditCost(CREDIT_COSTS.vision1K, false), CREDIT_COSTS.vision1K);
  assert.equal(computeEffectiveCreditCost(CREDIT_COSTS.cinemaStandard, true), 0);

  // 2. Disposable email protection & SSRF new providers
  assert.equal(isDisposableEmailDomain('abuser@mailinator.com'), true);
  assert.equal(isDisposableEmailDomain('creator@gmail.com'), false);
  const orCheck = await validateSafeHttpsEgress('https://openrouter.ai/api/v1');
  assert.equal(orCheck.ok, true);

  // 3. Billing / Quota 402 error classifier
  assert.equal(
    isBillingOrQuotaFailure(new Error('{"error":{"code":402,"message":"Your prepayment credits are depleted.","status":"RESOURCE_EXHAUSTED"}}')),
    true
  );
  assert.equal(isBillingOrQuotaFailure(new Error('Syntax error in prompt')), false);

  // 4. Daily Free-Tier Quota Enforcement & Webhook Idempotency
  const quotaTenant = `test_quota_${crypto.randomUUID().slice(0, 8)}`;
  try {
    const q1 = await checkAndConsumeDailyFreeQuota(quotaTenant, 'vision', 2);
    const q2 = await checkAndConsumeDailyFreeQuota(quotaTenant, 'vision', 2);
    const q3 = await checkAndConsumeDailyFreeQuota(quotaTenant, 'vision', 2);
    assert.equal(q1.allowed, true);
    assert.equal(q1.used, 1);
    assert.equal(q2.allowed, true);
    assert.equal(q2.used, 2);
    assert.equal(q3.allowed, false);
    assert.equal(q3.used, 2);

    const evtId = `evt_test_${crypto.randomUUID().slice(0, 8)}`;
    assert.equal(await recordWebhookEventIdempotent(evtId), true);
    assert.equal(await recordWebhookEventIdempotent(evtId), false);
  } finally {
    await purgeAllTenantData(quotaTenant);
  }

  // 5. Procedural Music Synth Fallback (runs if ffmpeg binary is installed)
  try {
    const mp3 = await synthesizeProceduralMusicFfmpeg({ bpm: 120, keySignature: 'Am', durationSec: 2 });
    assert.ok(Buffer.isBuffer(mp3) && mp3.length > 500, 'Expected synthesized MP3 output from FFmpeg');
  } catch (err: any) {
    if (!String(err?.message || '').includes('ENOENT')) throw err;
  }
});

test('Firebase Hosting __session media cookie and Code Studio escaped JSON recovery work cleanly', async () => {
  const { resolveActorMiddleware, setTokenVerifierForTesting } = await import('../server_security.ts');
  const { unescapeAccidentalJsonEscapes, materializeProjectFromRawOutput } = await import(
    '../server_studio_engine.ts'
  );

  // 1. Verify __session cookie is issued with Path=/
  const prevStrict = process.env.REQUIRE_FIREBASE_AUTH;
  try {
    process.env.REQUIRE_FIREBASE_AUTH = 'true';
    setTokenVerifierForTesting(async () => ({
      uid: 'cookie_user_1',
      email: 'c@raone.ai',
      emailVerified: true,
    }));

    const resCookies: string[] = [];
    await new Promise<void>((resolve) => {
      const req: any = {
        method: 'GET',
        baseUrl: '',
        path: '/api/vision/history',
        headers: { authorization: 'Bearer valid.jwt.token', 'x-forwarded-proto': 'https' },
      };
      const res: any = {
        setHeader: () => {},
        append: (k: string, v: string) => {
          if (k.toLowerCase() === 'set-cookie') resCookies.push(v);
        },
        status: () => res,
        json: () => resolve(),
      };
      resolveActorMiddleware(req, res, () => resolve());
    });

    assert.equal(resCookies.length, 1);
    assert.ok(resCookies[0].startsWith('__session='), 'Cookie must use Firebase Hosting __session name');
    assert.ok(resCookies[0].includes('Path=/'), 'Cookie must cover root Path=/');
  } finally {
    setTokenVerifierForTesting(null);
    if (prevStrict === undefined) delete process.env.REQUIRE_FIREBASE_AUTH;
    else process.env.REQUIRE_FIREBASE_AUTH = prevStrict;
  }

  // 2. Verify literal \n / \" escaped HTML inside JSON or malformed Llama output recovers cleanly
  const escapedHtml =
    '"<!DOCTYPE html>\\n<html>\\n<head><title>Recovered</title></head>\\n<body><div id=\\"root\\">Hi</div>\\n<script>const ok = true;\\nconsole.log(ok);</script></body>\\n</html>"';
  const unescaped = unescapeAccidentalJsonEscapes(escapedHtml);
  assert.ok(unescaped.includes('\n'), 'Literal \\n sequences should decode to real newlines');
  assert.equal(unescaped.includes('\\"root\\"'), false, 'Escaped quotes should decode cleanly');

  const malformedLlamaOutput = `Here is your app:\n{\n  "title": "Product Workflow",\n  "description": "Task app",\n  "files": {\n    "index.html": "<!DOCTYPE html>\\n<html>\\n<head><title>Workflow</title></head>\\n<body><main id=\\"app\\">Ready</main></body>\\n</html>",\n    "app.js": "const ready = true;\\nconsole.log(ready);"\n  `;
  const recovered = materializeProjectFromRawOutput({
    rawText: malformedLlamaOutput,
    prompt: 'Build Product Workflow',
    category: 'general',
    mode: 'Default mode',
    providerUsed: 'groq',
    modelUsed: 'raone-llama3-70b',
  });
  assert.ok(recovered, 'Should recover partial/truncated JSON project');
  assert.equal(recovered?.diagnostics?.syntaxOk, true, 'Recovered app JS syntax should validate cleanly');
  assert.equal(recovered?.code.includes('\\n \\n \\n'), false, 'Rendered bundle must not contain literal \\n spam');

  // 3. Reject hollow Vite /src/main.tsx empty-root stubs so Code Studio never renders a blank dark preview
  const hollowViteStub = JSON.stringify({
    title: 'ExpenseTracker Pro',
    description: 'Stub',
    files: {
      'index.html':
        '<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script><script>tailwind.config = { darkMode: "class" };</script></head><body class="bg-gray-900"><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
    },
  });
  const hollowProject = materializeProjectFromRawOutput({
    rawText: hollowViteStub,
    prompt: 'Build ExpenseTracker Pro',
    category: 'webapp',
    mode: 'Default mode',
    providerUsed: 'groq',
    modelUsed: 'raone-llama3-70b',
  });
  assert.ok(hollowProject);
  assert.equal(hollowProject?.diagnostics?.syntaxOk, false, 'Empty #root + /src/main.tsx stub must fail syntaxOk');
  assert.equal(hollowProject?.code.includes('/src/main.tsx'), false, 'Dead /src/main.tsx tag must be stripped from compiled preview bundle');
});

test('Zero-cost free-tier routing, raw-body webhook downgrades, public Firebase rewrites, and lightweight SVG favicon hold strictly', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const crypto = await import('node:crypto');

  const { resolveImageProviderOrder, resolveMusicProviderOrder } = await import('../server_media_providers.ts');
  const { resolveStudioProviderOrder } = await import('../server_studio_engine.ts');
  const { verifyWebhookHmacSignature, resolveWebhookEventAction } = await import('../server_security.ts');

  // 1. Free-tier Image & Music routing skips server-paid Gemini/fal.ai unless BYOK is present
  assert.deepEqual(resolveImageProviderOrder('free', {}), ['cloudflare', 'huggingface', 'pollinations', 'procedural']);
  assert.deepEqual(resolveImageProviderOrder('free', { geminiApiKey: 'AIza-user' }), ['gemini', 'fal', 'cloudflare', 'huggingface', 'pollinations', 'procedural']);
  assert.deepEqual(resolveImageProviderOrder('plus', {}), ['gemini', 'fal', 'cloudflare', 'huggingface', 'pollinations', 'procedural']);

  assert.deepEqual(resolveMusicProviderOrder('free', {}), ['huggingface', 'ffmpeg_synth']);
  assert.deepEqual(resolveMusicProviderOrder('free', { falApiKey: 'fal-user-key' }), ['gemini', 'fal', 'huggingface', 'ffmpeg_synth']);
  assert.deepEqual(resolveMusicProviderOrder('ultimate', {}), ['gemini', 'fal', 'huggingface', 'ffmpeg_synth']);

  // 2. Code Studio free-tier auto order prioritizes Groq/OpenRouter BEFORE Gemini (unless BYOK or image attachment)
  const freeStudioOrder = resolveStudioProviderOrder({ providerChoice: 'auto', plan: 'free', byok: {}, hasImages: false });
  assert.equal(freeStudioOrder[0], 'groq');
  assert.equal(freeStudioOrder[1], 'openrouter');
  const plusStudioOrder = resolveStudioProviderOrder({ providerChoice: 'auto', plan: 'plus', byok: {}, hasImages: false });
  assert.equal(plusStudioOrder[0], 'gemini');
  const multimodalFreeOrder = resolveStudioProviderOrder({ providerChoice: 'auto', plan: 'free', byok: {}, hasImages: true });
  assert.equal(multimodalFreeOrder[0], 'gemini');

  // 3. Raw-body webhook HMAC verification + cancellation/refund downgrade detection
  const rawPayload = Buffer.from('{"tenantId":"user_1","meta":{"event_name":"subscription_cancelled"}}', 'utf-8');
  const secret = 'whsec_test_secret_123';
  const validHex = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');
  assert.equal(verifyWebhookHmacSignature({ secret, signatureHeader: validHex, rawBody: rawPayload }), true);
  assert.equal(verifyWebhookHmacSignature({ secret, signatureHeader: `sha256=${validHex}`, rawBody: rawPayload }), true);
  assert.equal(verifyWebhookHmacSignature({ secret, signatureHeader: validHex, rawBody: Buffer.from('tampered', 'utf-8') }), false);

  assert.equal(resolveWebhookEventAction({ meta: { event_name: 'subscription_cancelled' } }).kind, 'downgrade_free');
  assert.equal(resolveWebhookEventAction({ type: 'subscription.canceled' }).kind, 'downgrade_free');
  assert.equal(resolveWebhookEventAction({ event: 'order_refunded' }).kind, 'downgrade_free');
  assert.deepEqual(resolveWebhookEventAction({ plan: 'plus', billingCycle: 'yearly' }), {
    kind: 'activate_plan',
    plan: 'plus',
    billingCycle: 'yearly',
    eventName: 'plan_activated',
  });

  // 4. Public backend pages rewritten cleanly through Firebase Hosting before SPA fallback
  const firebaseJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase.json'), 'utf-8'));
  const rewrites: Array<{ source: string; run?: { serviceId: string; region: string }; destination?: string }> =
    firebaseJson?.hosting?.rewrites || [];
  const sources = rewrites.map((r) => r.source);
  for (const requiredSource of ['/api/**', '/published/**', '/vision/shared/**', '/privacy-policy', '/terms-of-service']) {
    const idx = sources.indexOf(requiredSource);
    assert.ok(idx >= 0 && idx < sources.length - 1, `${requiredSource} must precede ** SPA fallback`);
    assert.equal(rewrites[idx].run?.serviceId, 'raone-ai-backend');
  }

  // 5. Lightweight SVG favicon + SEO / Git line-ending hygiene
  const indexHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
  assert.ok(indexHtml.includes('href="/favicon.svg"'));
  assert.equal(indexHtml.includes('raone_core_symbol_1794208556087.jpg'), false);
  assert.ok(fs.existsSync(path.join(process.cwd(), 'public', 'favicon.svg')));
  assert.ok(fs.existsSync(path.join(process.cwd(), 'public', 'robots.txt')));
  assert.ok(fs.existsSync(path.join(process.cwd(), '.gitattributes')));
});

test('Free-tier music cover art skips paid Gemini client, documentAudio daily quota enforces limit, and deploy ignores keep bundle lean', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { generateMusicCoverArtBuffer } = await import('../server_music_engine.ts');
  const { FREE_TIER_DAILY_LIMITS } = await import('../src/lib/pricingCatalog.ts');
  const { checkAndConsumeDailyFreeQuota, purgeAllTenantData } = await import('../server_tenant_store.ts');

  // 1. Ensure Free plan + no Gemini BYOK NEVER triggers client.models.generateContent for album cover art
  let geminiCoverCalled = false;
  const mockGeminiClient: any = {
    models: {
      generateContent: async () => {
        geminiCoverCalled = true;
        throw new Error('Should not call paid Gemini for free-tier music cover');
      },
    },
  };
  const cover = await generateMusicCoverArtBuffer(mockGeminiClient, 'Lanka Synth', 'Synthwave', 'Neon', 1234, {
    plan: 'free',
    byok: {},
  });
  assert.equal(geminiCoverCalled, false, 'Free tier music cover art must skip paid Gemini image synthesis');
  assert.ok(Buffer.isBuffer(cover.buffer) && cover.buffer.length > 100);
  assert.ok(cover.ext === 'svg' || cover.ext === 'jpg');

  // 2. Enforce FREE_TIER_DAILY_LIMITS.documentAudio (3/day)
  assert.equal(FREE_TIER_DAILY_LIMITS.documentAudio, 3);
  const t = `test_docaud_${crypto.randomUUID().slice(0, 8)}`;
  try {
    for (let i = 0; i < 3; i++) {
      const q = await checkAndConsumeDailyFreeQuota(t, 'documentAudio', FREE_TIER_DAILY_LIMITS.documentAudio);
      assert.equal(q.allowed, true);
    }
    const q4 = await checkAndConsumeDailyFreeQuota(t, 'documentAudio', FREE_TIER_DAILY_LIMITS.documentAudio);
    assert.equal(q4.allowed, false);
  } finally {
    await purgeAllTenantData(t);
  }

  // 3. Verify firebase.json hosting.ignore strips unused dev attachment bloat while Dockerfile prunes devDependencies
  const firebaseJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase.json'), 'utf-8'));
  const ignores: string[] = firebaseJson?.hosting?.ignore || [];
  assert.ok(ignores.includes('assets/aistudio/Paste_*'));
  assert.ok(ignores.includes('assets/aistudio/image_*'));
  assert.ok(ignores.includes('assets/aistudio/*.mp4'));

  const dockerfile = fs.readFileSync(path.join(process.cwd(), 'Dockerfile'), 'utf-8');
  assert.ok(dockerfile.includes('npm prune --omit=dev'));
  assert.ok(dockerfile.includes('CMD ["node", "server.ts"]'));
});

test('Enterprise Security Hardening: CSRF guard, SVG/script binary block, plugin header/path validation, share XSS defense, and FAANG SEO contracts hold', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const {
    csrfOriginGuard,
    escapeHtml,
    validateBinaryMediaSignature,
    validatePublicHttpsMediaDownloadUrl,
    validatePluginHeaderName,
    validatePluginHealthPath,
  } = await import('../server_security.ts');
  const { buildPublishedVisionHtml } = await import('../server_vision_engine.ts');
  const { uploadExternalFileToVault } = await import('../server_library_engine.ts');
  const { purgeAllTenantData } = await import('../server_tenant_store.ts');

  // 1. CSRF origin guard rejects untrusted cross-origin POST and permits allowed origins + webhook HMAC route
  const invokeCsrf = (opts: { method: string; path: string; headers?: Record<string, string> }) =>
    new Promise<{ allowed: boolean; status: number; code?: string }>((resolve) => {
      let status = 200;
      const req: any = {
        method: opts.method,
        baseUrl: '',
        path: opts.path,
        headers: opts.headers || {},
        requestId: 'csrf_test_1',
      };
      const res: any = {
        status: (s: number) => {
          status = s;
          return res;
        },
        json: (body: any) => {
          resolve({ allowed: false, status, code: body?.code });
          return res;
        },
      };
      csrfOriginGuard(req, res, () => resolve({ allowed: true, status: 200 }));
    });

  const evilOriginPost = await invokeCsrf({
    method: 'POST',
    path: '/api/user/settings',
    headers: { host: 'raone-ai.web.app', origin: 'https://evil-attacker.example' },
  });
  assert.equal(evilOriginPost.allowed, false);
  assert.equal(evilOriginPost.status, 403);
  assert.equal(evilOriginPost.code, 'CSRF_ORIGIN_REJECTED');

  const crossSiteFetchPost = await invokeCsrf({
    method: 'POST',
    path: '/api/projects',
    headers: { host: 'raone-ai.web.app', 'sec-fetch-site': 'cross-site' },
  });
  assert.equal(crossSiteFetchPost.allowed, false);
  assert.equal(crossSiteFetchPost.status, 403);

  const trustedPost = await invokeCsrf({
    method: 'POST',
    path: '/api/projects',
    headers: { host: 'raone-ai.web.app', origin: 'https://raone-ai.web.app' },
  });
  assert.equal(trustedPost.allowed, true);

  const webhookCrossOrigin = await invokeCsrf({
    method: 'POST',
    path: '/api/billing/webhook',
    headers: { origin: 'https://lemonsqueezy.com', 'sec-fetch-site': 'cross-site' },
  });
  assert.equal(webhookCrossOrigin.allowed, true);

  // 2. Magic-byte verification blocks SVG/HTML masquerading as PNG/MP4/MP3
  const svgAttackBuf = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>', 'utf-8');
  assert.equal(validateBinaryMediaSignature(svgAttackBuf, 'image').ok, false);
  assert.equal(validateBinaryMediaSignature(Buffer.from('<html><script>alert(1)</script></html>'), 'video').ok, false);
  assert.equal(validateBinaryMediaSignature(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image').ok, true);
  assert.equal(validateBinaryMediaSignature(Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00]), 'audio').ok, true);

  const testTenant = `test_svg_${crypto.randomUUID().slice(0, 8)}`;
  try {
    await assert.rejects(
      () =>
        uploadExternalFileToVault({
          tenantId: testTenant,
          filename: 'payload.png',
          mimeType: 'image/png',
          base64Data: svgAttackBuf.toString('base64'),
          geminiClient: null,
        }),
      /blocked|signature/i
    );
  } finally {
    await purgeAllTenantData(testTenant);
  }

  // 3. Plugin header & health path validators block header smuggling and traversal
  assert.equal(validatePluginHeaderName('Authorization').ok, true);
  assert.equal(validatePluginHeaderName('X-Api-Key').ok, true);
  assert.equal(validatePluginHeaderName('Host').ok, false);
  assert.equal(validatePluginHeaderName('Cookie').ok, false);
  assert.equal(validatePluginHeaderName('X-Bad\r\nInjected').ok, false);

  assert.equal(validatePluginHealthPath('/v1/health').ok, true);
  assert.equal(validatePluginHealthPath('/../../etc/passwd').ok, false);
  assert.equal(validatePluginHealthPath('@169.254.169.254').ok, false);

  // 4. Media download validator blocks private/internal SSRF targets
  assert.equal((await validatePublicHttpsMediaDownloadUrl('http://fal.media/clip.mp4')).ok, false);
  assert.equal((await validatePublicHttpsMediaDownloadUrl('https://169.254.169.254/latest/meta-data')).ok, false);
  assert.equal((await validatePublicHttpsMediaDownloadUrl('https://metadata.google.internal/computeMetadata')).ok, false);

  // 5. HTML escaping and Vision Share HTML sanitization block javascript: & script attributes
  assert.equal(escapeHtml(`"a'b\`<c>`), '&quot;a&#39;b&#96;&lt;c&gt;');
  const maliciousVisionHtml = buildPublishedVisionHtml({
    shareId: 'vis_xss_1',
    tenantId: 't1',
    imageId: 'img1',
    title: `Evil' onclick="alert(1)`,
    prompt: '<script>alert(1)</script>',
    compiledPrompt: '<script>alert(1)</script>',
    negativePrompt: '',
    model: 'Flux',
    style: 'Raw',
    aspectRatio: '1:1',
    resolution: '1K',
    dimensions: '1024x1024',
    seed: 1,
    imageDataUrl: 'javascript:alert(document.domain)',
    publishedAt: new Date().toISOString(),
  });
  assert.equal(maliciousVisionHtml.includes('javascript:alert'), false);
  assert.equal(maliciousVisionHtml.includes('<script>alert'), false);
  assert.ok(maliciousVisionHtml.includes('&#39;'));

  // 6. FAANG SEO + Production Hosting Security Headers contract check
  const indexHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
  assert.ok(indexHtml.includes('"@type": "Organization"'));
  assert.ok(indexHtml.includes('"@type": "WebSite"'));
  assert.ok(indexHtml.includes('"@type": "WebApplication"'));
  assert.ok(indexHtml.includes('hreflang="si"'));

  const firebaseJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase.json'), 'utf-8'));
  const globalHeaders: Array<{ key: string; value: string }> = firebaseJson?.hosting?.headers?.[0]?.headers || [];
  const headerKeys = new Set(globalHeaders.map((h) => h.key));
  for (const reqHeader of [
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Cross-Origin-Opener-Policy',
    'X-Permitted-Cross-Domain-Policies',
    'Content-Security-Policy',
  ]) {
    assert.ok(headerKeys.has(reqHeader), `firebase.json missing production header ${reqHeader}`);
  }
  assert.equal(firebaseJson?.storage?.rules, 'storage.rules');
  assert.ok(fs.existsSync(path.join(process.cwd(), 'storage.rules')));
});

test('Demo Passcode scrypt/timingSafeEqual verification, HMAC token lifecycle, revocation & sandbox isolation', async () => {
  // 1. Scrypt passcode hashing + constant-time verification
  const { saltHex, hashHex } = hashDemoPasscodeScrypt('RaOne-Demo-2026!');
  assert.ok(saltHex.length >= 32);
  assert.ok(hashHex.length >= 128);
  assert.equal(verifyDemoPasscodeScrypt('RaOne-Demo-2026!', saltHex, hashHex), true);
  assert.equal(verifyDemoPasscodeScrypt('Wrong-Passcode-99', saltHex, hashHex), false);
  assert.equal(verifyDemoPasscodeScrypt('', saltHex, hashHex), false);

  // 2. Env passcode constant-time SHA-256 verification
  assert.equal(verifyEnvDemoPasscode('RavanaSecret!88', 'RavanaSecret!88'), true);
  assert.equal(verifyEnvDemoPasscode('RavanaSecret!89', 'RavanaSecret!88'), false);
  assert.equal(verifyEnvDemoPasscode('', 'RavanaSecret!88'), false);

  // 3. Signed Demo Session Token creation, verification, tamper rejection, & revocation
  const issued = createSignedDemoSessionToken({
    uid: 'demo_1234567890abcdef',
    tenantId: 'demo_1234567890abcdef',
    displayName: 'Friend Tester',
    ttlSec: 3600,
  });
  assert.ok(issued.token.startsWith('raone_demo_v1.'));
  const verifiedClaims = verifySignedDemoSessionToken(issued.token, 0);
  assert.ok(verifiedClaims);
  assert.equal(verifiedClaims?.uid, 'demo_1234567890abcdef');
  assert.equal(verifiedClaims?.tenantId, 'demo_1234567890abcdef');

  // Tampered payload/signature rejected
  const tampered = issued.token.slice(0, -4) + 'AAAA';
  assert.equal(verifySignedDemoSessionToken(tampered, 0), null);

  // Revocation timestamp strictly invalidates earlier tokens
  const futureRevokeMs = Date.now() + 60_000;
  assert.equal(verifySignedDemoSessionToken(issued.token, futureRevokeMs), null);

  // Non-demo tenantId or uid pattern rejected even if properly signed
  const invalidUidToken = createSignedDemoSessionToken({
    uid: 'user_realOwnerUid',
    tenantId: 'user_realOwnerUid',
    displayName: 'Attacker',
  });
  assert.equal(verifySignedDemoSessionToken(invalidUidToken.token, 0), null);

  // 4. resolveActorMiddleware authenticates demo token into isolated demo_* tenant,
  //    passes requireVerifiedAuth, and blocks requireFirebaseJwtOnly with 403 DEMO_RESTRICTED_ACTION
  const mockReq: any = {
    baseUrl: '',
    path: '/api/user/plan',
    method: 'GET',
    headers: {
      authorization: `Bearer ${issued.token}`,
    },
    secure: true,
  };
  const cookieHeaders: string[] = [];
  let statusCode = 200;
  let jsonBody: any = null;
  const mockRes: any = {
    append(_k: string, v: string) {
      cookieHeaders.push(v);
    },
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: any) {
      jsonBody = body;
      return this;
    },
  };

  let nextCalled = false;
  await resolveActorMiddleware(mockReq, mockRes, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(mockReq.actor?.tenantId, 'demo_1234567890abcdef');
  assert.equal(mockReq.actor?.isDemo, true);
  assert.equal(mockReq.actor?.authSource, 'demo_passcode');
  assert.ok(cookieHeaders.some((c) => c.includes('__session=') && c.includes('SameSite=None') && c.includes('Partitioned')));

  let verifiedAllowed = false;
  requireVerifiedAuth(mockReq, mockRes, () => {
    verifiedAllowed = true;
  });
  assert.equal(verifiedAllowed, true);

  let jwtOnlyAllowed = false;
  requireFirebaseJwtOnly(mockReq, mockRes, () => {
    jwtOnlyAllowed = true;
  });
  assert.equal(jwtOnlyAllowed, false);
  assert.equal(statusCode, 403);
  assert.equal(jsonBody?.code, 'DEMO_RESTRICTED_ACTION');

  // 5. Prototype pollution key sanitizer & admin allowlist check
  const rawAttack = JSON.parse(
    '{"safe":"ok","__proto__":{"polluted":"yes"},"nested":{"constructor":{"prototype":{"evil":1}},"keep":42}}'
  );
  const sanitized = sanitizePrototypeKeysDeep(rawAttack) as any;
  assert.equal(sanitized.safe, 'ok');
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, '__proto__'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized.nested, 'constructor'), false);
  assert.equal(sanitized.nested.keep, 42);
  assert.equal(({} as any).polluted, undefined);

  assert.equal(isAdminEmail('ai5.plaasssilva@gmail.com'), true);
  assert.equal(isAdminEmail('random.attacker@evil.com'), false);
});


