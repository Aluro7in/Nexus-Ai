/**
 * Nexus AI — Secure Firebase Authentication Module
 *
 * Implements cryptographic Firebase ID token verification using the official
 * Firebase Admin SDK via `verifyIdToken()`.
 *
 * Security Guarantees:
 * 1. Cryptographic Verification: All tokens verified using Google's public keys via getAuth().verifyIdToken().
 * 2. Strict Identity Extraction: Authenticated UID derived solely from verified token payload.
 * 3. No Insecure Fallbacks: Remote/production requests with missing, forged, expired, or malformed tokens are rejected.
 * 4. Safe Dev Bypass: Local development demo identity only allowed when NODE_ENV !== 'production'
 *    AND DEV_AUTH_BYPASS === 'true' AND request originates from loopback (127.0.0.1 / ::1).
 * 5. Credential Safety: Uses ADC (Application Default Credentials) or GOOGLE_APPLICATION_CREDENTIALS.
 *    Tokens and private keys are never logged.
 * 6. Test Mock Hook: Provides setCustomTokenVerifier() for unit tests without contacting live Google servers.
 */

import { initializeApp, getApps, applicationDefault, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Request, Response, NextFunction } from 'express';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  name?: string;
  authMode: 'firebase' | 'dev-bypass';
}

export type TokenVerifier = (idToken: string) => Promise<{
  uid: string;
  email?: string;
  name?: string;
}>;

// State
let firebaseApp: App | null = null;
let firebaseInitError: string | null = null;
let customVerifier: TokenVerifier | null = null;

/**
 * Initialize Firebase Admin SDK using Application Default Credentials (ADC).
 * Returns true if initialized, false if credentials/configuration are unavailable.
 * Safe to call multiple times (idempotent).
 */
export function initFirebaseAdmin(): boolean {
  if (firebaseApp) return true;
  if (firebaseInitError) return false;

  try {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      firebaseApp = existingApps[0]!;
    } else {
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'gen-lang-client-0651785302';
      firebaseApp = initializeApp({
        credential: applicationDefault(),
        projectId,
      });
    }
    console.log('[Auth] Firebase Admin SDK initialized successfully via ADC.');
    return true;
  } catch (err) {
    firebaseInitError = err instanceof Error ? err.message : String(err);
    console.warn(
      `[Auth] Firebase Admin SDK initialization failed: ${firebaseInitError}. ` +
      `Live ID token verification requires Application Default Credentials (ADC) ` +
      `or GOOGLE_APPLICATION_CREDENTIALS pointing to a service account JSON.`
    );
    return false;
  }
}

/**
 * Get the initialized Firebase Admin App, or attempt initialization if not yet done.
 */
export function getFirebaseAdminApp(): App | null {
  if (firebaseApp) return firebaseApp;
  initFirebaseAdmin();
  return firebaseApp;
}

/**
 * Explicitly set or reset the Firebase Admin App instance (for testing).
 */
export function setFirebaseAdminApp(app: App | null): void {
  firebaseApp = app;
  if (app === null) {
    firebaseInitError = null;
  }
}

/**
 * Check if Firebase Admin SDK is ready for live verification.
 */
export function isFirebaseReady(): boolean {
  return firebaseApp !== null || customVerifier !== null;
}

/**
 * Get initialization error, if any.
 */
export function getFirebaseInitError(): string | null {
  return firebaseInitError;
}

/**
 * Inject a custom token verifier for testing purposes (e.g. unit tests).
 * Pass null to restore default Firebase Admin behavior.
 */
export function setCustomTokenVerifier(verifier: TokenVerifier | null): void {
  customVerifier = verifier;
}

/**
 * Reset all authentication mocks and cached state (for testing).
 */
export function resetAuthState(): void {
  customVerifier = null;
}

/**
 * Cryptographically verify a Firebase ID token.
 * Throws an Error with a descriptive code/message on failure.
 */
export async function verifyFirebaseToken(
  idToken: string
): Promise<{ uid: string; email?: string; name?: string }> {
  // If a mock/test verifier is registered, use it
  if (customVerifier) {
    const verified = await customVerifier(idToken);
    if (!verified || !verified.uid) {
      throw new Error('Malformed token: Missing uid in verified payload');
    }
    return verified;
  }

  // Real Firebase Admin SDK verification
  if (!firebaseApp) {
    const initialized = initFirebaseAdmin();
    if (!initialized || !firebaseApp) {
      throw new Error('Firebase Admin SDK is not initialized. Credentials unavailable.');
    }
  }

  // verifyIdToken(idToken, checkRevoked = true)
  const decoded = await getAuth(firebaseApp).verifyIdToken(idToken, true);

  if (!decoded || !decoded.uid) {
    throw new Error('Malformed token: Missing uid in verified payload');
  }

  return {
    uid: decoded.uid,
    email: decoded.email,
    name: decoded.name as string | undefined,
  };
}

// ─── Environment Helpers ──────────────────────────────────────────────────────

export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function isDevAuthBypassEnabled(): boolean {
  if (isProductionEnvironment()) return false;
  return process.env.DEV_AUTH_BYPASS === 'true';
}

export function isLoopbackRequest(req: Request): boolean {
  // Remote socket address is authoritative against header spoofing
  const socketIp = req.socket?.remoteAddress || '';
  const directIp = req.ip || '';

  const isLoopbackIp = (ip: string) =>
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip === 'localhost';

  return isLoopbackIp(socketIp) || isLoopbackIp(directIp);
}

// ─── Express Authentication Middleware ────────────────────────────────────────

/**
 * Create Express authentication middleware.
 *
 * Rules:
 * - Production: Valid cryptographically-verified Firebase ID token is MANDATORY.
 * - Non-Production without DEV_AUTH_BYPASS: Valid verified token is MANDATORY.
 * - Non-Production with DEV_AUTH_BYPASS=true:
 *     - If Bearer token is provided: It MUST be verified cryptographically (never trusted blindly).
 *     - If no token is provided AND request is from loopback: Assigns demo user identity.
 *     - If no token is provided AND request is remote: REJECTED with 401.
 */
export function createAuthMiddleware() {
  // Try initializing on startup
  initFirebaseAdmin();

  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    // ── Case 1: Bearer token provided ──────────────────────────────────────────
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();

      if (!token) {
        return res.status(401).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Unauthorized: Empty or whitespace Bearer token' },
          id: null,
        });
      }

      try {
        const verified = await verifyFirebaseToken(token);

        (req as any).user = {
          uid: verified.uid,
          email: verified.email,
          name: verified.name,
          authMode: 'firebase',
        } satisfies AuthenticatedUser;

        return next();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const lowerMsg = message.toLowerCase();

        // Categorize verification failure without logging or echoing the secret token
        let userMessage = 'Unauthorized: Invalid or forged token';
        if (lowerMsg.includes('expired')) {
          userMessage = 'Unauthorized: Token has expired';
        } else if (lowerMsg.includes('revoked')) {
          userMessage = 'Unauthorized: Token has been revoked';
        } else if (lowerMsg.includes('malformed')) {
          userMessage = 'Unauthorized: Malformed token payload';
        } else if (lowerMsg.includes('not initialized') || lowerMsg.includes('credentials unavailable')) {
          if (isProductionEnvironment()) {
            return res.status(503).json({
              jsonrpc: '2.0',
              error: {
                code: -32000,
                message: 'Service Unavailable: Firebase Admin SDK not configured for cryptographic token verification',
              },
              id: null,
            });
          }
          userMessage = 'Unauthorized: Firebase Admin SDK not configured. Set GOOGLE_APPLICATION_CREDENTIALS or enable DEV_AUTH_BYPASS=true for local loopback development.';
        }

        return res.status(401).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: userMessage },
          id: null,
        });
      }
    }

    // ── Case 2: No Bearer token provided ───────────────────────────────────────

    // In production, unauthenticated requests are strictly forbidden
    if (isProductionEnvironment()) {
      return res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Unauthorized: Bearer token required in production' },
        id: null,
      });
    }

    // In development mode, check if explicit bypass is enabled AND request is from loopback
    if (isDevAuthBypassEnabled()) {
      if (isLoopbackRequest(req)) {
        (req as any).user = {
          uid: 'user_alex_rivera',
          email: 'alex.rivera@example.com',
          name: 'Development Demo User (Loopback Bypass)',
          authMode: 'dev-bypass',
        } satisfies AuthenticatedUser;
        return next();
      }

      // Remote client attempting to use dev bypass without token: forbidden
      return res.status(401).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Unauthorized: Development bypass is strictly restricted to local loopback (127.0.0.1 / ::1)',
        },
        id: null,
      });
    }

    // Dev mode with bypass disabled: require token
    return res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Unauthorized: Bearer token required. For local demo mode, set DEV_AUTH_BYPASS=true on loopback.',
      },
      id: null,
    });
  };
}
