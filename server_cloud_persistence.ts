import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import type { Request, Response } from 'express';
import {
  initializeApp,
  getApps,
  applicationDefault,
  cert,
  type App,
} from 'firebase-admin/app';
import {
  getFirestore,
  FieldValue,
  type Firestore,
} from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { Storage, type Bucket } from '@google-cloud/storage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const LOCAL_DATA_ROOT = path.join(__dirname, 'data', 'tenants');
export const LOCAL_SHARED_ROOT = path.join(__dirname, 'data', 'shared');

export type StorageBackendMode = 'local' | 'cloud';
export type MediaCategory = 'vision' | 'cinema' | 'music' | 'documents' | 'library';

export type ServiceReadinessState =
  | 'configured'
  | 'available'
  | 'unavailable'
  | 'not_configured'
  | 'degraded';

export interface MediaObjectMetadata {
  fileId: string;
  tenantId: string;
  originalName: string;
  objectPath: string;
  mimeType: string;
  size: number;
  category: MediaCategory;
  createdAt: string;
  updatedAt: string;
  status: 'ready' | 'deleted';
  storageProvider: StorageBackendMode;
  checksum?: string;
}

export interface PaginatedCollectionResult<T> {
  items: T[];
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CloudPersistenceHealthStatus {
  storageBackend: StorageBackendMode;
  firebaseProjectId: string;
  gcsBucketConfigured: boolean;
  firebaseAdmin: ServiceReadinessState;
  firestore: ServiceReadinessState;
  gcs: ServiceReadinessState;
  emulatorMode: {
    firestore: boolean;
    auth: boolean;
    storage: boolean;
  };
  lastCheckedAt: string;
  errorSummary?: string;
}

export class CloudPersistenceError extends Error {
  readonly code: string;
  readonly causeError?: unknown;
  readonly retryable: boolean;

  constructor(code: string, message: string, opts?: { cause?: unknown; retryable?: boolean }) {
    super(message);
    this.name = 'CloudPersistenceError';
    this.code = code;
    this.causeError = opts?.cause;
    this.retryable = Boolean(opts?.retryable);
  }
}

export function sanitizeTenantId(tenantId: string): string {
  const cleaned = String(tenantId || 'guest_workspace')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 96);
  return cleaned || 'guest_workspace';
}

export function normalizeSafeAssetFilename(filename: string): string | null {
  const raw = String(filename || '').trim();
  if (!raw) return null;
  const clean = path.basename(raw);
  if (
    clean !== raw &&
    raw.includes('..')
  ) {
    return null;
  }
  if (!clean || clean === '.' || clean === '..' || !/^[a-zA-Z0-9._-]{2,160}$/.test(clean)) {
    return null;
  }
  return clean;
}

interface FirebaseAppletConfig {
  projectId?: string;
  firestoreDatabaseId?: string;
}

let cachedAppletConfig: FirebaseAppletConfig | null | undefined;

function readFirebaseAppletConfig(): FirebaseAppletConfig | null {
  if (cachedAppletConfig !== undefined) return cachedAppletConfig;
  try {
    const cfgPath = path.join(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      cachedAppletConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as FirebaseAppletConfig;
      return cachedAppletConfig;
    }
  } catch {
    // ignore invalid or missing applet config
  }
  cachedAppletConfig = null;
  return null;
}

export function getFirebaseProjectIdFromEnv(): string {
  const appletCfg = readFirebaseAppletConfig();
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    appletCfg?.projectId ||
    'ravanatek'
  ).trim();
}

export function getFirestoreDatabaseIdFromConfig(): string {
  const appletCfg = readFirebaseAppletConfig();
  return (
    process.env.FIRESTORE_DATABASE_ID ||
    appletCfg?.firestoreDatabaseId ||
    ''
  ).trim();
}

export function isCloudRunEnvironment(): boolean {
  return Boolean(process.env.K_SERVICE || process.env.CLOUD_RUN_JOB || process.env.FUNCTION_TARGET);
}

export function getStorageBackendMode(): StorageBackendMode {
  const raw = String(process.env.STORAGE_BACKEND || '').trim().toLowerCase();
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      return 'cloud';
    }
    return 'local';
  }
  if (raw === 'cloud' || raw === 'local') {
    return raw;
  }
  throw new CloudPersistenceError(
    'INVALID_STORAGE_BACKEND',
    `Unsupported STORAGE_BACKEND "${raw}". Expected "local" or "cloud".`
  );
}

export function getGcsBucketName(): string {
  return (
    process.env.GCS_BUCKET_NAME ||
    process.env.VITE_FIREBASE_STORAGE_BUCKET ||
    ''
  ).trim();
}

export function validateCloudConfig(): { ok: boolean; errors: string[]; mode: StorageBackendMode } {
  const mode = getStorageBackendMode();
  if (mode === 'local') {
    return { ok: true, errors: [], mode };
  }
  const errors: string[] = [];
  if (!getFirebaseProjectIdFromEnv()) {
    errors.push('FIREBASE_PROJECT_ID must be set when STORAGE_BACKEND=cloud.');
  }
  if (!getGcsBucketName()) {
    errors.push('GCS_BUCKET_NAME must be set when STORAGE_BACKEND=cloud.');
  }
  return { ok: errors.length === 0, errors, mode };
}

// =========================================================================
// Structured Logging Helper (Safe — Never Logs Secrets/Payloads)
// =========================================================================
export function logCloudEvent(
  level: 'info' | 'warn' | 'error',
  event: string,
  meta?: Record<string, unknown>
): void {
  const entry = {
    ts: new Date().toISOString(),
    component: 'raone_persistence',
    level,
    event,
    ...(meta || {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else if (process.env.NODE_ENV === 'production') console.log(line);
}

async function withTransientRetry<T>(
  operationName: string,
  fn: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const code = String(err?.code || '');
      const status = Number(err?.status || err?.code || 0);
      const isTransient =
        status === 429 ||
        status === 503 ||
        status === 500 ||
        code === 'ECONNRESET' ||
        code === 'ETIMEDOUT' ||
        code === 'EAI_AGAIN' ||
        code === 'ABORTED' ||
        code === 'UNAVAILABLE' ||
        code === 'DEADLINE_EXCEEDED';

      if (!isTransient || attempt >= maxAttempts) {
        throw err;
      }
      const backoffMs = Math.min(2000, 120 * Math.pow(2, attempt - 1));
      logCloudEvent('warn', 'transient_retry', {
        operation: operationName,
        attempt,
        backoffMs,
        code: code || String(status),
      });
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw lastErr;
}

// =========================================================================
// Firebase Admin SDK & GCS Client Initialization (ADC / Emulator Aware)
// =========================================================================
let cachedAdminApp: App | null = null;
let cachedFirestore: Firestore | null = null;
let cachedAdminAuth: Auth | null = null;
let cachedStorageClient: Storage | null = null;

function parseOptionalServiceAccountFromEnv(): Record<string, any> | null {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.private_key === 'string' && typeof parsed.client_email === 'string') {
      return parsed;
    }
    return null;
  } catch {
    throw new CloudPersistenceError(
      'INVALID_SERVICE_ACCOUNT_JSON',
      'FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid service account JSON.'
    );
  }
}

export function getFirebaseAdminApp(): App {
  if (cachedAdminApp) return cachedAdminApp;
  const existing = getApps();
  if (existing.length > 0) {
    cachedAdminApp = existing[0];
    return cachedAdminApp;
  }

  const projectId = getFirebaseProjectIdFromEnv();
  const hasEmulator = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST
  );
  const inlineSa = parseOptionalServiceAccountFromEnv();

  if (inlineSa) {
    cachedAdminApp = initializeApp({
      credential: cert(inlineSa),
      projectId: inlineSa.project_id || projectId,
    });
  } else if (hasEmulator && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !isCloudRunEnvironment()) {
    cachedAdminApp = initializeApp({ projectId });
  } else {
    cachedAdminApp = initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }

  return cachedAdminApp;
}

export function getFirestoreDb(): Firestore {
  if (cachedFirestore) return cachedFirestore;
  const app = getFirebaseAdminApp();
  const databaseId = getFirestoreDatabaseIdFromConfig();
  const db =
    databaseId && databaseId !== '(default)'
      ? getFirestore(app, databaseId)
      : getFirestore(app);
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // ignore if settings already applied
  }
  cachedFirestore = db;
  return cachedFirestore;
}

export function getFirebaseAdminAuth(): Auth {
  if (cachedAdminAuth) return cachedAdminAuth;
  cachedAdminAuth = getAuth(getFirebaseAdminApp());
  return cachedAdminAuth;
}

function getGcsBucket(): Bucket {
  const bucketName = getGcsBucketName();
  if (!bucketName) {
    throw new CloudPersistenceError(
      'GCS_BUCKET_NOT_CONFIGURED',
      'GCS_BUCKET_NAME environment variable is required when STORAGE_BACKEND=cloud.'
    );
  }
  if (!cachedStorageClient) {
    const inlineSa = parseOptionalServiceAccountFromEnv();
    const projectId = getFirebaseProjectIdFromEnv();
    const emulatorEndpoint = (process.env.STORAGE_EMULATOR_HOST || '').trim();
    if (emulatorEndpoint) {
      cachedStorageClient = new Storage({ projectId, apiEndpoint: emulatorEndpoint });
    } else if (inlineSa) {
      cachedStorageClient = new Storage({ projectId: inlineSa.project_id || projectId, credentials: inlineSa });
    } else {
      cachedStorageClient = new Storage({ projectId });
    }
  }
  return cachedStorageClient.bucket(bucketName);
}

// =========================================================================
// Safe Serialization & Undefined Stripping for Firestore
// =========================================================================
function stripUndefinedDeep<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value instanceof Date) {
    return value.toISOString() as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

function stripInternalFirestoreFields<T>(docData: Record<string, any>): T {
  if (Object.prototype.hasOwnProperty.call(docData, '_primitiveValue')) {
    return docData._primitiveValue as T;
  }
  const clone: Record<string, any> = {};
  for (const [k, v] of Object.entries(docData)) {
    if (k === '_orderIndex' || k === '_schemaVersion' || k === '_updatedAt') continue;
    clone[k] = v;
  }
  return clone as T;
}

// =========================================================================
// Provider Interfaces (Pluggable for Production & Unit Tests)
// =========================================================================
export interface StructuredPersistenceProvider {
  readTenantCollection<T>(tenantId: string, collectionName: string, fallback: T): Promise<T>;
  mutateTenantCollection<T>(
    tenantId: string,
    collectionName: string,
    fallback: T,
    mutator: (current: T) => T | Promise<T>
  ): Promise<T>;
  listTenantCollectionPaginated<T = any>(
    tenantId: string,
    collectionName: string,
    opts?: { limit?: number; cursor?: string | null }
  ): Promise<PaginatedCollectionResult<T>>;
  readSharedCollection<T>(collectionName: string, fallback: T): Promise<T>;
  mutateSharedCollection<T>(
    collectionName: string,
    fallback: T,
    mutator: (current: T) => T | Promise<T>
  ): Promise<T>;
  runCreditLedgerTransaction<T>(
    tenantId: string,
    fn: (
      entries: any[],
      saveEntries: (nextEntries: any[]) => Promise<void>
    ) => Promise<T> | T
  ): Promise<T>;
  upsertFileMetadata(tenantId: string, meta: MediaObjectMetadata): Promise<void>;
  deleteFileMetadata(tenantId: string, fileId: string): Promise<void>;
  getFileMetadata(tenantId: string, fileId: string): Promise<MediaObjectMetadata | null>;
  purgeTenantStructuredData(tenantId: string): Promise<void>;
}

export interface MediaStorageProvider {
  readonly mode: StorageBackendMode;
  saveBuffer(params: {
    tenantId: string;
    category: MediaCategory;
    filename: string;
    buffer: Buffer;
    mimeType: string;
    originalName?: string;
    recordMetadata?: boolean;
  }): Promise<MediaObjectMetadata>;
  saveFromFile(params: {
    tenantId: string;
    category: MediaCategory;
    filename: string;
    localFilePath: string;
    mimeType: string;
    originalName?: string;
    recordMetadata?: boolean;
  }): Promise<MediaObjectMetadata>;
  readBuffer(tenantId: string, category: MediaCategory, filename: string): Promise<Buffer | null>;
  materializeToTempFile(
    tenantId: string,
    category: MediaCategory,
    filename: string,
    targetDir: string
  ): Promise<string | null>;
  exists(tenantId: string, category: MediaCategory, filename: string): Promise<boolean>;
  getMetadata(
    tenantId: string,
    category: MediaCategory,
    filename: string
  ): Promise<MediaObjectMetadata | null>;
  updateMetadata(
    tenantId: string,
    category: MediaCategory,
    filename: string,
    patch: Partial<Pick<MediaObjectMetadata, 'originalName' | 'mimeType' | 'status'>>
  ): Promise<MediaObjectMetadata | null>;
  getSignedDownloadUrl(
    tenantId: string,
    category: MediaCategory,
    filename: string,
    expiresSeconds?: number
  ): Promise<string | null>;
  streamHttpResponse(
    req: Request,
    res: Response,
    tenantId: string,
    category: MediaCategory,
    filename: string,
    fallbackMimeType?: string
  ): Promise<boolean>;
  deleteAsset(tenantId: string, category: MediaCategory, filename: string): Promise<void>;
  deleteTenantMedia(tenantId: string): Promise<void>;
}

// =========================================================================
// Local Development Filesystem Providers
// =========================================================================
const localWriteLocks = new Map<string, Promise<unknown>>();

export async function withLocalLock<T>(lockKey: string, fn: () => Promise<T>): Promise<T> {
  const prev = localWriteLocks.get(lockKey) || Promise.resolve();
  const next = prev.then(fn, fn);
  localWriteLocks.set(lockKey, next.catch(() => {}));
  return next;
}

function getLocalTenantDir(tenantId: string): string {
  const dir = path.join(LOCAL_DATA_ROOT, sanitizeTenantId(tenantId));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getLocalSharedDir(): string {
  if (!fs.existsSync(LOCAL_SHARED_ROOT)) {
    fs.mkdirSync(LOCAL_SHARED_ROOT, { recursive: true });
  }
  return LOCAL_SHARED_ROOT;
}

async function readLocalJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  if (!fs.existsSync(filePath)) return fallback;
  const raw = await fs.promises.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
}

async function atomicWriteLocalJson(filePath: string, data: unknown): Promise<void> {
  const tmpPath = `${filePath}.${crypto.randomUUID()}.tmp`;
  await fs.promises.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.promises.rename(tmpPath, filePath);
}

const CATEGORY_TO_LOCAL_DIR: Record<MediaCategory, string> = {
  vision: 'vision_assets',
  cinema: 'cinema_assets',
  music: 'audio_assets',
  documents: 'doc_assets',
  library: 'library_assets',
};

const MAX_MEDIA_UPLOAD_BYTES = Number(process.env.MAX_MEDIA_UPLOAD_BYTES || 250 * 1024 * 1024);

const ALLOWED_MEDIA_MIME_PREFIXES: Record<MediaCategory, string[]> = {
  vision: ['image/'],
  cinema: ['video/', 'image/', 'audio/'],
  music: ['audio/', 'image/'],
  documents: ['audio/', 'application/', 'text/', 'image/'],
  library: ['image/', 'video/', 'audio/', 'application/', 'text/'],
};

export function validateMediaUploadConstraints(
  category: MediaCategory,
  mimeType: string,
  sizeBytes: number
): void {
  const normalizedMime = String(mimeType || 'application/octet-stream').toLowerCase();
  const allowedPrefixes = ALLOWED_MEDIA_MIME_PREFIXES[category] || [];
  if (
    allowedPrefixes.length > 0 &&
    !allowedPrefixes.some((prefix) => normalizedMime.startsWith(prefix)) &&
    normalizedMime !== 'application/octet-stream'
  ) {
    throw new CloudPersistenceError(
      'INVALID_MEDIA_MIME',
      `MIME type "${normalizedMime}" is not allowed for category "${category}".`
    );
  }
  if (sizeBytes < 0 || sizeBytes > MAX_MEDIA_UPLOAD_BYTES) {
    throw new CloudPersistenceError(
      'MEDIA_SIZE_EXCEEDED',
      `File size (${sizeBytes} bytes) exceeds maximum limit (${MAX_MEDIA_UPLOAD_BYTES} bytes).`
    );
  }
}

export function inferMimeFromFilename(filename: string, fallback = 'application/octet-stream'): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
    '.ogg': 'audio/ogg',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.html': 'text/html; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.zip': 'application/zip',
  };
  return map[ext] || fallback;
}

class LocalStructuredPersistenceProvider implements StructuredPersistenceProvider {
  async readTenantCollection<T>(tenantId: string, collectionName: string, fallback: T): Promise<T> {
    const filePath = path.join(getLocalTenantDir(tenantId), `${collectionName}.json`);
    return readLocalJsonFile(filePath, fallback);
  }

  async mutateTenantCollection<T>(
    tenantId: string,
    collectionName: string,
    fallback: T,
    mutator: (current: T) => T | Promise<T>
  ): Promise<T> {
    const filePath = path.join(getLocalTenantDir(tenantId), `${collectionName}.json`);
    return withLocalLock(filePath, async () => {
      const current = await readLocalJsonFile<T>(filePath, fallback);
      const updated = await mutator(current);
      await atomicWriteLocalJson(filePath, updated);
      return updated;
    });
  }

  async listTenantCollectionPaginated<T = any>(
    tenantId: string,
    collectionName: string,
    opts?: { limit?: number; cursor?: string | null }
  ): Promise<PaginatedCollectionResult<T>> {
    const list = await this.readTenantCollection<T[]>(tenantId, collectionName, []);
    const arr = Array.isArray(list) ? list : [];
    const limit = Math.min(200, Math.max(1, Number(opts?.limit || 50)));
    const offset = Math.max(0, Number(opts?.cursor || 0) || 0);
    const items = arr.slice(offset, offset + limit);
    const nextOffset = offset + items.length;
    return {
      items,
      total: arr.length,
      nextCursor: nextOffset < arr.length ? String(nextOffset) : null,
      hasMore: nextOffset < arr.length,
    };
  }

  async readSharedCollection<T>(collectionName: string, fallback: T): Promise<T> {
    const filePath = path.join(getLocalSharedDir(), `${collectionName}.json`);
    return readLocalJsonFile(filePath, fallback);
  }

  async mutateSharedCollection<T>(
    collectionName: string,
    fallback: T,
    mutator: (current: T) => T | Promise<T>
  ): Promise<T> {
    const filePath = path.join(getLocalSharedDir(), `${collectionName}.json`);
    return withLocalLock(filePath, async () => {
      const current = await readLocalJsonFile<T>(filePath, fallback);
      const updated = await mutator(current);
      await atomicWriteLocalJson(filePath, updated);
      return updated;
    });
  }

  async runCreditLedgerTransaction<T>(
    tenantId: string,
    fn: (entries: any[], saveEntries: (nextEntries: any[]) => Promise<void>) => Promise<T> | T
  ): Promise<T> {
    const filePath = path.join(getLocalTenantDir(tenantId), 'credit_ledger.json');
    return withLocalLock(filePath, async () => {
      const current = await readLocalJsonFile<any[]>(filePath, []);
      return fn(current, async (nextEntries: any[]) => {
        await atomicWriteLocalJson(filePath, nextEntries);
      });
    });
  }

  async upsertFileMetadata(tenantId: string, meta: MediaObjectMetadata): Promise<void> {
    await this.mutateTenantCollection<Record<string, MediaObjectMetadata>>(
      tenantId,
      'files_metadata',
      {},
      (map) => ({
        ...map,
        [meta.fileId]: meta,
      })
    );
  }

  async deleteFileMetadata(tenantId: string, fileId: string): Promise<void> {
    await this.mutateTenantCollection<Record<string, MediaObjectMetadata>>(
      tenantId,
      'files_metadata',
      {},
      (map) => {
        if (!map[fileId]) return map;
        const next = { ...map };
        delete next[fileId];
        return next;
      }
    );
  }

  async getFileMetadata(tenantId: string, fileId: string): Promise<MediaObjectMetadata | null> {
    const map = await this.readTenantCollection<Record<string, MediaObjectMetadata>>(
      tenantId,
      'files_metadata',
      {}
    );
    return map[fileId] || null;
  }

  async purgeTenantStructuredData(tenantId: string): Promise<void> {
    const dir = getLocalTenantDir(tenantId);
    await withLocalLock(dir, async () => {
      if (fs.existsSync(dir)) {
        await fs.promises.rm(dir, { recursive: true, force: true });
      }
    });
  }
}

export function resolveLocalMediaFilePath(
  tenantId: string,
  category: MediaCategory,
  filename: string
): string | null {
  const clean = normalizeSafeAssetFilename(filename);
  if (!clean) return null;
  const subDirName = CATEGORY_TO_LOCAL_DIR[category];
  const dir = path.join(getLocalTenantDir(tenantId), subDirName);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const resolved = path.resolve(dir, clean);
  if (!resolved.startsWith(path.resolve(dir) + path.sep)) {
    return null;
  }
  return resolved;
}

function sendStreamWithByteRange(
  req: Request,
  res: Response,
  totalSize: number,
  contentType: string,
  createStream: (opts?: { start?: number; end?: number }) => NodeJS.ReadableStream
): void {
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');

  const range = req.headers.range;
  if (range && (contentType.startsWith('video/') || contentType.startsWith('audio/'))) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    if (match) {
      const start = Math.min(Number(match[1]), Math.max(0, totalSize - 1));
      const requestedEnd = match[2] ? Number(match[2]) : totalSize - 1;
      const end = Math.min(requestedEnd, Math.max(0, totalSize - 1));
      if (start <= end && totalSize > 0) {
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
        res.setHeader('Content-Length', String(end - start + 1));
        const stream = createStream({ start, end });
        stream.on('error', () => {
          if (!res.headersSent) res.status(500).end();
          else res.destroy();
        });
        stream.pipe(res);
        return;
      }
    }
  }

  res.setHeader('Content-Length', String(totalSize));
  const stream = createStream();
  stream.on('error', () => {
    if (!res.headersSent) res.status(500).end();
    else res.destroy();
  });
  stream.pipe(res);
}

class LocalMediaStorageProvider implements MediaStorageProvider {
  readonly mode: StorageBackendMode = 'local';

  async saveBuffer(params: {
    tenantId: string;
    category: MediaCategory;
    filename: string;
    buffer: Buffer;
    mimeType: string;
    originalName?: string;
    recordMetadata?: boolean;
  }): Promise<MediaObjectMetadata> {
    validateMediaUploadConstraints(params.category, params.mimeType, params.buffer.length);
    const filePath = resolveLocalMediaFilePath(params.tenantId, params.category, params.filename);
    if (!filePath) {
      throw new CloudPersistenceError('INVALID_ASSET_FILENAME', 'Unsafe or invalid media filename.');
    }
    const tmpPath = `${filePath}.${crypto.randomUUID()}.tmp`;
    await fs.promises.writeFile(tmpPath, params.buffer);
    await fs.promises.rename(tmpPath, filePath);
    const now = new Date().toISOString();
    const meta: MediaObjectMetadata = {
      fileId: `${params.category}:${path.basename(filePath)}`,
      tenantId: sanitizeTenantId(params.tenantId),
      originalName: params.originalName || path.basename(filePath),
      objectPath: filePath,
      mimeType: params.mimeType,
      size: params.buffer.length,
      category: params.category,
      createdAt: now,
      updatedAt: now,
      status: 'ready',
      storageProvider: 'local',
      checksum: crypto.createHash('sha256').update(params.buffer).digest('hex'),
    };
    if (params.recordMetadata !== false) {
      await getStructuredPersistenceProvider().upsertFileMetadata(params.tenantId, meta);
    }
    return meta;
  }

  async saveFromFile(params: {
    tenantId: string;
    category: MediaCategory;
    filename: string;
    localFilePath: string;
    mimeType: string;
    originalName?: string;
    recordMetadata?: boolean;
  }): Promise<MediaObjectMetadata> {
    const stat = await fs.promises.stat(params.localFilePath);
    validateMediaUploadConstraints(params.category, params.mimeType, stat.size);
    const destPath = resolveLocalMediaFilePath(params.tenantId, params.category, params.filename);
    if (!destPath) {
      throw new CloudPersistenceError('INVALID_ASSET_FILENAME', 'Unsafe or invalid media filename.');
    }
    const tmpPath = `${destPath}.${crypto.randomUUID()}.tmp`;
    await fs.promises.copyFile(params.localFilePath, tmpPath);
    await fs.promises.rename(tmpPath, destPath);
    const now = new Date().toISOString();
    const hash = crypto.createHash('sha256');
    await pipeline(fs.createReadStream(destPath), hash);
    const meta: MediaObjectMetadata = {
      fileId: `${params.category}:${path.basename(destPath)}`,
      tenantId: sanitizeTenantId(params.tenantId),
      originalName: params.originalName || path.basename(destPath),
      objectPath: destPath,
      mimeType: params.mimeType,
      size: stat.size,
      category: params.category,
      createdAt: now,
      updatedAt: now,
      status: 'ready',
      storageProvider: 'local',
      checksum: hash.digest('hex'),
    };
    if (params.recordMetadata !== false) {
      await getStructuredPersistenceProvider().upsertFileMetadata(params.tenantId, meta);
    }
    return meta;
  }

  async readBuffer(tenantId: string, category: MediaCategory, filename: string): Promise<Buffer | null> {
    const fp = resolveLocalMediaFilePath(tenantId, category, filename);
    if (!fp || !fs.existsSync(fp)) return null;
    return fs.promises.readFile(fp);
  }

  async materializeToTempFile(
    tenantId: string,
    category: MediaCategory,
    filename: string,
    targetDir: string
  ): Promise<string | null> {
    const fp = resolveLocalMediaFilePath(tenantId, category, filename);
    if (!fp || !fs.existsSync(fp)) return null;
    const targetPath = path.join(targetDir, path.basename(fp));
    await fs.promises.copyFile(fp, targetPath);
    return targetPath;
  }

  async exists(tenantId: string, category: MediaCategory, filename: string): Promise<boolean> {
    const fp = resolveLocalMediaFilePath(tenantId, category, filename);
    return Boolean(fp && fs.existsSync(fp));
  }

  async getMetadata(
    tenantId: string,
    category: MediaCategory,
    filename: string
  ): Promise<MediaObjectMetadata | null> {
    const fp = resolveLocalMediaFilePath(tenantId, category, filename);
    if (!fp || !fs.existsSync(fp)) return null;
    const existing = await getStructuredPersistenceProvider().getFileMetadata(
      tenantId,
      `${category}:${path.basename(fp)}`
    );
    if (existing) return existing;
    const stat = await fs.promises.stat(fp);
    return {
      fileId: `${category}:${path.basename(fp)}`,
      tenantId: sanitizeTenantId(tenantId),
      originalName: path.basename(fp),
      objectPath: fp,
      mimeType: inferMimeFromFilename(fp),
      size: stat.size,
      category,
      createdAt: stat.birthtime.toISOString(),
      updatedAt: stat.mtime.toISOString(),
      status: 'ready',
      storageProvider: 'local',
    };
  }

  async updateMetadata(
    tenantId: string,
    category: MediaCategory,
    filename: string,
    patch: Partial<Pick<MediaObjectMetadata, 'originalName' | 'mimeType' | 'status'>>
  ): Promise<MediaObjectMetadata | null> {
    const existing = await this.getMetadata(tenantId, category, filename);
    if (!existing) return null;
    const updated: MediaObjectMetadata = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await getStructuredPersistenceProvider().upsertFileMetadata(tenantId, updated);
    return updated;
  }

  async getSignedDownloadUrl(): Promise<string | null> {
    return null;
  }

  async streamHttpResponse(
    req: Request,
    res: Response,
    tenantId: string,
    category: MediaCategory,
    filename: string,
    fallbackMimeType?: string
  ): Promise<boolean> {
    const fp = resolveLocalMediaFilePath(tenantId, category, filename);
    if (!fp || !fs.existsSync(fp)) return false;
    const stat = await fs.promises.stat(fp);
    const contentType = inferMimeFromFilename(fp, fallbackMimeType || 'application/octet-stream');
    sendStreamWithByteRange(req, res, stat.size, contentType, (opts) =>
      fs.createReadStream(fp, opts)
    );
    return true;
  }

  async deleteAsset(tenantId: string, category: MediaCategory, filename: string): Promise<void> {
    const fp = resolveLocalMediaFilePath(tenantId, category, filename);
    if (fp && fs.existsSync(fp)) {
      await fs.promises.unlink(fp).catch(() => {});
    }
    const clean = normalizeSafeAssetFilename(filename);
    if (clean) {
      await getStructuredPersistenceProvider().deleteFileMetadata(tenantId, `${category}:${clean}`);
    }
  }

  async deleteTenantMedia(tenantId: string): Promise<void> {
    const dir = path.join(LOCAL_DATA_ROOT, sanitizeTenantId(tenantId));
    for (const sub of Object.values(CATEGORY_TO_LOCAL_DIR)) {
      const target = path.join(dir, sub);
      if (fs.existsSync(target)) {
        await fs.promises.rm(target, { recursive: true, force: true });
      }
    }
  }
}

// =========================================================================
// Cloud Firestore Structured Persistence Provider (Production)
// =========================================================================
const FIRESTORE_COLLECTION_MAP: Record<string, string> = {
  conversations: 'chats',
  projects: 'projects',
  studio_apps: 'studios',
  studio_prompts: 'studio_prompts',
  vision_images: 'vision_images',
  motion_videos: 'motion_videos',
  audio_tracks: 'audio_tracks',
  documents: 'documents',
  library_folders: 'library_folders',
  voice_clones: 'voice_clones',
};

const SINGLETON_STATE_COLLECTIONS = new Set<string>([
  'settings',
  'byok_keys',
  'plan',
  'library_meta',
  'plugins_vault',
  'plugins_custom',
  'files_metadata',
]);

export class FirestoreStructuredPersistenceProvider implements StructuredPersistenceProvider {
  private readonly dbFactory: () => Firestore;

  constructor(dbFactory: () => Firestore = getFirestoreDb) {
    this.dbFactory = dbFactory;
  }

  private getDb(): Firestore {
    try {
      return this.dbFactory();
    } catch (err: any) {
      throw new CloudPersistenceError(
        'FIRESTORE_INIT_FAILED',
        `Cloud Firestore initialization failed: ${err?.message || err}`,
        { cause: err }
      );
    }
  }

  private isSingletonCollection(collectionName: string, sampleValue?: unknown): boolean {
    if (SINGLETON_STATE_COLLECTIONS.has(collectionName)) return true;
    if (FIRESTORE_COLLECTION_MAP[collectionName]) return false;
    return !Array.isArray(sampleValue);
  }

  private subcollectionPath(tenantId: string, collectionName: string): string {
    return FIRESTORE_COLLECTION_MAP[collectionName] || collectionName.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private itemDocId(item: any, idx: number): string {
    if (item && typeof item === 'object') {
      const candidate = item.id || item.shareId || item.fileId;
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128);
      }
    }
    return `item_${String(idx).padStart(6, '0')}`;
  }

  private encodeItemForFirestore(item: any, idx: number): Record<string, any> {
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
      return {
        ...stripUndefinedDeep(item),
        _orderIndex: idx,
        _schemaVersion: 1,
        _updatedAt: FieldValue.serverTimestamp(),
      };
    }
    return {
      _primitiveValue: stripUndefinedDeep(item),
      _orderIndex: idx,
      _schemaVersion: 1,
      _updatedAt: FieldValue.serverTimestamp(),
    };
  }

  async readTenantCollection<T>(tenantId: string, collectionName: string, fallback: T): Promise<T> {
    const safeTenant = sanitizeTenantId(tenantId);
    const db = this.getDb();

    return withTransientRetry(`firestore.read.${collectionName}`, async () => {
      try {
        if (this.isSingletonCollection(collectionName, fallback)) {
          const ref = db.collection('tenants').doc(safeTenant).collection('state').doc(collectionName);
          const snap = await ref.get();
          if (!snap.exists) return fallback;
          const data = snap.data() || {};
          return stripInternalFirestoreFields<T>(data);
        }

        const sub = this.subcollectionPath(safeTenant, collectionName);
        const snap = await db
          .collection('tenants')
          .doc(safeTenant)
          .collection(sub)
          .orderBy('_orderIndex', 'asc')
          .get();

        if (snap.empty) return fallback;
        const items = snap.docs.map((doc) => stripInternalFirestoreFields<any>(doc.data()));
        return items as unknown as T;
      } catch (err: any) {
        if (err instanceof CloudPersistenceError) throw err;
        throw new CloudPersistenceError(
          'FIRESTORE_READ_FAILED',
          `Failed reading Firestore collection "${collectionName}" for tenant "${safeTenant}": ${err?.message || err}`,
          { cause: err, retryable: true }
        );
      }
    });
  }

  async mutateTenantCollection<T>(
    tenantId: string,
    collectionName: string,
    fallback: T,
    mutator: (current: T) => T | Promise<T>
  ): Promise<T> {
    const safeTenant = sanitizeTenantId(tenantId);
    const db = this.getDb();

    return withTransientRetry(`firestore.mutate.${collectionName}`, async () => {
      try {
        if (this.isSingletonCollection(collectionName, fallback)) {
          const ref = db.collection('tenants').doc(safeTenant).collection('state').doc(collectionName);
          return db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const current = snap.exists
              ? stripInternalFirestoreFields<T>(snap.data() || {})
              : fallback;
            const updated = await mutator(current);
            const payload =
              updated !== null && typeof updated === 'object' && !Array.isArray(updated)
                ? {
                    ...stripUndefinedDeep(updated),
                    _schemaVersion: 1,
                    _updatedAt: FieldValue.serverTimestamp(),
                  }
                : {
                    _primitiveValue: stripUndefinedDeep(updated),
                    _schemaVersion: 1,
                    _updatedAt: FieldValue.serverTimestamp(),
                  };
            tx.set(ref, payload);
            return updated;
          });
        }

        const sub = this.subcollectionPath(safeTenant, collectionName);
        const colRef = db.collection('tenants').doc(safeTenant).collection(sub);

        return db.runTransaction(async (tx) => {
          const snap = await tx.get(colRef.orderBy('_orderIndex', 'asc'));
          const existingDocs = new Map<string, Record<string, any>>();
          snap.docs.forEach((d) => existingDocs.set(d.id, d.data()));

          const currentArr = snap.empty
            ? (Array.isArray(fallback) ? fallback : [])
            : snap.docs.map((d) => stripInternalFirestoreFields<any>(d.data()));

          const updated = await mutator(currentArr as unknown as T);
          if (!Array.isArray(updated)) {
            throw new CloudPersistenceError(
              'FIRESTORE_SCHEMA_MISMATCH',
              `Collection "${collectionName}" expects an array payload.`
            );
          }

          const nextIds = new Set<string>();
          updated.forEach((item, idx) => {
            const docId = this.itemDocId(item, idx);
            nextIds.add(docId);
            const docRef = colRef.doc(docId);
            tx.set(docRef, this.encodeItemForFirestore(item, idx));
          });

          for (const prevId of existingDocs.keys()) {
            if (!nextIds.has(prevId)) {
              tx.delete(colRef.doc(prevId));
            }
          }

          return updated;
        });
      } catch (err: any) {
        if (err instanceof CloudPersistenceError) throw err;
        throw new CloudPersistenceError(
          'FIRESTORE_MUTATE_FAILED',
          `Failed mutating Firestore collection "${collectionName}" for tenant "${safeTenant}": ${err?.message || err}`,
          { cause: err, retryable: true }
        );
      }
    });
  }

  async listTenantCollectionPaginated<T = any>(
    tenantId: string,
    collectionName: string,
    opts?: { limit?: number; cursor?: string | null }
  ): Promise<PaginatedCollectionResult<T>> {
    const safeTenant = sanitizeTenantId(tenantId);
    const db = this.getDb();
    const sub = this.subcollectionPath(safeTenant, collectionName);
    const limit = Math.min(200, Math.max(1, Number(opts?.limit || 50)));
    const colRef = db.collection('tenants').doc(safeTenant).collection(sub);

    return withTransientRetry(`firestore.paginate.${collectionName}`, async () => {
      try {
        let query = colRef.orderBy('_orderIndex', 'asc').limit(limit + 1);
        if (opts?.cursor) {
          const cursorOrder = Number(opts.cursor);
          if (Number.isFinite(cursorOrder)) {
            query = colRef.orderBy('_orderIndex', 'asc').startAfter(cursorOrder).limit(limit + 1);
          }
        }
        const [snap, countSnap] = await Promise.all([
          query.get(),
          colRef.count().get().catch(() => null),
        ]);
        const hasMore = snap.docs.length > limit;
        const pageDocs = hasMore ? snap.docs.slice(0, limit) : snap.docs;
        const lastDoc = pageDocs[pageDocs.length - 1];
        const nextCursor = hasMore && lastDoc ? String(lastDoc.data()._orderIndex) : null;
        return {
          items: pageDocs.map((d) => stripInternalFirestoreFields<T>(d.data())),
          total: countSnap ? countSnap.data().count : pageDocs.length,
          nextCursor,
          hasMore,
        };
      } catch (err: any) {
        throw new CloudPersistenceError(
          'FIRESTORE_PAGINATE_FAILED',
          `Failed paginating Firestore collection "${collectionName}": ${err?.message || err}`,
          { cause: err, retryable: true }
        );
      }
    });
  }

  async readSharedCollection<T>(collectionName: string, fallback: T): Promise<T> {
    const db = this.getDb();
    return withTransientRetry(`firestore.shared.read.${collectionName}`, async () => {
      try {
        const snap = await db.collection('shared').doc(collectionName).collection('entries').get();
        if (!snap.empty) {
          const map: Record<string, any> = {};
          for (const doc of snap.docs) {
            map[doc.id] = stripInternalFirestoreFields<any>(doc.data());
          }
          return map as unknown as T;
        }
        return fallback;
      } catch (err: any) {
        throw new CloudPersistenceError(
          'FIRESTORE_SHARED_READ_FAILED',
          `Failed reading shared collection "${collectionName}": ${err?.message || err}`,
          { cause: err, retryable: true }
        );
      }
    });
  }

  async mutateSharedCollection<T>(
    collectionName: string,
    fallback: T,
    mutator: (current: T) => T | Promise<T>
  ): Promise<T> {
    const db = this.getDb();
    return withTransientRetry(`firestore.shared.mutate.${collectionName}`, async () => {
      try {
        const entriesCol = db.collection('shared').doc(collectionName).collection('entries');
        return db.runTransaction(async (tx) => {
          const snap = await tx.get(entriesCol);
          const currentMap: Record<string, any> = {};
          snap.docs.forEach((d) => {
            currentMap[d.id] = stripInternalFirestoreFields<any>(d.data());
          });
          const current = (snap.empty ? fallback : currentMap) as T;
          const updated = await mutator(current);
          if (!updated || typeof updated !== 'object' || Array.isArray(updated)) {
            throw new CloudPersistenceError(
              'FIRESTORE_SHARED_SCHEMA_ERROR',
              `Shared collection "${collectionName}" must be a key-value map.`
            );
          }

          const nextKeys = new Set(Object.keys(updated as Record<string, any>));
          for (const [key, val] of Object.entries(updated as Record<string, any>)) {
            const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128);
            tx.set(entriesCol.doc(safeKey), {
              ...stripUndefinedDeep(val),
              _schemaVersion: 1,
              _updatedAt: FieldValue.serverTimestamp(),
            });
          }
          for (const doc of snap.docs) {
            if (!nextKeys.has(doc.id)) {
              tx.delete(entriesCol.doc(doc.id));
            }
          }
          return updated;
        });
      } catch (err: any) {
        if (err instanceof CloudPersistenceError) throw err;
        throw new CloudPersistenceError(
          'FIRESTORE_SHARED_MUTATE_FAILED',
          `Failed mutating shared collection "${collectionName}": ${err?.message || err}`,
          { cause: err, retryable: true }
        );
      }
    });
  }

  async runCreditLedgerTransaction<T>(
    tenantId: string,
    fn: (entries: any[], saveEntries: (nextEntries: any[]) => Promise<void>) => Promise<T> | T
  ): Promise<T> {
    const safeTenant = sanitizeTenantId(tenantId);
    const db = this.getDb();
    const colRef = db.collection('tenants').doc(safeTenant).collection('credit_ledger');

    return withTransientRetry('firestore.credit_ledger.tx', async () => {
      try {
        return db.runTransaction(async (tx) => {
          const snap = await tx.get(colRef.orderBy('_orderIndex', 'asc'));
          const existingIds = new Set(snap.docs.map((d) => d.id));
          const entries = snap.docs.map((d) => stripInternalFirestoreFields<any>(d.data()));
          return fn(entries, async (nextEntries: any[]) => {
            nextEntries.forEach((entry, idx) => {
              const docId = String(entry.id || `led_${idx}`).replace(/[^a-zA-Z0-9._-]/g, '_');
              if (!existingIds.has(docId)) {
                tx.set(colRef.doc(docId), {
                  ...stripUndefinedDeep(entry),
                  _orderIndex: idx,
                  _schemaVersion: 1,
                  _updatedAt: FieldValue.serverTimestamp(),
                });
              }
            });
          });
        });
      } catch (err: any) {
        throw new CloudPersistenceError(
          'FIRESTORE_CREDIT_TX_FAILED',
          `Credit ledger Firestore transaction failed for "${safeTenant}": ${err?.message || err}`,
          { cause: err, retryable: true }
        );
      }
    });
  }

  async upsertFileMetadata(tenantId: string, meta: MediaObjectMetadata): Promise<void> {
    const safeTenant = sanitizeTenantId(tenantId);
    const db = this.getDb();
    const docId = meta.fileId.replace(/[^a-zA-Z0-9._:-]/g, '_').replace(/:/g, '__');
    await withTransientRetry('firestore.files.upsert', async () => {
      await db
        .collection('tenants')
        .doc(safeTenant)
        .collection('files')
        .doc(docId)
        .set({
          ...stripUndefinedDeep(meta),
          _schemaVersion: 1,
          _updatedAt: FieldValue.serverTimestamp(),
        });
    });
  }

  async deleteFileMetadata(tenantId: string, fileId: string): Promise<void> {
    const safeTenant = sanitizeTenantId(tenantId);
    const db = this.getDb();
    const docId = fileId.replace(/[^a-zA-Z0-9._:-]/g, '_').replace(/:/g, '__');
    await withTransientRetry('firestore.files.delete', async () => {
      await db.collection('tenants').doc(safeTenant).collection('files').doc(docId).delete();
    });
  }

  async getFileMetadata(tenantId: string, fileId: string): Promise<MediaObjectMetadata | null> {
    const safeTenant = sanitizeTenantId(tenantId);
    const db = this.getDb();
    const docId = fileId.replace(/[^a-zA-Z0-9._:-]/g, '_').replace(/:/g, '__');
    return withTransientRetry('firestore.files.get', async () => {
      const snap = await db.collection('tenants').doc(safeTenant).collection('files').doc(docId).get();
      if (!snap.exists) return null;
      return stripInternalFirestoreFields<MediaObjectMetadata>(snap.data() || {});
    });
  }

  async purgeTenantStructuredData(tenantId: string): Promise<void> {
    const safeTenant = sanitizeTenantId(tenantId);
    const db = this.getDb();
    const tenantDocRef = db.collection('tenants').doc(safeTenant);
    const subcollections = await tenantDocRef.listCollections();

    for (const sub of subcollections) {
      while (true) {
        const snap = await sub.limit(350).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
    }
    await tenantDocRef.delete().catch(() => {});
  }
}

// =========================================================================
// Google Cloud Storage Media Provider (Production)
// =========================================================================
export class GcsMediaStorageProvider implements MediaStorageProvider {
  readonly mode: StorageBackendMode = 'cloud';
  private readonly bucketFactory: () => Bucket;
  private readonly metadataProvider: () => StructuredPersistenceProvider;

  constructor(
    bucketFactory: () => Bucket = getGcsBucket,
    metadataProvider: () => StructuredPersistenceProvider = getStructuredPersistenceProvider
  ) {
    this.bucketFactory = bucketFactory;
    this.metadataProvider = metadataProvider;
  }

  buildObjectPath(tenantId: string, category: MediaCategory, filename: string): string {
    const safeTenant = sanitizeTenantId(tenantId);
    const cleanFile = normalizeSafeAssetFilename(filename);
    if (!cleanFile) {
      throw new CloudPersistenceError('INVALID_ASSET_FILENAME', 'Unsafe or invalid media filename.');
    }
    return `tenants/${safeTenant}/${category}/${cleanFile}`;
  }

  async saveBuffer(params: {
    tenantId: string;
    category: MediaCategory;
    filename: string;
    buffer: Buffer;
    mimeType: string;
    originalName?: string;
    recordMetadata?: boolean;
  }): Promise<MediaObjectMetadata> {
    validateMediaUploadConstraints(params.category, params.mimeType, params.buffer.length);
    const objectPath = this.buildObjectPath(params.tenantId, params.category, params.filename);
    const cleanFile = path.basename(objectPath);
    const checksum = crypto.createHash('sha256').update(params.buffer).digest('hex');
    const bucket = this.bucketFactory();
    const file = bucket.file(objectPath);

    await withTransientRetry('gcs.saveBuffer', async () => {
      await file.save(params.buffer, {
        resumable: params.buffer.length > 5 * 1024 * 1024,
        contentType: params.mimeType,
        metadata: {
          contentType: params.mimeType,
          cacheControl: 'private, max-age=31536000, immutable',
          metadata: {
            tenantId: sanitizeTenantId(params.tenantId),
            category: params.category,
            originalName: params.originalName || cleanFile,
            sha256: checksum,
          },
        },
      });
    });

    const now = new Date().toISOString();
    const meta: MediaObjectMetadata = {
      fileId: `${params.category}:${cleanFile}`,
      tenantId: sanitizeTenantId(params.tenantId),
      originalName: params.originalName || cleanFile,
      objectPath,
      mimeType: params.mimeType,
      size: params.buffer.length,
      category: params.category,
      createdAt: now,
      updatedAt: now,
      status: 'ready',
      storageProvider: 'cloud',
      checksum,
    };

    if (params.recordMetadata !== false) {
      await this.metadataProvider().upsertFileMetadata(params.tenantId, meta);
    }
    return meta;
  }

  async saveFromFile(params: {
    tenantId: string;
    category: MediaCategory;
    filename: string;
    localFilePath: string;
    mimeType: string;
    originalName?: string;
    recordMetadata?: boolean;
  }): Promise<MediaObjectMetadata> {
    const stat = await fs.promises.stat(params.localFilePath);
    validateMediaUploadConstraints(params.category, params.mimeType, stat.size);
    const objectPath = this.buildObjectPath(params.tenantId, params.category, params.filename);
    const cleanFile = path.basename(objectPath);
    const hash = crypto.createHash('sha256');
    await pipeline(fs.createReadStream(params.localFilePath), hash);
    const checksum = hash.digest('hex');
    const bucket = this.bucketFactory();
    const file = bucket.file(objectPath);

    await withTransientRetry('gcs.saveFromFile', async () => {
      await pipeline(
        fs.createReadStream(params.localFilePath),
        file.createWriteStream({
          resumable: stat.size > 5 * 1024 * 1024,
          contentType: params.mimeType,
          metadata: {
            contentType: params.mimeType,
            cacheControl: 'private, max-age=31536000, immutable',
            metadata: {
              tenantId: sanitizeTenantId(params.tenantId),
              category: params.category,
              originalName: params.originalName || cleanFile,
              sha256: checksum,
            },
          },
        })
      );
    });

    const now = new Date().toISOString();
    const meta: MediaObjectMetadata = {
      fileId: `${params.category}:${cleanFile}`,
      tenantId: sanitizeTenantId(params.tenantId),
      originalName: params.originalName || cleanFile,
      objectPath,
      mimeType: params.mimeType,
      size: stat.size,
      category: params.category,
      createdAt: now,
      updatedAt: now,
      status: 'ready',
      storageProvider: 'cloud',
      checksum,
    };

    if (params.recordMetadata !== false) {
      await this.metadataProvider().upsertFileMetadata(params.tenantId, meta);
    }
    return meta;
  }

  async readBuffer(tenantId: string, category: MediaCategory, filename: string): Promise<Buffer | null> {
    const objectPath = this.buildObjectPath(tenantId, category, filename);
    const file = this.bucketFactory().file(objectPath);
    return withTransientRetry('gcs.readBuffer', async () => {
      const [exists] = await file.exists();
      if (!exists) return null;
      const [buf] = await file.download();
      return buf;
    });
  }

  async materializeToTempFile(
    tenantId: string,
    category: MediaCategory,
    filename: string,
    targetDir: string
  ): Promise<string | null> {
    const objectPath = this.buildObjectPath(tenantId, category, filename);
    const file = this.bucketFactory().file(objectPath);
    const [exists] = await file.exists();
    if (!exists) return null;
    const targetPath = path.join(targetDir, path.basename(objectPath));
    await pipeline(file.createReadStream(), fs.createWriteStream(targetPath));
    return targetPath;
  }

  async exists(tenantId: string, category: MediaCategory, filename: string): Promise<boolean> {
    const clean = normalizeSafeAssetFilename(filename);
    if (!clean) return false;
    const objectPath = this.buildObjectPath(tenantId, category, clean);
    const [exists] = await this.bucketFactory().file(objectPath).exists();
    return exists;
  }

  async getMetadata(
    tenantId: string,
    category: MediaCategory,
    filename: string
  ): Promise<MediaObjectMetadata | null> {
    const objectPath = this.buildObjectPath(tenantId, category, filename);
    const clean = path.basename(objectPath);
    const storedMeta = await this.metadataProvider().getFileMetadata(
      tenantId,
      `${category}:${clean}`
    );
    if (storedMeta) return storedMeta;

    const file = this.bucketFactory().file(objectPath);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [gcsMeta] = await file.getMetadata();
    return {
      fileId: `${category}:${clean}`,
      tenantId: sanitizeTenantId(tenantId),
      originalName: String(gcsMeta?.metadata?.originalName || clean),
      objectPath,
      mimeType: String(gcsMeta?.contentType || inferMimeFromFilename(clean)),
      size: Number(gcsMeta?.size || 0),
      category,
      createdAt: String(gcsMeta?.timeCreated || new Date().toISOString()),
      updatedAt: String(gcsMeta?.updated || new Date().toISOString()),
      status: 'ready',
      storageProvider: 'cloud',
      checksum: gcsMeta?.metadata?.sha256 ? String(gcsMeta.metadata.sha256) : undefined,
    };
  }

  async updateMetadata(
    tenantId: string,
    category: MediaCategory,
    filename: string,
    patch: Partial<Pick<MediaObjectMetadata, 'originalName' | 'mimeType' | 'status'>>
  ): Promise<MediaObjectMetadata | null> {
    const current = await this.getMetadata(tenantId, category, filename);
    if (!current) return null;
    const next: MediaObjectMetadata = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    const file = this.bucketFactory().file(current.objectPath);
    await file.setMetadata({
      ...(patch.mimeType ? { contentType: patch.mimeType } : {}),
      metadata: {
        originalName: next.originalName,
        status: next.status,
      },
    });
    await this.metadataProvider().upsertFileMetadata(tenantId, next);
    return next;
  }

  async getSignedDownloadUrl(
    tenantId: string,
    category: MediaCategory,
    filename: string,
    expiresSeconds = 300
  ): Promise<string | null> {
    const objectPath = this.buildObjectPath(tenantId, category, filename);
    const file = this.bucketFactory().file(objectPath);
    const [exists] = await file.exists();
    if (!exists) return null;
    const boundedTtl = Math.min(900, Math.max(60, expiresSeconds));
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + boundedTtl * 1000,
    });
    return url;
  }

  async streamHttpResponse(
    req: Request,
    res: Response,
    tenantId: string,
    category: MediaCategory,
    filename: string,
    fallbackMimeType?: string
  ): Promise<boolean> {
    const objectPath = this.buildObjectPath(tenantId, category, filename);
    const file = this.bucketFactory().file(objectPath);
    const [exists] = await file.exists();
    if (!exists) return false;
    const [gcsMeta] = await file.getMetadata();
    const totalSize = Number(gcsMeta?.size || 0);
    const contentType = String(
      gcsMeta?.contentType || inferMimeFromFilename(filename, fallbackMimeType || 'application/octet-stream')
    );

    sendStreamWithByteRange(req, res, totalSize, contentType, (opts) =>
      file.createReadStream(opts ? { start: opts.start, end: opts.end } : undefined)
    );
    return true;
  }

  async deleteAsset(tenantId: string, category: MediaCategory, filename: string): Promise<void> {
    const clean = normalizeSafeAssetFilename(filename);
    if (!clean) return;
    const objectPath = this.buildObjectPath(tenantId, category, clean);
    await this.bucketFactory()
      .file(objectPath)
      .delete({ ignoreNotFound: true })
      .catch((err) => {
        logCloudEvent('warn', 'gcs_delete_asset_warning', {
          objectPath,
          error: String(err?.message || err),
        });
      });
    await this.metadataProvider()
      .deleteFileMetadata(tenantId, `${category}:${clean}`)
      .catch(() => {});
  }

  async deleteTenantMedia(tenantId: string): Promise<void> {
    const prefix = `tenants/${sanitizeTenantId(tenantId)}/`;
    await this.bucketFactory().deleteFiles({ prefix, force: true });
  }
}

// =========================================================================
// Singleton Adapter Registry + Test Injection Hooks
// =========================================================================
const localStructuredProvider = new LocalStructuredPersistenceProvider();
const localMediaProvider = new LocalMediaStorageProvider();
const firestoreStructuredProvider = new FirestoreStructuredPersistenceProvider();
const gcsMediaProvider = new GcsMediaStorageProvider();

let overrideProviders: {
  structured?: StructuredPersistenceProvider | null;
  media?: MediaStorageProvider | null;
} = {};

export function setCloudAdaptersForTesting(overrides: {
  structured?: StructuredPersistenceProvider | null;
  media?: MediaStorageProvider | null;
}): void {
  overrideProviders = { ...overrides };
}

export function resetCloudAdaptersForTesting(): void {
  overrideProviders = {};
}

export function getStructuredPersistenceProvider(): StructuredPersistenceProvider {
  if (overrideProviders.structured) {
    return overrideProviders.structured;
  }
  const mode = getStorageBackendMode();
  if (mode === 'cloud') {
    const validation = validateCloudConfig();
    if (!validation.ok) {
      throw new CloudPersistenceError(
        'CLOUD_PERSISTENCE_MISCONFIGURED',
        validation.errors.join(' ')
      );
    }
    return firestoreStructuredProvider;
  }
  return localStructuredProvider;
}

export function getMediaStorageProvider(): MediaStorageProvider {
  if (overrideProviders.media) {
    return overrideProviders.media;
  }
  const mode = getStorageBackendMode();
  if (mode === 'cloud') {
    const validation = validateCloudConfig();
    if (!validation.ok) {
      throw new CloudPersistenceError(
        'CLOUD_MEDIA_MISCONFIGURED',
        validation.errors.join(' ')
      );
    }
    return gcsMediaProvider;
  }
  return localMediaProvider;
}

// =========================================================================
// Cached Lightweight Cloud Health & Capabilities Probe
// =========================================================================
let cachedCloudHealth: { expiresAt: number; status: CloudPersistenceHealthStatus } | null = null;
const HEALTH_CACHE_TTL_MS = 45_000;

export async function getCloudPersistenceHealth(
  verifyLive = false
): Promise<CloudPersistenceHealthStatus> {
  const now = Date.now();
  if (!verifyLive && cachedCloudHealth && cachedCloudHealth.expiresAt > now) {
    return cachedCloudHealth.status;
  }

  let mode: StorageBackendMode = 'local';
  try {
    mode = getStorageBackendMode();
  } catch {
    mode = 'local';
  }
  const projectId = getFirebaseProjectIdFromEnv();
  const bucketName = getGcsBucketName();
  const gcsBucketConfigured = Boolean(bucketName);
  const emulatorMode = {
    firestore: Boolean(process.env.FIRESTORE_EMULATOR_HOST),
    auth: Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST),
    storage: Boolean(process.env.STORAGE_EMULATOR_HOST),
  };

  let firebaseAdmin: ServiceReadinessState = 'not_configured';
  let firestore: ServiceReadinessState = 'not_configured';
  let gcs: ServiceReadinessState = 'not_configured';
  let errorSummary: string | undefined;

  if (mode === 'cloud') {
    try {
      getFirebaseAdminApp();
      firebaseAdmin = 'configured';
      firestore = 'configured';
    } catch (err: any) {
      firebaseAdmin = 'unavailable';
      firestore = 'unavailable';
      errorSummary = err?.message || 'Firebase Admin initialization failed.';
    }

    gcs = gcsBucketConfigured ? 'configured' : 'not_configured';
    if (!gcsBucketConfigured && !errorSummary) {
      errorSummary = 'GCS_BUCKET_NAME is not configured.';
    }

    if (verifyLive) {
      try {
        const db = getFirestoreDb();
        await db.collection('_healthcheck').doc('ping').get();
        firestore = 'available';
        firebaseAdmin = 'available';
      } catch (err: any) {
        firestore = 'unavailable';
        errorSummary = err?.message || 'Firestore live probe failed.';
      }

      if (gcsBucketConfigured) {
        try {
          const bucket = getGcsBucket();
          try {
            const [exists] = await bucket.exists();
            gcs = exists ? 'available' : 'unavailable';
            if (!exists && !errorSummary) {
              errorSummary = `GCS bucket "${bucketName}" does not exist or is inaccessible.`;
            }
          } catch (existsErr: any) {
            const msg = String(existsErr?.message || '');
            if (existsErr?.code === 403 || msg.includes('storage.buckets.get')) {
              await bucket.getFiles({ prefix: '_healthcheck/', maxResults: 1, autoPaginate: false });
              gcs = 'available';
            } else {
              throw existsErr;
            }
          }
        } catch (err: any) {
          gcs = 'unavailable';
          errorSummary = errorSummary || err?.message || 'GCS live probe failed.';
        }
      }
    }
  } else {
    // Local mode still inspects whether Firebase project ID / optional admin env are configured
    firebaseAdmin = process.env.FIREBASE_PROJECT_ID || getApps().length > 0 ? 'configured' : 'not_configured';
    firestore = emulatorMode.firestore ? 'configured' : 'not_configured';
    gcs = gcsBucketConfigured ? 'configured' : 'not_configured';
  }

  const status: CloudPersistenceHealthStatus = {
    storageBackend: mode,
    firebaseProjectId: projectId,
    gcsBucketConfigured,
    firebaseAdmin,
    firestore,
    gcs,
    emulatorMode,
    lastCheckedAt: new Date().toISOString(),
    ...(errorSummary ? { errorSummary } : {}),
  };

  cachedCloudHealth = {
    expiresAt: now + HEALTH_CACHE_TTL_MS,
    status,
  };
  return status;
}

// =========================================================================
// Safe Explicit Local-to-Cloud Migration Utility (Non-Destructive)
// =========================================================================
export interface TenantMigrationReport {
  tenantId: string;
  collectionsMigrated: string[];
  filesUploaded: number;
  filesVerified: number;
  errors: string[];
  localFilesPreserved: true;
}

export async function migrateLocalTenantToCloud(
  tenantId: string,
  opts?: { dryRun?: boolean }
): Promise<TenantMigrationReport> {
  const safeTenant = sanitizeTenantId(tenantId);
  const dryRun = Boolean(opts?.dryRun);
  const report: TenantMigrationReport = {
    tenantId: safeTenant,
    collectionsMigrated: [],
    filesUploaded: 0,
    filesVerified: 0,
    errors: [],
    localFilesPreserved: true,
  };

  const validation = validateCloudConfig();
  if (validation.mode !== 'cloud' || !validation.ok) {
    throw new CloudPersistenceError(
      'MIGRATION_REQUIRES_CLOUD_MODE',
      validation.errors.join(' ') || 'Set STORAGE_BACKEND=cloud and GCS_BUCKET_NAME before running migration.'
    );
  }

  const collections = [
    'settings',
    'byok_keys',
    'plan',
    'conversations',
    'projects',
    'studio_apps',
    'studio_prompts',
    'vision_images',
    'motion_videos',
    'audio_tracks',
    'documents',
    'library_meta',
    'library_folders',
    'plugins_vault',
    'plugins_custom',
    'voice_clones',
  ];

  for (const col of collections) {
    const filePath = path.join(LOCAL_DATA_ROOT, safeTenant, `${col}.json`);
    if (!fs.existsSync(filePath)) continue;
    try {
      const localData = await localStructuredProvider.readTenantCollection<any>(safeTenant, col, null);
      if (localData !== null && !dryRun) {
        await firestoreStructuredProvider.mutateTenantCollection(safeTenant, col, localData, () => localData);
      }
      report.collectionsMigrated.push(col);
    } catch (err: any) {
      report.errors.push(`Collection ${col}: ${err?.message || err}`);
    }
  }

  // Upload media files from local dirs into GCS without deleting local copies
  for (const [category, subDir] of Object.entries(CATEGORY_TO_LOCAL_DIR) as Array<[MediaCategory, string]>) {
    const dir = path.join(LOCAL_DATA_ROOT, safeTenant, subDir);
    if (!fs.existsSync(dir)) continue;
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const fullPath = path.join(dir, entry.name);
      try {
        if (!dryRun) {
          const mimeType = inferMimeFromFilename(entry.name);
          const uploaded = await gcsMediaProvider.saveFromFile({
            tenantId: safeTenant,
            category,
            filename: entry.name,
            localFilePath: fullPath,
            mimeType,
          });
          report.filesUploaded += 1;
          const existsInGcs = await gcsMediaProvider.exists(safeTenant, category, entry.name);
          if (existsInGcs && uploaded.size >= 0) {
            report.filesVerified += 1;
          } else {
            report.errors.push(`Verification failed after upload for ${category}/${entry.name}`);
          }
        } else {
          report.filesUploaded += 1;
        }
      } catch (err: any) {
        report.errors.push(`File ${category}/${entry.name}: ${err?.message || err}`);
      }
    }
  }

  return report;
}

export async function withTempWorkingDir<T>(
  prefix: string,
  fn: (tmpDir: string) => Promise<T>
): Promise<T> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    return await fn(tmpDir);
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
