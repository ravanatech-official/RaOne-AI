import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { initializeApp, getApps, getApp, applicationDefault, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';

export type AssetCategory = 'vision_assets' | 'cinema_assets' | 'audio_assets' | 'doc_assets';

export interface CloudPersistenceStatus {
  mode: 'firestore_gcs' | 'local_disk';
  cloudRequested: boolean;
  firestoreReady: boolean;
  gcsReady: boolean;
  projectId: string;
  gcsBucket: string | null;
  lastError: string | null;
}

const CHUNK_CHAR_SIZE = 600_000; // Strictly < 1 MiB Firestore document cap even with UTF-8 multi-byte chars

let initialized = false;
let firestoreInstance: Firestore | null = null;
let storageInstance: Storage | null = null;
let resolvedBucketName: string | null = null;
let resolvedProjectId = 'raoneai';
let cloudRequested = false;
let lastInitError: string | null = null;

function sanitizeSegment(value: string): string {
  return String(value || 'guest_workspace')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 96) || 'guest_workspace';
}

function shouldEnableCloudPersistence(): boolean {
  const flag = String(process.env.ENABLE_CLOUD_PERSISTENCE || '').trim().toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'off') {
    return false;
  }
  if (process.env.NODE_ENV === 'test' && flag !== 'true') {
    return false;
  }
  if (flag === 'true' || flag === '1' || flag === 'on') {
    return true;
  }
  return Boolean(
    process.env.K_SERVICE ||
      process.env.CLOUD_RUN_JOB ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  );
}

function resolveProjectId(): string {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    'raoneai'
  ).trim();
}

function resolveBucketName(projectId: string): string {
  const explicit = (
    process.env.GCS_BUCKET ||
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.VITE_FIREBASE_STORAGE_BUCKET ||
    ''
  )
    .trim()
    .replace(/^gs:\/\//i, '')
    .replace(/\/+$/, '');
  return explicit || `${projectId}.firebasestorage.app`;
}

function parseServiceAccountFromEnv(): Record<string, any> | null {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!raw) return null;
  try {
    if (raw.startsWith('{')) {
      return JSON.parse(raw);
    }
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (err: any) {
    lastInitError = `Invalid FIREBASE_SERVICE_ACCOUNT_JSON: ${err?.message || 'parse error'}`;
    return null;
  }
}

export function initCloudPersistence(): void {
  if (initialized) return;
  initialized = true;

  resolvedProjectId = resolveProjectId();
  cloudRequested = shouldEnableCloudPersistence();
  if (!cloudRequested) {
    return;
  }

  try {
    resolvedBucketName = resolveBucketName(resolvedProjectId);
    const serviceAccount = parseServiceAccountFromEnv();

    let adminApp: App;
    if (getApps().length > 0) {
      adminApp = getApp();
    } else if (serviceAccount) {
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: resolvedProjectId,
        storageBucket: resolvedBucketName,
      });
    } else {
      adminApp = initializeApp({
        credential: applicationDefault(),
        projectId: resolvedProjectId,
        storageBucket: resolvedBucketName,
      });
    }

    const db = getFirestore(adminApp);
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      // Ignore if Firestore settings already applied by an earlier module load
    }
    firestoreInstance = db;

    const st = getStorage(adminApp);
    storageInstance = st;
  } catch (err: any) {
    lastInitError = err?.message || 'Failed to initialize Firebase Admin SDK';
    firestoreInstance = null;
    storageInstance = null;
  }
}

export function isCloudFirestoreActive(): boolean {
  initCloudPersistence();
  return Boolean(firestoreInstance);
}

export function isCloudStorageActive(): boolean {
  initCloudPersistence();
  return Boolean(storageInstance && resolvedBucketName);
}

export function getCloudPersistenceStatus(): CloudPersistenceStatus {
  initCloudPersistence();
  const fsReady = Boolean(firestoreInstance);
  const gcsReady = Boolean(storageInstance && resolvedBucketName);
  return {
    mode: fsReady ? 'firestore_gcs' : 'local_disk',
    cloudRequested,
    firestoreReady: fsReady,
    gcsReady,
    projectId: resolvedProjectId,
    gcsBucket: resolvedBucketName,
    lastError: lastInitError,
  };
}

function getCollectionDocRef(scope: 'tenant' | 'shared', scopeId: string, collectionName: string) {
  if (!firestoreInstance) return null;
  const cleanCol = sanitizeSegment(collectionName);
  if (scope === 'shared') {
    return firestoreInstance.collection('raone_shared').doc(cleanCol);
  }
  const cleanTenant = sanitizeSegment(scopeId);
  return firestoreInstance
    .collection('raone_tenants')
    .doc(cleanTenant)
    .collection('collections')
    .doc(cleanCol);
}

export async function readCloudCollection<T>(
  scope: 'tenant' | 'shared',
  scopeId: string,
  collectionName: string
): Promise<{ found: true; data: T } | { found: false }> {
  initCloudPersistence();
  const docRef = getCollectionDocRef(scope, scopeId, collectionName);
  if (!docRef) return { found: false };

  try {
    const snap = await docRef.get();
    if (!snap.exists) return { found: false };
    const docData = snap.data() || {};

    if (docData.format === 'inline_json_v1' && typeof docData.json === 'string') {
      return { found: true, data: JSON.parse(docData.json) as T };
    }

    if (docData.format === 'chunked_json_v1' && typeof docData.chunkCount === 'number') {
      const count = docData.chunkCount;
      const chunkRefs = Array.from({ length: count }, (_, idx) =>
        docRef.collection('chunks').doc(`part_${String(idx).padStart(4, '0')}`)
      );
      const chunkSnaps = await Promise.all(chunkRefs.map((ref) => ref.get()));
      const parts: string[] = [];
      for (const cs of chunkSnaps) {
        const d = cs.data();
        if (!cs.exists || typeof d?.slice !== 'string') {
          throw new Error(`Missing chunk ${cs.id} in ${docRef.path}`);
        }
        parts.push(d.slice);
      }
      return { found: true, data: JSON.parse(parts.join('')) as T };
    }

    return { found: false };
  } catch (err: any) {
    lastInitError = err?.message || 'Firestore read failed';
    console.warn(`[RaOne CloudPersistence] Read warning (${collectionName}):`, lastInitError);
    return { found: false };
  }
}

export async function writeCloudCollection(
  scope: 'tenant' | 'shared',
  scopeId: string,
  collectionName: string,
  data: unknown
): Promise<boolean> {
  initCloudPersistence();
  const docRef = getCollectionDocRef(scope, scopeId, collectionName);
  if (!docRef || !firestoreInstance) return false;

  try {
    const serialized = JSON.stringify(data);
    const updatedAt = new Date().toISOString();

    if (serialized.length <= CHUNK_CHAR_SIZE) {
      await docRef.set({
        format: 'inline_json_v1',
        chunkCount: 0,
        json: serialized,
        updatedAt,
      });
      return true;
    }

    const slices: string[] = [];
    for (let i = 0; i < serialized.length; i += CHUNK_CHAR_SIZE) {
      slices.push(serialized.slice(i, i + CHUNK_CHAR_SIZE));
    }

    const chunksCol = docRef.collection('chunks');
    const BATCH_LIMIT = 8; // ~4.8 MB per batch, well under Firestore 10 MB RPC cap
    for (let start = 0; start < slices.length; start += BATCH_LIMIT) {
      const batch = firestoreInstance.batch();
      const end = Math.min(slices.length, start + BATCH_LIMIT);
      for (let idx = start; idx < end; idx++) {
        const chunkRef = chunksCol.doc(`part_${String(idx).padStart(4, '0')}`);
        batch.set(chunkRef, { idx, slice: slices[idx] });
      }
      await batch.commit();
    }

    await docRef.set({
      format: 'chunked_json_v1',
      chunkCount: slices.length,
      totalChars: serialized.length,
      updatedAt,
    });
    return true;
  } catch (err: any) {
    lastInitError = err?.message || 'Firestore write failed';
    console.warn(`[RaOne CloudPersistence] Write warning (${collectionName}):`, lastInitError);
    return false;
  }
}

function getAssetObjectPath(tenantId: string, category: AssetCategory, filename: string): string {
  const safeTenant = sanitizeSegment(tenantId);
  const safeFile = path.basename(String(filename || '').trim());
  return `tenants/${safeTenant}/${category}/${safeFile}`;
}

export async function syncAssetBufferToCloud(
  tenantId: string,
  category: AssetCategory,
  filename: string,
  buffer: Buffer,
  contentType = 'application/octet-stream'
): Promise<boolean> {
  if (!isCloudStorageActive() || !storageInstance || !resolvedBucketName) {
    return false;
  }
  try {
    const bucket = storageInstance.bucket(resolvedBucketName);
    const objectPath = getAssetObjectPath(tenantId, category, filename);
    await bucket.file(objectPath).save(buffer, {
      resumable: false,
      metadata: {
        contentType,
        cacheControl: 'private, max-age=31536000, immutable',
      },
    });
    return true;
  } catch (err: any) {
    lastInitError = err?.message || 'GCS upload failed';
    console.warn(`[RaOne CloudPersistence] GCS upload warning (${category}/${filename}):`, lastInitError);
    return false;
  }
}

export async function ensureAssetOnLocalDisk(
  tenantId: string,
  category: AssetCategory,
  filename: string,
  localPath: string | null
): Promise<string | null> {
  if (!localPath) return null;
  if (fs.existsSync(localPath)) return localPath;

  if (!isCloudStorageActive() || !storageInstance || !resolvedBucketName) {
    return null;
  }

  try {
    const bucket = storageInstance.bucket(resolvedBucketName);
    const objectPath = getAssetObjectPath(tenantId, category, filename);
    const file = bucket.file(objectPath);
    const [exists] = await file.exists();
    if (!exists) return null;

    const [buffer] = await file.download();
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = `${localPath}.${crypto.randomUUID()}.tmp`;
    await fs.promises.writeFile(tmpPath, buffer);
    await fs.promises.rename(tmpPath, localPath);
    return localPath;
  } catch (err: any) {
    lastInitError = err?.message || 'GCS download failed';
    console.warn(`[RaOne CloudPersistence] GCS download warning (${category}/${filename}):`, lastInitError);
    return null;
  }
}

export async function deleteAssetFromCloud(
  tenantId: string,
  category: AssetCategory,
  filename: string
): Promise<void> {
  if (!isCloudStorageActive() || !storageInstance || !resolvedBucketName) return;
  try {
    const bucket = storageInstance.bucket(resolvedBucketName);
    const objectPath = getAssetObjectPath(tenantId, category, filename);
    await bucket.file(objectPath).delete({ ignoreNotFound: true });
  } catch (err: any) {
    lastInitError = err?.message || 'GCS delete failed';
    console.warn(`[RaOne CloudPersistence] GCS delete warning (${category}/${filename}):`, lastInitError);
  }
}

export async function purgeTenantCloudData(tenantId: string): Promise<void> {
  initCloudPersistence();
  const cleanTenant = sanitizeSegment(tenantId);

  if (firestoreInstance) {
    try {
      const tenantDoc = firestoreInstance.collection('raone_tenants').doc(cleanTenant);
      await firestoreInstance.recursiveDelete(tenantDoc);
    } catch (err: any) {
      lastInitError = err?.message || 'Firestore purge failed';
      console.warn(`[RaOne CloudPersistence] Firestore purge warning (${cleanTenant}):`, lastInitError);
    }
  }

  if (storageInstance && resolvedBucketName) {
    try {
      const bucket = storageInstance.bucket(resolvedBucketName);
      await bucket.deleteFiles({ prefix: `tenants/${cleanTenant}/`, force: true });
    } catch (err: any) {
      lastInitError = err?.message || 'GCS purge failed';
      console.warn(`[RaOne CloudPersistence] GCS purge warning (${cleanTenant}):`, lastInitError);
    }
  }
}
