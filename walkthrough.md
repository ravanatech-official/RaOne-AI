# Security Summary

RaOne AI enforces multi-layered security across authentication, tenant isolation, server egress, media ingestion, browser framing, and cloud rules:

- **Identity & Access Control**: All protected API calls verify RS256 Firebase JWT tokens server-side and derive a server-authoritative `tenantId` (`user_${uid}`), preventing horizontal impersonation. Signed `HttpOnly`, `SameSite=Lax` `__session` cookies scope native media streaming strictly to the authenticated user's tenant.
- **Cross-Site & Origin Protection**: Express CORS uses a strict allowlist (never reflecting untrusted origins with credentials), reinforced by CSRF Origin and `Sec-Fetch-Site` enforcement on state-changing `/api/*` requests (while preserving HMAC-SHA256 verified billing webhooks).
- **Database & Storage Isolation**: Client SDK access to `/users/{userId}` requires UID ownership, email-verification for mutations, token-bound email validation, trimmed non-empty field checks, strict allowlisted keys, and server-timestamp enforcement. Backend collections (`/tenants/**`, `/shared/**`, `/audit_logs/**`, `/rate_limits/**`, `/billing/**`, `/webhooks/**`) and all direct Firebase Cloud Storage paths (`storage.rules`) deny client SDK access completely.
- **Outbound Network & Redirect Defense**: Custom provider gateways, plugin probes, media asset downloads, GitHub deploys, and local endpoints validate clean `HTTPS` (or explicitly authorized local loopback), resolve DNS prior to requests to block private/reserved/metadata IPs, and set `redirect: 'error'` so validated URLs cannot be bounced into internal endpoints.
- **Secret Protection & Sandboxing**: Personal provider keys (BYOK) and plugin secrets are encrypted at rest with AES-256-GCM and masked before reaching the client. Published HTML/Code Studio previews run inside isolated CSP sandboxes, and binary media uploads verify file magic bytes while rejecting SVG/HTML/script payloads.

## Issues Resolved

| Category | Resolution | Status |
| :--- | :--- | :--- |
| Outbound Redirect & Host Matching | Enforced `redirect: 'error'` on outbound plugin and media fetches, replaced substring webhook domain matching with exact suffix matching, and constrained custom plugin `authHeaderName` and `healthPath` formats. | Verified |
| Cross-Site Mutation Defense | Added `csrfOriginGuard` on mutating `/api/*` routes blocking untrusted `Origin` and `Sec-Fetch-Site: cross-site` callers while exempting HMAC-signed billing webhooks. | Verified |
| Media Upload Signature Validation | Enforced binary magic-byte inspection (`validateBinaryMediaSignature`) and blocked SVG/HTML/XML masquerading across vault, motion, and audio upload paths, plus extension allowlists. | Verified |
| Share Route & Export Escaping | Replaced incomplete escaping with full HTML attribute/script character escaping (including `'` and `` ` ``), validated image URL schemes in Vision shared snapshots, and applied strict no-script sandbox CSP headers across share endpoints. | Verified |
| Local Path Confinement | Added trailing path-separator canonical `path.resolve` checks in `server_local_llm.ts` and GitHub deploy branch/path traversal guards in `server.ts`. | Verified |
| Browser Messaging & Hosting Headers | Restricted workbench `postMessage` listeners to the preview `contentWindow` and valid origins (`'null'` or same origin), and deployed HSTS preload, `Cross-Origin-Opener-Policy`, `X-Permitted-Cross-Domain-Policies`, and strict CSP headers in `server.ts` and `firebase.json`. | Verified |
| Firebase Database & Storage Rules | Added token-email binding, whitespace-trimmed text checks, system collection deny blocks in `firestore.rules`, and default-deny `storage.rules` backed by `firestore.rules.test.ts`. | Verified |

---

## PoC Verification

### 1. Cross-Site State Mutation Blocked by `csrfOriginGuard`
- **Attack Scenario**: An attacker website submits a credentialed cross-origin `POST /api/user/settings` request hoping the victim's browser session cookie triggers an unauthorized mutation.
- **Trace**: `server.ts` mounts `app.use('/api', csrfOriginGuard)` (`server.ts:357`), which invokes `csrfOriginGuard` (`server_security.ts:736-782`). Because `Origin` (`https://evil-attacker.example`) neither matches `Host` nor passes `isOriginAllowed`, the middleware returns HTTP `403` (`CSRF_ORIGIN_REJECTED`) before any handler or tenant mutation runs. Verified in `tests/security_and_contracts.test.ts`.

### 2. Plugin Egress Redirect & Webhook Domain Spoofing Blocked
- **Attack Scenario**: A malicious actor configures a webhook URL `https://attacker-discord.com/api/webhooks/1` or points a custom plugin to a public HTTPS domain returning a `302` redirect to `http://169.254.169.254/latest/meta-data/`.
- **Trace**:
  1. `server_plugins_engine.ts:2084-2090` and `server_plugins_engine.ts:2324-2329` enforce exact domain/suffix matching (`webhookHost === 'discord.com' || webhookHost.endsWith('.discord.com')`), preventing `attacker-discord.com` spoofing.
  2. `timedFetchJson` (`server_plugins_engine.ts:1623`) and `server_media_providers.ts` (`248`, `531`, `741`) enforce `redirect: 'error'` so any `3xx` hop aborts before following.
  3. `saveCustomPluginDefinition` (`server_plugins_engine.ts:1518-1525`) and `testPluginConnectionServer` (`2245-2258`) validate `healthPath` (`..`/`@` blocked) and `authHeaderName` (`Host`/`Cookie`/CRLF rejected). Verified in `tests/security_and_contracts.test.ts`.

### 3. Disguised SVG/HTML Upload Rejected by Binary Signature Check
- **Attack Scenario**: An attacker uploads `<svg onload="alert(1)"></svg>` labeled with `mimeType: "image/png"` and filename `payload.png`.
- **Trace**: `uploadExternalFileToVault` (`server_library_engine.ts:1113-1140`) and `/api/motion/upload` + `/api/audio/upload` (`server.ts:6724`, `server.ts:7885`) invoke `validateBinaryMediaSignature` (`server_security.ts:809-873`), which scans leading bytes for active markup (`<svg`, `<script`, `<html`) and enforces binary PNG/JPEG/WEBP/MP4/MP3 headers before writing to disk or GCS. Verified in `tests/security_and_contracts.test.ts`.

### 4. Published Share HTML Script & Scheme Injection Neutralized
- **Attack Scenario**: A published Vision snapshot contains a crafted title (`Evil' onclick="alert(1)`) and `imageDataUrl: "javascript:alert(document.domain)"`.
- **Trace**: `buildPublishedVisionHtml` (`server_vision_engine.ts:765-810`) escapes `'`, `"`, `` ` ``, `<`, `>`, `&` and strips any URL not matching `data:image/(png|jpeg|jpg|webp);base64,...`, `/api/vision/assets/...`, or `https://...`, while `/vision/shared/:shareId`, `/api/motion/share/:shareId`, `/api/audio/share/:shareId`, and `/api/documents/share/:shareId` set `Content-Security-Policy: default-src 'none'; ...`. Verified in `tests/security_and_contracts.test.ts`.

### 5. Firestore & Storage Invariant Verification
- **Attack Scenario**: Unverified user updates profile email to hijack another account identifier, or client SDK reads `/tenants/{id}/state` or `/storage` bucket objects directly.
- **Trace**: `firestore.rules` requires `isVerifiedOwner(userId)` for mutations, enforces `request.auth.token.email == null || data.email == request.auth.token.email` (`firestore.rules:53`), trims blank text fields (`isValidNonEmptyText`), locks `/tenants`, `/shared`, `/audit_logs`, `/rate_limits`, `/billing`, `/webhooks` (`if false`), and `storage.rules` denies all direct client SDK reads/writes (`allow read, write: if false`). Verified by `@firebase/eslint-plugin-security-rules` and `firestore.rules.test.ts`.
