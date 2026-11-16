import crypto from 'crypto';
import dns from 'dns/promises';
import net from 'net';
import type { Request, Response, NextFunction } from 'express';
import {
  getFirebaseAdminAuth,
  getFirebaseProjectIdFromEnv,
  getStorageBackendMode,
  isCloudRunEnvironment,
  logCloudEvent,
} from './server_cloud_persistence.ts';

export interface VerifiedActor {
  uid: string;
  tenantId: string;
  email: string | null;
  emailVerified: boolean;
  isAuthenticated: boolean;
  authSource: 'firebase_jwt' | 'firebase_media_cookie' | 'guest_workspace';
}

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      actor?: VerifiedActor;
    }
  }
}

export type TokenVerificationResult = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
};

type TokenVerifierFn = (token: string) => Promise<TokenVerificationResult>;

let customTokenVerifierForTesting: TokenVerifierFn | null = null;

export function setTokenVerifierForTesting(verifier: TokenVerifierFn | null): void {
  customTokenVerifierForTesting = verifier;
}

export function getFirebaseProjectId(): string {
  return getFirebaseProjectIdFromEnv();
}

export function isFirebaseAuthRequired(): boolean {
  const raw = String(process.env.REQUIRE_FIREBASE_AUTH || '').trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') {
    // Allow explicit override only when intentionally disabled via env
    return false;
  }
  return process.env.NODE_ENV === 'production' || getStorageBackendMode() === 'cloud';
}

export function attachRequestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers['x-request-id'];
  const reqId =
    typeof incoming === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(incoming)
      ? incoming
      : `req_${crypto.randomUUID()}`;
  req.requestId = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
}

export function sendApiError(
  req: Request,
  res: Response,
  status: number,
  code: string,
  message: string,
  retryable = false
) {
  return res.status(status).json({
    error: message,
    code,
    message,
    request_id: req.requestId || 'unknown',
    retryable,
  });
}

export async function verifyFirebaseBearerToken(token: string): Promise<TokenVerificationResult> {
  const cleanToken = String(token || '').trim();
  if (!cleanToken || cleanToken.split('.').length !== 3) {
    throw new Error('Malformed or missing JWT Bearer token.');
  }

  if (customTokenVerifierForTesting) {
    const res = await customTokenVerifierForTesting(cleanToken);
    if (!res?.uid || typeof res.uid !== 'string' || res.uid.length > 128) {
      throw new Error('Firebase token missing valid subject UID.');
    }
    return res;
  }

  const checkRevoked = process.env.AUTH_CHECK_REVOKED === 'true';
  const decoded = await getFirebaseAdminAuth().verifyIdToken(cleanToken, checkRevoked);
  const uid = typeof decoded.uid === 'string' ? decoded.uid : decoded.sub;

  if (!uid || typeof uid !== 'string' || uid.length > 128) {
    throw new Error('Firebase token missing valid subject UID');
  }

  return {
    uid,
    email: typeof decoded.email === 'string' ? decoded.email : null,
    emailVerified: Boolean(decoded.email_verified),
  };
}

const PUBLIC_UNAUTHENTICATED_ROUTES = new Set<string>([
  '/api/health',
  '/api/models',
  '/api/capabilities',
  '/api/policies',
  '/api/billing/webhook',
  '/api/local-llm/status',
]);

function isPublicShareGetRoute(method: string, fullPath: string): boolean {
  if (method !== 'GET' && method !== 'HEAD') return false;
  return (
    /^\/api\/motion\/share\/[a-zA-Z0-9_-]+(?:\/stream)?$/.test(fullPath) ||
    /^\/api\/audio\/share\/[a-zA-Z0-9_-]+(?:\/stream)?$/.test(fullPath) ||
    /^\/api\/documents\/share\/[a-zA-Z0-9_-]+(?:\/audio)?$/.test(fullPath)
  );
}

function isMediaDownloadGetRoute(method: string, fullPath: string): boolean {
  if (method !== 'GET' && method !== 'HEAD') return false;
  return (
    fullPath.startsWith('/api/vision/assets/') ||
    fullPath.startsWith('/api/motion/assets/') ||
    fullPath.startsWith('/api/audio/assets/') ||
    fullPath.startsWith('/api/documents/assets/') ||
    fullPath === '/api/library/download'
  );
}

// =========================================================================
// Signed HttpOnly Media Session Cookie (for native <img>/<video>/<audio> tags)
// =========================================================================
const MEDIA_COOKIE_NAME = 'raone_media_session';

function getMediaCookieSigningKey(): Buffer {
  const secret =
    process.env.TENANT_ENCRYPTION_SECRET ||
    process.env.BYOK_ENCRYPTION_KEY ||
    process.env.SESSION_SECRET ||
    process.env.GEMINI_API_KEY ||
    'raone-local-dev-ephemeral-key-do-not-use-without-env';
  return crypto.scryptSync(secret, 'raone-media-session-cookie-v1', 32);
}

function createSignedMediaSessionToken(uid: string, tenantId: string, ttlSec = 3600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = Buffer.from(JSON.stringify({ uid, tenantId, exp }), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getMediaCookieSigningKey())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifySignedMediaSessionToken(
  token: string
): { uid: string; tenantId: string; exp: number } | null {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getMediaCookieSigningKey())
    .update(payloadB64)
    .digest('base64url');
  const a = Buffer.from(sigB64, 'utf-8');
  const b = Buffer.from(expectedSig, 'utf-8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (
      typeof parsed?.uid === 'string' &&
      typeof parsed?.tenantId === 'string' &&
      typeof parsed?.exp === 'number' &&
      parsed.exp > Math.floor(Date.now() / 1000)
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function parseCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const segments = cookieHeader.split(';');
  for (const seg of segments) {
    const eqIdx = seg.indexOf('=');
    if (eqIdx === -1) continue;
    const k = seg.slice(0, eqIdx).trim();
    if (k === name) {
      return decodeURIComponent(seg.slice(eqIdx + 1).trim());
    }
  }
  return null;
}

function attachMediaSessionCookie(req: Request, res: Response, uid: string, tenantId: string): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const token = createSignedMediaSessionToken(uid, tenantId, 3600);
  const parts = [
    `${MEDIA_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/api',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=3600',
  ];
  if (isHttps) {
    parts.push('Secure');
  }
  res.append('Set-Cookie', parts.join('; '));
}

/**
 * Default-deny API authentication & tenant binding middleware:
 * - Always verifies any supplied Bearer token via Firebase Admin SDK.
 * - Derives server-authoritative `tenantId = user_${uid}` (never trusting client tenant IDs).
 * - If REQUIRE_FIREBASE_AUTH=true (or Cloud Run production default), rejects ALL protected routes without valid auth (401).
 * - Preserves public share GET endpoints (by opaque shareId) and local/dev guest_workspace when auth is optional.
 */
export async function resolveActorMiddleware(req: Request, res: Response, next: NextFunction) {
  const fullPath = `${req.baseUrl || ''}${req.path || ''}`.replace(/\/+$/, '') || '/';
  const authHeader = req.headers.authorization || '';
  const strictMode = isFirebaseAuthRequired();

  if (req.method === 'OPTIONS') {
    return next();
  }

  if (authHeader) {
    if (!authHeader.startsWith('Bearer ')) {
      return sendApiError(req, res, 401, 'INVALID_AUTH_HEADER', 'Authorization header must use Bearer token format.');
    }
    const token = authHeader.slice(7).trim();
    if (!token || token.split('.').length !== 3) {
      return sendApiError(req, res, 401, 'INVALID_JWT', 'Malformed or non-JWT Bearer token rejected.');
    }
    try {
      const verified = await verifyFirebaseBearerToken(token);
      const tenantId = `user_${verified.uid}`;
      req.actor = {
        uid: verified.uid,
        tenantId,
        email: verified.email,
        emailVerified: verified.emailVerified,
        isAuthenticated: true,
        authSource: 'firebase_jwt',
      };
      // Keep signed HttpOnly media cookie refreshed for native <img>/<video>/<audio> requests
      const existingCookie = parseCookieValue(req.headers.cookie, MEDIA_COOKIE_NAME);
      const decodedCookie = existingCookie ? verifySignedMediaSessionToken(existingCookie) : null;
      if (!decodedCookie || decodedCookie.uid !== verified.uid || decodedCookie.exp - Math.floor(Date.now() / 1000) < 900) {
        attachMediaSessionCookie(req, res, verified.uid, tenantId);
      }
      return next();
    } catch (err: any) {
      logCloudEvent('warn', 'firebase_token_rejected', {
        path: fullPath,
        requestId: req.requestId,
        reason: String(err?.message || 'Verification failed').slice(0, 120),
      });
      return sendApiError(
        req,
        res,
        401,
        'TOKEN_VERIFICATION_FAILED',
        `Invalid or expired Firebase ID token: ${err?.message || 'Verification failed'}`
      );
    }
  }

  // Allow signed HttpOnly media cookie strictly for GET binary asset streaming & download routes
  if (isMediaDownloadGetRoute(req.method, fullPath)) {
    const rawCookie = parseCookieValue(req.headers.cookie, MEDIA_COOKIE_NAME);
    const verifiedCookie = rawCookie ? verifySignedMediaSessionToken(rawCookie) : null;
    if (verifiedCookie) {
      req.actor = {
        uid: verifiedCookie.uid,
        tenantId: verifiedCookie.tenantId,
        email: null,
        emailVerified: true,
        isAuthenticated: true,
        authSource: 'firebase_media_cookie',
      };
      return next();
    }
  }

  if (PUBLIC_UNAUTHENTICATED_ROUTES.has(fullPath) || isPublicShareGetRoute(req.method, fullPath)) {
    req.actor = {
      uid: 'public',
      tenantId: 'guest_workspace',
      email: null,
      emailVerified: false,
      isAuthenticated: false,
      authSource: 'guest_workspace',
    };
    return next();
  }

  if (strictMode) {
    return sendApiError(
      req,
      res,
      401,
      'AUTH_REQUIRED',
      'Authentication required. Sign in to obtain a valid Firebase ID token.'
    );
  }

  req.actor = {
    uid: 'guest',
    tenantId: 'guest_workspace',
    email: null,
    emailVerified: false,
    isAuthenticated: false,
    authSource: 'guest_workspace',
  };
  return next();
}

export function requireVerifiedAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.actor?.isAuthenticated || req.actor.authSource === 'guest_workspace') {
    return sendApiError(
      req,
      res,
      401,
      'VERIFIED_AUTH_REQUIRED',
      'This sensitive operation requires a verified signed-in account.'
    );
  }
  return next();
}

// =========================================================================
// AES-256-GCM Encryption for Tenant BYOK Secrets (v1 backward-compatible)
// =========================================================================
const DEFAULT_DEV_FALLBACK_SECRET = 'raone-local-dev-ephemeral-key-do-not-use-without-env';

function getConfiguredEncryptionSecret(): string {
  return (
    process.env.TENANT_ENCRYPTION_SECRET ||
    process.env.BYOK_ENCRYPTION_KEY ||
    process.env.SESSION_SECRET ||
    process.env.GEMINI_API_KEY ||
    DEFAULT_DEV_FALLBACK_SECRET
  );
}

export function validateEncryptionConfig(): {
  configured: boolean;
  usingFallbackDevKey: boolean;
  algorithm: 'aes-256-gcm';
} {
  const explicit = Boolean(
    process.env.TENANT_ENCRYPTION_SECRET ||
      process.env.BYOK_ENCRYPTION_KEY ||
      process.env.SESSION_SECRET
  );
  const hasAny = explicit || Boolean(process.env.GEMINI_API_KEY);
  const usingFallback = !hasAny;

  if (usingFallback && (process.env.NODE_ENV === 'production' || getStorageBackendMode() === 'cloud')) {
    logCloudEvent('warn', 'encryption_secret_missing', {
      message: 'TENANT_ENCRYPTION_SECRET should be explicitly configured in Secret Manager for production.',
    });
  }

  return {
    configured: hasAny,
    usingFallbackDevKey: usingFallback,
    algorithm: 'aes-256-gcm',
  };
}

function getMasterKeyBuffer(): Buffer {
  const secret = getConfiguredEncryptionSecret();
  return crypto.scryptSync(secret, 'raone-tenant-byok-salt-v1', 32);
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return '';
  const key = getMasterKeyBuffer();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(ciphertext: string): string {
  if (!ciphertext || !ciphertext.startsWith('v1:')) return '';
  const parts = ciphertext.split(':');
  if (parts.length !== 4) return '';
  const [, ivHex, tagHex, encHex] = parts;
  if (!ivHex || !tagHex || !encHex) return '';
  const key = getMasterKeyBuffer();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

// =========================================================================
// Strict SSRF & Outbound Egress Validation (Blocks Private/Metadata IPs)
// =========================================================================
const DEFAULT_ALLOWED_EGRESS_HOSTS = new Set<string>([
  'api.cometapi.com',
  'api.groq.com',
  'api.openai.com',
  'api.anthropic.com',
  'api.deepseek.com',
  'api.x.ai',
  'openrouter.ai',
  'api.cloudflare.com',
  'image.pollinations.ai',
  'gen.pollinations.ai',
  'api-inference.huggingface.co',
  'router.huggingface.co',
  'fal.run',
  'queue.fal.run',
  'api.runware.ai',
  'api.lemonsqueezy.com',
  'api.polar.sh',
  'sandbox.payhere.lk',
  'www.payhere.lk',
]);

const DISPOSABLE_EMAIL_DOMAINS = new Set<string>([
  '10minutemail.com',
  '10minutemail.net',
  'guerrillamail.com',
  'guerrillamailblock.com',
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  'throwawaymail.com',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
  'dispostable.com',
  'getnada.com',
  'maildrop.cc',
  'mohmal.com',
]);

export function isDisposableEmailDomain(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') return false;
  const atIdx = email.lastIndexOf('@');
  if (atIdx === -1) return false;
  const domain = email.slice(atIdx + 1).trim().toLowerCase();
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

function isPrivateOrReservedIp(ip: string): boolean {
  const normalized = ip.replace(/^::ffff:/i, '');
  if (net.isIPv4(normalized)) {
    const octets = normalized.split('.').map(Number);
    if (octets.length !== 4) return true;
    const [a, b] = octets;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // Cloud metadata & link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // Multicast / reserved
    return false;
  }
  if (net.isIPv6(normalized)) {
    const lower = normalized.toLowerCase();
    if (
      lower === '::1' ||
      lower === '::' ||
      lower.startsWith('fe80:') ||
      lower.startsWith('fc') ||
      lower.startsWith('fd')
    ) {
      return true;
    }
    return false;
  }
  return true;
}

export async function validateSafeHttpsEgress(rawUrl: string): Promise<{
  ok: true;
  parsedUrl: URL;
} | {
  ok: false;
  reason: string;
}> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'Invalid URL format.' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Only HTTPS origins are permitted for outbound gateway calls.' };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'Embedded credentials in URLs are not permitted.' };
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    net.isIP(host) !== 0
  ) {
    return { ok: false, reason: 'Direct IP addresses, localhost, and internal hostnames are blocked.' };
  }

  const extraHosts = (process.env.ALLOWED_GATEWAY_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  const allowed = new Set([...DEFAULT_ALLOWED_EGRESS_HOSTS, ...extraHosts]);
  if (!allowed.has(host)) {
    return {
      ok: false,
      reason: `Host "${host}" is not on the approved AI provider egress allowlist.`,
    };
  }

  try {
    const records = await dns.lookup(host, { all: true });
    if (!records || records.length === 0) {
      return { ok: false, reason: 'DNS resolution returned no records.' };
    }
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        return { ok: false, reason: 'Resolved IP belongs to a private or reserved network.' };
      }
    }
  } catch {
    return { ok: false, reason: 'Failed DNS resolution for gateway host.' };
  }

  return { ok: true, parsedUrl: parsed };
}

// =========================================================================
// True Sliding-Window Log Rate Limiter (Scoped by Actor UID or Trusted IP)
// =========================================================================
interface SlidingLog {
  timestamps: number[];
}

export function createSlidingWindowLimiter(opts: {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}) {
  const buckets = new Map<string, SlidingLog>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') return next();

    const now = Date.now();
    const cutoff = now - opts.windowMs;

    if (buckets.size > 4000) {
      for (const [k, entry] of buckets.entries()) {
        entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
        if (entry.timestamps.length === 0) buckets.delete(k);
      }
    }

    const identity = req.actor?.isAuthenticated
      ? `uid:${req.actor.uid}`
      : `ip:${req.ip || 'unknown'}`;
    const bucketKey = `${opts.keyPrefix}:${identity}`;
    const entry = buckets.get(bucketKey) || { timestamps: [] };
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    res.setHeader('X-RateLimit-Limit', String(opts.maxRequests));
    if (entry.timestamps.length >= opts.maxRequests) {
      const oldest = entry.timestamps[0] || now;
      const retryAfterSec = Math.max(1, Math.ceil((oldest + opts.windowMs - now) / 1000));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('Retry-After', String(retryAfterSec));
      return sendApiError(
        req,
        res,
        429,
        'RATE_LIMIT_EXCEEDED',
        'Rate limit exceeded. Please wait before sending more requests.',
        true
      );
    }

    entry.timestamps.push(now);
    buckets.set(bucketKey, entry);
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, opts.maxRequests - entry.timestamps.length)));
    return next();
  };
}
