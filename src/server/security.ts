import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { UserProfile, LeagueState } from '../types.js';

// Secret key for HMAC token signing (never exposed to client)
const SESSION_SECRET = process.env.SESSION_SECRET || 'khedira-league-secret-auth-key-2027-eafc';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days expiration

export interface SessionPayload {
  userId: string;
  email: string;
  role: 'ADMIN' | 'PARTICIPANT';
  iat: number;
  exp: number;
}

// 1. Password Hashing with bcrypt
export async function hashPassword(plainPassword: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
}

export async function verifyPassword(plainPassword: string, hashOrPlain?: string): Promise<boolean> {
  if (!hashOrPlain) return false;
  
  // If it's already a bcrypt hash (starts with $2a$ or $2b$)
  if (hashOrPlain.startsWith('$2a$') || hashOrPlain.startsWith('$2b$')) {
    try {
      return await bcrypt.compare(plainPassword, hashOrPlain);
    } catch {
      return false;
    }
  }

  // Legacy plain text check
  return plainPassword === hashOrPlain;
}

// 2. Cryptographic Signed Session Tokens (HttpOnly Cookie / Bearer Token)
export function createSessionToken(user: UserProfile, ttlMs = TOKEN_TTL_MS): string {
  const now = Date.now();
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email.toLowerCase(),
    role: user.role === 'ADMIN' ? 'ADMIN' : 'PARTICIPANT',
    iat: now,
    exp: now + ttlMs
  };

  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadEncoded)
    .digest('base64url');

  return `${payloadEncoded}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadEncoded, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadEncoded)
    .digest('base64url');

  // Timing safe comparison to prevent timing attacks
  try {
    const isSigMatch = crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
    if (!isSigMatch) return null;

    const payloadJson = Buffer.from(payloadEncoded, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as SessionPayload;

    // Check expiration
    if (!payload.exp || Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// 3. Data Sanitization - Shield all API keys, Passwords and Hashes from responses
export function sanitizeUser(user: UserProfile): UserProfile {
  const sanitized: UserProfile = { ...user };
  delete sanitized.password;
  delete sanitized.passwordHash;
  return sanitized;
}

export function sanitizeLeagueState(state: LeagueState): LeagueState {
  return {
    ...state,
    users: (state.users || []).map(sanitizeUser)
  };
}

// 4. Strict Server-Side Input Validation
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function sanitizeInputString(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '') // strip dangerous HTML tags
    .trim();
}

export function validateEmail(email: unknown): { valid: boolean; email?: string; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'O email é obrigatório.' };
  }
  const clean = email.trim().toLowerCase();
  if (clean.length > 100) {
    return { valid: false, error: 'O email deve ter no máximo 100 caracteres.' };
  }
  if (!EMAIL_REGEX.test(clean)) {
    return { valid: false, error: 'Por favor, informe um endereço de email válido.' };
  }
  return { valid: true, email: clean };
}

export function validatePassword(password: unknown): { valid: boolean; password?: string; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'A senha é obrigatória.' };
  }
  const trimmed = password.trim();
  if (trimmed.length < 4) {
    return { valid: false, error: 'A senha deve conter no mínimo 4 caracteres.' };
  }
  if (trimmed.length > 100) {
    return { valid: false, error: 'A senha deve conter no máximo 100 caracteres.' };
  }
  return { valid: true, password: trimmed };
}

export function validateString(
  val: unknown,
  fieldName: string,
  minLen = 1,
  maxLen = 100
): { valid: boolean; value?: string; error?: string } {
  if (val === undefined || val === null || typeof val !== 'string') {
    return { valid: false, error: `${fieldName} é obrigatório.` };
  }
  const sanitized = sanitizeInputString(val);
  if (sanitized.length < minLen) {
    return { valid: false, error: `${fieldName} deve conter pelo menos ${minLen} caractere(s).` };
  }
  if (sanitized.length > maxLen) {
    return { valid: false, error: `${fieldName} deve conter no máximo ${maxLen} caracteres.` };
  }
  return { valid: true, value: sanitized };
}

export function validatePositiveInteger(
  val: unknown,
  fieldName: string,
  min = 1,
  max = 2000000000
): { valid: boolean; value?: number; error?: string } {
  const num = Number(val);
  if (isNaN(num) || !Number.isFinite(num) || num < min || num > max) {
    return { valid: false, error: `${fieldName} deve ser um valor válido entre ${min} e ${max}.` };
  }
  return { valid: true, value: Math.floor(num) };
}

export const VALID_POSITIONS = ['GOL', 'ZAG', 'LE', 'LD', 'VOL', 'MC', 'MEI', 'ATA', 'PD', 'PE', 'MD', 'ME', 'SA'] as const;

export function validatePosition(pos: unknown): { valid: boolean; position?: string; error?: string } {
  if (!pos || typeof pos !== 'string') {
    return { valid: false, error: 'Posição do atleta é obrigatória.' };
  }
  const upper = pos.trim().toUpperCase();
  if (!VALID_POSITIONS.includes(upper as typeof VALID_POSITIONS[number])) {
    return { valid: false, error: `Posição inválida. Permitidas: ${VALID_POSITIONS.join(', ')}` };
  }
  return { valid: true, position: upper };
}

// 5. Row-Level Security (RLS) Checks
export function checkRLSOwnership(
  actorUserId: string,
  targetResourceId: string,
  actorRole?: string
): boolean {
  if (!actorUserId) return false;
  if (actorRole === 'ADMIN') return true;
  return actorUserId === targetResourceId;
}

// 6. Safe Upload Validation (MIME check, Magic Bytes check, Size limit)
const ALLOWED_UPLOAD_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB

export function validateUploadBuffer(
  buffer: Buffer,
  declaredMimeType: string
): { valid: boolean; ext?: string; mime?: string; error?: string } {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'Arquivo vazio.' };
  }

  if (buffer.length > MAX_UPLOAD_BYTES) {
    return { valid: false, error: 'O tamanho do arquivo excede o limite máximo de 2 MB.' };
  }

  const cleanMime = declaredMimeType?.toLowerCase().trim();
  if (!ALLOWED_UPLOAD_MIMES.includes(cleanMime)) {
    return { valid: false, error: 'Formato de imagem não permitido. Use JPEG, PNG, WEBP ou GIF.' };
  }

  // Magic bytes inspection
  // JPEG: FF D8 FF
  if (cleanMime === 'image/jpeg' || cleanMime === 'image/jpg') {
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { valid: true, ext: 'jpg', mime: 'image/jpeg' };
    }
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (cleanMime === 'image/png') {
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return { valid: true, ext: 'png', mime: 'image/png' };
    }
  }

  // GIF: 47 49 46 38
  if (cleanMime === 'image/gif') {
    if (
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38
    ) {
      return { valid: true, ext: 'gif', mime: 'image/gif' };
    }
  }

  // WEBP: RIFF (52 49 46 46) ... WEBP (57 45 42 50)
  if (cleanMime === 'image/webp') {
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46
    ) {
      return { valid: true, ext: 'webp', mime: 'image/webp' };
    }
  }

  return { valid: false, error: 'Assinatura binária do arquivo não corresponde a uma imagem válida.' };
}
