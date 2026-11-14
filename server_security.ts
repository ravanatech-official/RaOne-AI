import crypto from 'crypto';
import dns from 'dns/promises';
import net from 'net';
import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const FIREBASE_JWKS_URL = new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
);
const firebaseJwks = createRemoteJWKSet(FIREBASE_JWKS_URL);

export interface VerifiedActor {
  uid: string;
  tenantId: string;
  email: string | null;
  emailVerified: boolean;
  isAuthenticated: boolean;
  authSource: 'firebase_jwt' | 'guest_workspace';
}

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      actor?: VerifiedActor;
    }
  }
}

export function getFirebaseProjectId(): string {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    'raoneai'
  ).trim();
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

export async function verifyFirebaseBearerToken(token: string): Promise<{
  uid: string;
  email: string | null;
  emailVerified: boolean;
}> {
  const projectId = getFirebaseProjectId();
  const issuer = `https://securetoken.google.com/${projectId}`;

  const { payload } = await jwtVerify(token, firebaseJwks, {
    issuer,
    audience: projectId,
    algorithms: ['RS256'],
  });

  const uid = typeof payload.user_id === 'string' ? payload.user_id : payload.sub;
  if (!uid || typeof uid !== 'string' || uid.length > 128) {
    throw new Error('Firebase token missing valid subject UID');
  }

  return {
    uid,
    email: typeof payload.email === 'string' ? payload.email : null,
    emailVerified: Boolean(payload.email_verified),
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

/**
 * Default-deny API authentication & tenant binding middleware:
 * - Always cryptographically verifies any supplied Bearer token (never trusts dummy/non-JWT tokens).
 * - If REQUIRE_FIREBASE_AUTH=true, rejects ALL protected routes without a valid Firebase token (401).
 * - Otherwise, unauthenticated requests without a Bearer header bind ONLY to an isolated 'guest-workspace' tenant
 *   (and sensitive account/admin/key/paid-plan mutations still require verified auth).
 */
export async function resolveActorMiddleware(req: Request, res: Response, next: NextFunction) {
  const fullPath = `${req.baseUrl || ''}${req.path || ''}`.replace(/\/+$/, '') || '/';
  const authHeader = req.headers.authorization || '';
  const strictMode = process.env.REQUIRE_FIREBASE_AUTH === 'true';

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
      req.actor = {
        uid: verified.uid,
        tenantId: `user_${verified.uid}`,
        email: verified.email,
        emailVerified: verified.emailVerified,
        isAuthenticated: true,
        authSource: 'firebase_jwt',
      };
      return next();
    } catch (err: any) {
      return sendApiError(
        req,
        res,
        401,
        'TOKEN_VERIFICATION_FAILED',
        `Invalid or expired Firebase ID token: ${err?.message || 'Verification failed'}`
      );
    }
  }

  if (PUBLIC_UNAUTHENTICATED_ROUTES.has(fullPath)) {
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
  if (!req.actor?.isAuthenticated) {
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
// AES-256-GCM Encryption for Tenant BYOK Secrets
// =========================================================================
function getMasterKeyBuffer(): Buffer {
  const secret =
    process.env.TENANT_ENCRYPTION_SECRET ||
    process.env.BYOK_ENCRYPTION_KEY ||
    process.env.SESSION_SECRET ||
    process.env.GEMINI_API_KEY ||
    'raone-local-dev-ephemeral-key-do-not-use-without-env';
  return crypto.scryptSync(secret, 'raone-tenant-byok-salt-v1', 32);
}

export function encryptSecret(plaintext: string): string {
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
]);

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
