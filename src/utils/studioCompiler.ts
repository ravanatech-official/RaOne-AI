export interface StudioAttachmentPayload {
  name: string;
  mimeType: string;
  kind: 'image' | 'text';
  data: string;
}

/**
 * Compiles separate project files (index.html, styles.css, app.js, api_routes.js)
 * into a self-contained runnable HTML document directly in the browser.
 */
export function bundleFilesToHtml(files: Record<string, string | undefined>): string {
  let html = String(files['index.html'] || '').trim();
  const css = String(files['styles.css'] || '').trim();
  const js = String(files['app.js'] || '').trim();
  const apiRoutesJs = String(files['api_routes.js'] || '').trim();

  if (!html) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script><style>${css}</style></head><body class="bg-[#0b0c10] text-white"><div id="app"></div><script>${apiRoutesJs}\n${js}</script></body></html>`;
  }

  html = html.replace(/<link[^>]*href=["'](?:\.\/)?styles\.css["'][^>]*>/gi, '');
  html = html.replace(/<script[^>]*src=["'](?:\.\/)?app\.js["'][^>]*>\s*<\/script>/gi, '');
  html = html.replace(/<script[^>]*src=["'](?:\.\/)?api_routes\.js["'][^>]*>\s*<\/script>/gi, '');

  const combinedJs = [apiRoutesJs, js].filter(Boolean).join('\n\n');

  if (css) {
    const styleTag = `<style>\n${css}\n</style>`;
    if (html.includes('</head>')) {
      html = html.replace('</head>', `${styleTag}\n</head>`);
    } else {
      html = `${styleTag}\n${html}`;
    }
  }

  if (combinedJs) {
    const safeJs = combinedJs.replace(/<\/script>/gi, '<\\/script>');
    const scriptTag = `<script>\n${safeJs}\n</script>`;
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${scriptTag}\n</body>`);
    } else {
      html = `${html}\n${scriptTag}`;
    }
  }

  return html;
}

/**
 * Injects an isolated postMessage runtime telemetry & element inspector bridge
 * into preview srcDoc HTML so JS errors and clicked DOM targets stream back cleanly.
 */
export function injectPreviewTelemetry(html: string, inspectEnabled = false): string {
  if (!html) return html;
  const bridgeScript = `<script data-raone-telemetry="true">
(function() {
  var inspectMode = ${inspectEnabled ? 'true' : 'false'};
  function post(type, payload) {
    try {
      window.parent.postMessage(Object.assign({ source: 'raone-preview', type: type }, payload || {}), '*');
    } catch (e) {}
  }
  window.addEventListener('error', function(e) {
    var msg = (e && e.message) ? e.message : 'Script runtime error';
    if (e && e.lineno) msg += ' (line ' + e.lineno + ')';
    post('runtime_error', { message: msg, lineno: e && e.lineno ? e.lineno : 0 });
  });
  window.addEventListener('unhandledrejection', function(e) {
    var reason = e && e.reason ? (e.reason.message || String(e.reason)) : 'Unhandled promise rejection';
    post('runtime_error', { message: 'Promise rejection: ' + reason });
  });
  var origError = console.error;
  console.error = function() {
    try {
      var args = Array.prototype.slice.call(arguments).map(function(a) {
        return typeof a === 'object' ? JSON.stringify(a) : String(a);
      }).join(' ');
      if (args) post('console_error', { message: args.slice(0, 400) });
    } catch (e) {}
    return origError.apply(console, arguments);
  };
  var highlightBox = null;
  function clearHighlight() {
    if (highlightBox && highlightBox.parentNode) highlightBox.parentNode.removeChild(highlightBox);
    highlightBox = null;
  }
  window.addEventListener('message', function(ev) {
    if (ev && ev.data && ev.data.type === 'raone-toggle-inspect') {
      inspectMode = Boolean(ev.data.enabled);
      if (!inspectMode) clearHighlight();
    }
  });
  document.addEventListener('mouseover', function(e) {
    if (!inspectMode || !e.target || e.target === document.body || e.target === document.documentElement) return;
    try {
      var rect = e.target.getBoundingClientRect();
      if (!highlightBox) {
        highlightBox = document.createElement('div');
        highlightBox.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #8AB4F8;background:rgba(138,180,248,0.12);border-radius:4px;transition:all 60ms ease;';
        document.body.appendChild(highlightBox);
      }
      highlightBox.style.left = rect.left + 'px';
      highlightBox.style.top = rect.top + 'px';
      highlightBox.style.width = rect.width + 'px';
      highlightBox.style.height = rect.height + 'px';
    } catch (err) {}
  }, true);
  document.addEventListener('click', function(e) {
    if (!inspectMode || !e.target) return;
    e.preventDefault();
    e.stopPropagation();
    var el = e.target;
    var tag = (el.tagName || 'div').toLowerCase();
    var idPart = el.id ? ('#' + el.id) : '';
    var cls = typeof el.className === 'string' && el.className.trim()
      ? ('.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.'))
      : '';
    var text = (el.innerText || el.value || '').trim().replace(/\\s+/g, ' ').slice(0, 60);
    post('element_selected', {
      selector: tag + idPart + cls,
      tagName: tag,
      textSnippet: text
    });
  }, true);
  window.addEventListener('DOMContentLoaded', function() {
    post('ready', { title: document.title || 'Preview' });
  });
})();
</script>`;

  if (html.includes('</head>')) {
    return html.replace('</head>', `${bridgeScript}\n</head>`);
  }
  if (html.includes('<body')) {
    return html.replace(/<body([^>]*)>/i, `<body$1>\n${bridgeScript}`);
  }
  return `${bridgeScript}\n${html}`;
}

export function buildLocalDirectStudioPrompt(opts: {
  prompt: string;
  mode: string;
  existingCode?: string;
  selectedElementContext?: string;
  attachments?: StudioAttachmentPayload[];
}): string {
  const attachText = (opts.attachments || [])
    .filter((a) => a.kind === 'text' && a.data)
    .map((a) => `--- FILE: ${a.name} ---\n${a.data.slice(0, 8000)}`)
    .join('\n\n');

  if (opts.existingCode) {
    return `You are refining an existing web application in ${opts.mode}.
${opts.selectedElementContext ? `Selected UI element: ${opts.selectedElementContext}\n` : ''}
${attachText ? `${attachText}\n\n` : ''}EXISTING CODE:
\`\`\`html
${opts.existingCode.slice(0, 24000)}
\`\`\`

INSTRUCTION:
"${opts.prompt}"

Output ONLY the complete updated HTML document starting with <!DOCTYPE html>. Keep all working features and add working JS handlers.`;
  }

  return `You are RaOne Code Studio running on Local llama.cpp.
Build a complete interactive web application (${opts.mode}) for:
"${opts.prompt}"
${attachText ? `\nATTACHED SPECS:\n${attachText}` : ''}

REQUIREMENTS:
1. Output ONLY a valid single HTML document starting with <!DOCTYPE html>. No markdown explanation outside HTML.
2. Include Tailwind CSS via https://cdn.tailwindcss.com and Google Fonts (Plus Jakarta Sans, JetBrains Mono).
3. Include real JavaScript interactivity and localStorage persistence with zero dead buttons.`;
}

// =========================================================================
// Zero-Dependency CRC32 Multi-File ZIP Exporter (Browser-Native)
// =========================================================================
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function createProjectZipBlob(
  projectTitle: string,
  files: Record<string, string | undefined>
): Blob {
  const encoder = new TextEncoder();
  const entries = Object.entries(files)
    .filter(([, content]) => typeof content === 'string' && content.length > 0)
    .map(([name, content]) => ({
      nameBytes: encoder.encode(name),
      dataBytes: encoder.encode(content as string),
    }));

  if (!files['README.md']) {
    const readme = `# ${projectTitle}\n\nGenerated by RaOne Code Studio.\nOpen index.html in any modern browser or serve statically.\n`;
    entries.push({
      nameBytes: encoder.encode('README.md'),
      dataBytes: encoder.encode(readme),
    });
  }

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const crc = crc32(entry.dataBytes);
    const size = entry.dataBytes.length;

    const localHeader = new Uint8Array(30 + entry.nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8
    lv.setUint16(8, 0, true); // store (uncompressed)
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, entry.nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(entry.nameBytes, 30);

    localParts.push(localHeader, entry.dataBytes);

    const centralHeader = new Uint8Array(46 + entry.nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, entry.nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(entry.nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + size;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const blobParts: BlobPart[] = [...localParts, ...centralParts, eocd].map(
    (u8) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
  );
  return new Blob(blobParts, { type: 'application/zip' });
}
