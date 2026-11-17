# RaOne AI — Cloud-Native Production Architecture Guide (Phase 1)

This document describes the upgraded cloud-native SaaS architecture for **RaOne AI**, prepared under **Architecture B: Firebase Hosting + Dedicated Google Cloud Run (`asia-southeast1`) + Cloud Firestore + Google Cloud Storage + Firebase Authentication**.

> **Scope Note (Phase 1):** This document and all code upgrades prepare the repository cleanly for production deployment while preserving local development workflows. Production deployment, GCP resource provisioning, and IAM bindings occur separately in Phase 2.

---

## 1. Final Production Architecture (`Architecture B`)

```text
USER BROWSER (https://raoneai.web.app or custom domain)
    │
    ├── Static SPA & Assets (dist/) ───────────────► Firebase Hosting CDN (raoneai)
    │
    └── /api/** (Relative same-origin requests) ───► Firebase Hosting Rewrite
                                                           │
                                                           ▼
                                            Dedicated Google Cloud Run
                                            Service: raone-ai-backend
                                            Region:  asia-southeast1
                                            Port:    8080 (Node.js 22 + Express + FFmpeg)
                                                           │
         ┌──────────────────────┬──────────────────────────┼─────────────────────────┐
         ▼                      ▼                          ▼                         ▼
   Firebase Admin SDK     Cloud Firestore        Google Cloud Storage        External AI Gateways
   (Auth Token Verify)   (Structured State)       (Private Media Bucket)    (Gemini / Groq / BYOK)
         │                      │                          │
         └────────────── Application Default Credentials (ADC) ─────────────┘
                         + Google Cloud Secret Manager
```

### Key Architectural Principles
- **Single-Origin Entry Point**: Browser traffic hits `https://raoneai.web.app` (or `https://raoneai.firebaseapp.com`, or any custom domain mapped to Firebase Hosting). Frontend API calls use relative `/api/...` paths routed seamlessly to `raone-ai-backend` via Firebase Hosting rewrites.
- **Stateless Compute**: Cloud Run instances share zero in-memory user state or container-local disk across requests or scaling events.
- **Separation of Structured State & Binary Media**:
  - **Cloud Firestore** stores structured JSON metadata, tenant records, settings, encrypted BYOK/Plugin vaults, chat histories, studio project metadata, credit ledgers, and media index metadata.
  - **Google Cloud Storage (`GCS_BUCKET_NAME`)** stores permanent binary media assets (Vision images, Cinema MP4s/posters, Music MP3/WAV/stems, Document files/audio overviews).

---

## 2. Local Development Mode (`STORAGE_BACKEND=local`)

Local development works out of the box without a Google Cloud billing account or production service account credentials:

1. Set `STORAGE_BACKEND=local` (the default when `K_SERVICE` is unset and `STORAGE_BACKEND` is empty or `local`).
2. Structured collections persist atomically under `./data/tenants/<tenantId>/<collection>.json` and `./data/shared/<collection>.json`.
3. Binary media assets persist under `./data/tenants/<tenantId>/<studio_assets>/`.
4. Optional **Firebase Local Emulator Suite** support is built in via `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, and `STORAGE_EMULATOR_HOST`.

---

## 3. Cloud Persistence Mode (`STORAGE_BACKEND=cloud`)

In Cloud Run (detected via `K_SERVICE`) or when `STORAGE_BACKEND=cloud`:

- `LocalStructuredPersistenceProvider` and `LocalMediaStorageProvider` are **disabled**.
- **Strict No-Silent-Fallback Policy**: If Firestore initialization fails, `GCS_BUCKET_NAME` is missing, or a cloud read/write/upload fails, `server_cloud_persistence.ts` raises a structured `CloudPersistenceError` and returns an observable HTTP `5xx` API error (`request_id` included) instead of silently writing to ephemeral container disk.
- Startup validation (`validateCloudConfig()`) logs exact missing configuration without crashing `/api/health` diagnostics or leaking secrets.

---

## 4. Firebase Admin SDK Initialization

Implemented in `/server_cloud_persistence.ts`:

1. **Production (Cloud Run)**: Automatically uses **Application Default Credentials (ADC)** bound to the Cloud Run runtime Service Account (`initializeApp({ credential: applicationDefault(), projectId })`). Zero embedded private key JSON files in the container image.
2. **Local Cloud Testing**: Supports `GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json` or optional inline `FIREBASE_SERVICE_ACCOUNT_JSON`.
3. **Firebase Emulators**: Auto-detects `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST` / `STORAGE_EMULATOR_HOST` when running locally without `K_SERVICE`.
4. Project ID resolves from `FIREBASE_PROJECT_ID` → `VITE_FIREBASE_PROJECT_ID` → `GOOGLE_CLOUD_PROJECT` → `GCLOUD_PROJECT` → `raoneai`.

---

## 5. Firestore Data Model

Firestore uses `ignoreUndefinedProperties: true`, `FieldValue.serverTimestamp()` (`_updatedAt`), `_schemaVersion: 1`, and atomic `runTransaction` updates.

### Tenant-Isolated Collections (`/tenants/{tenantId}/...`)

| Logical Path | Purpose |
| :--- | :--- |
| `tenants/{tenantId}/state/settings` | User & Universal Settings Center preferences |
| `tenants/{tenantId}/state/byok_keys` | AES-256-GCM (`v1:...`) encrypted per-tenant API keys |
| `tenants/{tenantId}/state/plan` | Subscription plan & monthly allowance metadata |
| `tenants/{tenantId}/state/plugins_vault` | Encrypted plugin OAuth/API credentials |
| `tenants/{tenantId}/state/plugins_custom` | Custom plugin definitions |
| `tenants/{tenantId}/state/library_meta` | Files Library overrides (custom titles, tags, favorites, trash timestamps) |
| `tenants/{tenantId}/chats/{chatId}` | Chat sessions & conversation histories (from `conversations`) |
| `tenants/{tenantId}/projects/{projectId}` | Organized chat workspace projects |
| `tenants/{tenantId}/studios/{studioId}` | Code Studio multi-file apps & build versions (from `studio_apps`) |
| `tenants/{tenantId}/studio_prompts/{id}` | Saved Studio prompt presets |
| `tenants/{tenantId}/vision_images/{id}` | Vision Studio render metadata & edit lineages |
| `tenants/{tenantId}/motion_videos/{id}` | Cinema Studio video generation & FFmpeg job metadata |
| `tenants/{tenantId}/audio_tracks/{id}` | Music Studio track, stem, & mastering metadata |
| `tenants/{tenantId}/documents/{id}` | Document Studio rich documents, slide specs & audio overviews |
| `tenants/{tenantId}/library_folders/{id}` | Files Library folder organization |
| `tenants/{tenantId}/voice_clones/{id}` | Voice profile metadata |
| `tenants/{tenantId}/files/{fileId}` | Unified `MediaObjectMetadata` records (`fileId`, `tenantId`, `originalName`, `objectPath`, `mimeType`, `size`, `category`, `createdAt`, `updatedAt`, `status`, `storageProvider`, `checksum`) |
| `tenants/{tenantId}/credit_ledger/{entryId}` | Atomic append-only credit grant/reserve/refund ledger |

### Platform Shared Collections (`/shared/{collectionName}/entries/{key}`)
- `shared/published_vision/entries/{shareId}`
- `shared/published_studios/entries/{shareId}`
- Plus legacy `__public__` tenant snapshots for Cinema/Music/Document public share links.

### Client-Side Firestore Security Rules (`/firestore.rules`)
- `/tenants/**` and `/shared/**` explicitly deny all client SDK reads/writes (`allow read, write: if false;`) — accessed exclusively through the authenticated Cloud Run backend via Firebase Admin SDK.

---

## 6. Google Cloud Storage Object Structure

All permanent binary objects live in a **private** GCS bucket (`GCS_BUCKET_NAME`) using deterministic tenant-scoped prefixes and sanitized filenames:

```text
gs://<GCS_BUCKET_NAME>/
  tenants/
    {tenantId}/
      vision/{assetFilename}       # PNG / JPG / WEBP renders & edits
      cinema/{assetFilename}       # MP4 clips & JPG posters
      music/{assetFilename}        # MP3 / WAV tracks, stems, & album covers
      documents/{assetFilename}    # .md archival sources, .mp3 audio overviews, exports
      library/{assetFilename}      # Vault assets
```

### Security, Integrity & Streaming
- **Private Bucket**: Uniform Bucket-Level Access enabled; `allUsers` / `allAuthenticatedUsers` NEVER granted read permissions.
- **Streaming & Byte-Range (`HTTP 206`)**: `GcsMediaStorageProvider.streamHttpResponse` supports seekable byte-range streaming for Cinema `<video>` and Music `<audio>` playback without buffering large media payloads into Cloud Run RAM.
- **Large File Materialization**: FFmpeg pipelines (`server.ts`, `server_cinema_engine.ts`, `server_music_engine.ts`) use `withTempWorkingDir` in `/tmp` to stream inputs from GCS, process with FFmpeg, stream outputs back into GCS via `saveFromFile`, and always delete `/tmp` scratch directories in `finally`.
- **Upload Guardrails**: Enforces category MIME prefix validation and `MAX_MEDIA_UPLOAD_BYTES` (default 250 MB) + SHA-256 checksum computation.
- **Short-Lived Signed URLs**: `getSignedDownloadUrl` supports optional bounded V4 signed URLs (60s–900s), while browser UI uses authenticated first-party proxy endpoints protected by Bearer JWT or HMAC-signed `HttpOnly` `__session` cookies.

---

## 7. Complete Environment Variables Reference

See `/.env.example` for the authoritative template.

### Backend Variables (Cloud Run Runtime + Secret Manager)
| Variable | Required in Prod | Default / Example | Description |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Yes | `production` | Enables strict production security & structured JSON logs |
| `PORT` | Auto | `8080` | Cloud Run injected listening port (local default `3000`) |
| `STORAGE_BACKEND` | Yes | `cloud` (`local` locally) | Persistence mode (`local` or `cloud`) |
| `GCS_BUCKET_NAME` | Yes (`cloud`) | `raoneai-media-prod` | Private GCS bucket name (never hardcoded) |
| `FIREBASE_PROJECT_ID` | Yes | `raoneai` | Firebase & GCP Project ID |
| `REQUIRE_FIREBASE_AUTH` | Yes | `true` | Enforces Firebase JWT auth on protected `/api/**` routes |
| `ALLOWED_ORIGINS` | Yes | `https://raoneai.web.app,https://raoneai.firebaseapp.com` | Explicit CORS & origin allowlist (add custom domains here) |
| `TENANT_ENCRYPTION_SECRET` | Yes (Secret) | *(32+ byte secret)* | AES-256-GCM BYOK/Plugin key derivation + media cookie HMAC. **Do not rotate without migrating existing encrypted rows.** |
| `GEMINI_API_KEY` | Yes (Secret) | *(Secret Manager)* | Server-side Google Gemini API key |
| `GROQ_API_KEY` | Optional | *(Secret Manager)* | Groq inference fallback key |
| `COMET_API_KEY` | Optional | *(Secret Manager)* | All-in-one gateway key |
| `COMET_API_BASE_URL` | Optional | `https://api.cometapi.com/v1` | CometAPI gateway endpoint |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `DEEPSEEK_API_KEY` / `XAI_API_KEY` | Optional | *(Secret Manager)* | Optional provider keys |
| `ALLOW_LOCAL_LLM_LOOPBACK` | No | `false` in prod | Blocks loopback local LLM access on Cloud Run |
| `ALLOW_LOCAL_LLM_PROCESS` | No | `false` | Disables spawning local `llama-server` on Cloud Run |
| `MAX_MEDIA_UPLOAD_BYTES` | No | `262144000` (250 MB) | Upper bound on single binary upload size |

### Frontend Build-Time Public Variables (`VITE_*`)
> **NEVER** place private API keys (`GEMINI_API_KEY`, `TENANT_ENCRYPTION_SECRET`, etc.) in `VITE_*` variables.

- `VITE_API_BASE_URL`: Leave **empty** in production so requests resolve to relative `/api/...` through Firebase Hosting rewrites. Set only when intentionally targeting an external backend origin.
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID`.

---

## 8. Firebase Hosting Rewrite & SPA Routing Configuration

Configured in `/firebase.json`:

```json
"rewrites": [
  {
    "source": "/api/**",
    "run": {
      "serviceId": "raone-ai-backend",
      "region": "asia-southeast1"
    }
  },
  {
    "source": "**",
    "destination": "/index.html"
  }
]
```

- `/api/**` appears **first** so API calls, SSE streams, and media streaming endpoints route to Dedicated Cloud Run (`raone-ai-backend` in `asia-southeast1`).
- `**` routes SPA client-side paths to `/index.html`.
- `/assets/**` retains `Cache-Control: public, max-age=31536000, immutable` and security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`).

---

## 9. Cloud Run Runtime Configuration (`/Dockerfile`)

- Base image: `node:22-slim` with `ffmpeg` and `ca-certificates` preinstalled.
- Executes Vite production frontend build (`npm run build` → `dist/`) and runs `node server.ts` on `PORT=8080` as non-root `node` user.
- **Recommended Cloud Run sizing for FFmpeg + Veo + Lyria workloads**:
  - CPU: `2 vCPU` (minimum `1 vCPU`)
  - Memory: `2 GiB` – `4 GiB` (FFmpeg 60fps/upscaling buffers in `/tmp` RAM-backed tmpfs; clean up immediately after upload)
  - Request Timeout: `300s` (for long video/audio generation & SSE streams)
  - Concurrency: `40`–`80`
  - Graceful Shutdown: Server listens for `SIGTERM`/`SIGINT` (`server.ts`) and drains HTTP connections cleanly.

---

## 10. Least-Privilege IAM Permissions (Phase 2 Preparation)

Create a dedicated Cloud Run runtime service account (e.g., `raone-backend-sa@raoneai.iam.gserviceaccount.com`). **Do NOT grant `roles/owner` or `roles/editor`.**

| Resource / Purpose | IAM Role | Scope |
| :--- | :--- | :--- |
| Cloud Firestore read/write/transactions | `roles/datastore.user` | Project `raoneai` |
| Google Cloud Storage media bucket read/write/delete | `roles/storage.objectUser` | Bucket `gs://<GCS_BUCKET_NAME>` |
| Secret Manager secret retrieval | `roles/secretmanager.secretAccessor` | Individual secrets only |
| Structured Cloud Logging | `roles/logging.logWriter` | Project `raoneai` |
| Optional GCS V4 signed URL signing (`signBlob` if used) | `roles/iam.serviceAccountTokenCreator` | Self service account only |

*(Note: Firebase Admin `verifyIdToken()` uses Google's public JWKS certificates and requires no extra IAM permission on the service account unless `checkRevoked` or User Management APIs are invoked.)*

---

## 11. Secret Manager Requirements

Store sensitive secrets in Google Cloud Secret Manager and mount them as environment variables on `raone-ai-backend`:
- `TENANT_ENCRYPTION_SECRET` *(CRITICAL: generate once with `openssl rand -hex 32` and NEVER change after tenants save BYOK/Plugin keys without running a key-rotation re-encryption script)*
- `GEMINI_API_KEY`
- Optional: `GROQ_API_KEY`, `COMET_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `XAI_API_KEY`

---

## 12. Firebase Authentication Setup

1. Ensure Sign-in providers (Google, Email/Password, etc.) are enabled in Firebase Console for `raoneai`.
2. Add authorized domains in **Firebase Console → Authentication → Settings → Authorized domains**:
   - `raoneai.web.app`
   - `raoneai.firebaseapp.com`
   - `localhost` (dev)
   - Any production custom domains.
3. Because Firebase Hosting proxies `/api/**` on the same origin (`https://raoneai.web.app/api/...`), `POST`/`GET` requests with Firebase `Authorization: Bearer <ID_TOKEN>` transparently mint/refresh the first-party signed `HttpOnly` `__session` cookie (`SameSite=Lax; Secure`), allowing `<img src="/api/vision/assets/...">`, `<video src="/api/motion/assets/...">`, and `<audio src="/api/audio/assets/...">` to remain authenticated cleanly across tenant boundaries.

---

## 13. Custom Domain Compatibility

- `/src/utils/api.ts` resolves `/api/...` as relative paths whenever `VITE_API_BASE_URL` is unset, automatically supporting `raoneai.web.app`, `raoneai.firebaseapp.com`, preview channels, and any custom domain attached to Firebase Hosting without rebuilding code.
- Simply append custom domain origin(s) (e.g., `,https://app.yourdomain.com`) to the `ALLOWED_ORIGINS` Cloud Run env var and Firebase Authorized Domains.

---

## 14. Local-to-Cloud Migration & Troubleshooting

### Non-Destructive Tenant Migration Helper
`migrateLocalTenantToCloud(tenantId, { dryRun })` in `/server_cloud_persistence.ts`:
- Reads local JSON collections & studio binary assets from `./data/tenants/<tenantId>/`.
- Copies structured data to Firestore and streams binary files to GCS.
- Verifies uploaded GCS object existence (`existsInGcs`) before incrementing `filesVerified`.
- **Never deletes local files** (`localFilesPreserved: true`).

### Common Troubleshooting
- **`CLOUD_MEDIA_MISCONFIGURED` / 500 error in production**: Verify `STORAGE_BACKEND=cloud` and `GCS_BUCKET_NAME` are both set on Cloud Run.
- **`TOKEN_VERIFICATION_FAILED` (401)**: Confirm `FIREBASE_PROJECT_ID=raoneai` matches the frontend `VITE_FIREBASE_PROJECT_ID` and system clock is synchronized.
- **`FIRESTORE_READ_FAILED` / Permission Denied**: Ensure the Cloud Run runtime service account has `roles/datastore.user` and the Firestore `(default)` database exists in Native mode.
- **CORS blocked on custom domain**: Add the exact `https://...` origin to `ALLOWED_ORIGINS` on Cloud Run.

---

## 15. Testing & Verification Commands

```bash
# Run automated security, studio, local persistence, mocked Firestore/GCS & routing tests
npm test

# TypeScript static typecheck
npm run lint

# Vite production frontend bundle check
npm run build
```
