import crypto from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function getFlagHmacSecret(): string {
  return process.env.FLAG_HMAC_SECRET || 'kali3977-dev-ephemeral-flag-secret-change-in-prod';
}

export function hashFlag(flag: string, secret: string = getFlagHmacSecret()): string {
  const normalized = flag.trim();
  return crypto.createHmac('sha256', secret).update(normalized, 'utf8').digest('hex');
}

export function verifyFlagConstantTime(
  submitted: string,
  expectedHash: string,
  secret: string = getFlagHmacSecret(),
): boolean {
  if (!submitted || !expectedHash || expectedHash.length !== 64) {
    return false;
  }
  const candidateHash = hashFlag(submitted, secret);
  const a = Buffer.from(candidateHash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function maskFlag(flag: string): string {
  const trimmed = flag.trim();
  if (trimmed.length <= 6) return '***';
  return `${trimmed.slice(0, 4)}***${trimmed.slice(-2)}`;
}

export function generateSecureCode(prefix: string, segments: number = 2): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const parts: string[] = [prefix.toUpperCase()];
  for (let s = 0; s < segments; s++) {
    let seg = '';
    const bytes = crypto.randomBytes(4);
    for (let i = 0; i < 4; i++) {
      seg += chars[bytes[i] % chars.length];
    }
    parts.push(seg);
  }
  return parts.join('-');
}

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function generateTotpCode(secret: string, timeMs: number = Date.now(), stepSeconds: number = 30): string {
  const counter = Math.floor(timeMs / 1000 / stepSeconds);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuf.writeUInt32BE(counter >>> 0, 4);

  const key = base32Decode(secret);
  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binary % 1000000).toString().padStart(6, '0');
}

export function verifyTotpCode(secret: string, token: string, timeMs: number = Date.now()): boolean {
  const cleaned = token.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleaned)) return false;

  for (const drift of [-1, 0, 1]) {
    const expected = generateTotpCode(secret, timeMs + drift * 30_000);
    if (crypto.timingSafeEqual(Buffer.from(cleaned), Buffer.from(expected))) {
      return true;
    }
  }
  return false;
}

export function buildTotpOtpAuthUri(email: string, secret: string, issuer: string = 'KALI3977'): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function sanitizeText(input: string, maxLength: number = 2000): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

export function detectSuspiciousInput(input: string): { isSuspicious: boolean; signals: string[] } {
  const signals: string[] = [];
  if (/(\bUNION\b\s+\bSELECT\b|\bDROP\b\s+\bTABLE\b|;\s*--\s*$|\bOR\b\s+1\s*=\s*1)/i.test(input)) {
    signals.push('sql_injection_pattern');
  }
  if (/(<script\b|javascript:|onerror\s*=|onload\s*=)/i.test(input)) {
    signals.push('xss_payload_pattern');
  }
  return {
    isSuspicious: signals.length > 0,
    signals,
  };
}
