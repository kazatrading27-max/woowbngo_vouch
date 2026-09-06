import { createHash, createHmac } from 'crypto';

export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const MASTER_DEFAULT_SECRET_SEED = 'WOW_GAMES_BINGO_MASTER_VOUCHER_KEY_2026';

export interface CodecValidationResult {
  valid: boolean;
  message: string;
  amount?: number;
  share?: number;
  expiry?: number;
  voucherId?: number;
  type?: number;
  uuidHash?: string;
}

export function getMasterSecret(): Buffer {
  return createHash('sha256').update(MASTER_DEFAULT_SECRET_SEED, 'ascii').digest();
}

export function getGenerationSecret(): Buffer {
  const hex = (process.env.VOUCHER_SECRET_HEX || '').trim();
  if (hex) {
    const buf = Buffer.from(hex, 'hex');
    if (buf.length >= 16) return buf;
  }
  return getMasterSecret();
}

export function getValidationCandidateSecrets(): Buffer[] {
  const candidates: Buffer[] = [];
  const hex = (process.env.VOUCHER_SECRET_HEX || '').trim();
  if (hex) {
    const buf = Buffer.from(hex, 'hex');
    if (buf.length >= 16) candidates.push(buf);
  }
  const master = getMasterSecret();
  if (!candidates.some((c) => c.equals(master))) candidates.push(master);
  const rawSeed = Buffer.from(MASTER_DEFAULT_SECRET_SEED, 'ascii');
  if (!candidates.some((c) => c.equals(rawSeed))) candidates.push(rawSeed);
  return candidates;
}

/**
 * Crockford Base32 encode — bit-exact with the Python implementation.
 * Uses BigInt internally so multi-byte accumulation (value << 8 | byte) can
 * never lose precision (Python has arbitrary-precision ints; JS Number does not).
 */
export function encodeBase32(data: Buffer): string {
  let result = '';
  let bits = 0;
  let value = 0n;

  for (const byte of data) {
    value = (value << 8n) | BigInt(byte);
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      const index = Number((value >> BigInt(bits)) & 0x1fn);
      result += CROCKFORD_ALPHABET[index];
    }
  }
  if (bits > 0) {
    const index = Number((value & ((1n << BigInt(bits)) - 1n)) << BigInt(5 - bits));
    result += CROCKFORD_ALPHABET[index];
  }
  return result;
}

export function decodeBase32(encoded: string): Buffer {
  const result: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of encoded) {
    const index = CROCKFORD_ALPHABET.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      result.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(result);
}

export function cleanUuid(uuidStr: string): string {
  return uuidStr.replace(/-/g, '').trim().toUpperCase();
}

export function uuidHash(uuidStr: string): Buffer {
  return createHash('sha256').update(cleanUuid(uuidStr), 'utf8').digest().subarray(0, 4);
}

function hmacSha256(message: Buffer, key: Buffer): Buffer {
  return createHmac('sha256', key).update(message).digest();
}

export function formatCode(rawB32: string): string {
  const chunks: string[] = [];
  for (let i = 0; i < rawB32.length; i += 5) {
    chunks.push(rawB32.slice(i, i + 5));
  }
  return chunks.join('-');
}

export interface MakeVoucherOptions {
  uuid: string;
  amount: number;
  daysValid?: number;
  share?: number;
  /** explicit 24-bit id for deterministic tests; random when omitted */
  voucherId?: number;
}

export function makeVoucherBytes(opts: MakeVoucherOptions): {
  code: string;
  formattedCode: string;
  combined: Buffer;
  expDays: number;
} {
  const amount = Math.max(1, Math.min(16777215, Math.floor(opts.amount)));
  const daysValid = Math.max(0, Math.min(65535, Math.floor(opts.daysValid ?? 30)));
  const share = Math.max(0, Math.min(100, Math.floor(opts.share ?? 80)));

  const vType = Buffer.from([0x01]);
  const uHash = uuidHash(opts.uuid);
  const vid =
    opts.voucherId !== undefined
      ? Buffer.from([(opts.voucherId >> 16) & 0xff, (opts.voucherId >> 8) & 0xff, opts.voucherId & 0xff])
      : Buffer.from([Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)]);
  const amtBytes = Buffer.from([(amount >> 16) & 0xff, (amount >> 8) & 0xff, amount & 0xff]);
  const shareByte = Buffer.from([share]);

  const nowDays = Math.floor(Date.now() / 1000 / 86400);
  const expDays = daysValid > 0 ? nowDays + daysValid : 0;
  const expBytes = Buffer.from([(expDays >> 8) & 0xff, expDays & 0xff]);

  const payload = Buffer.concat([vType, uHash, vid, amtBytes, shareByte, expBytes]);
  const sig = hmacSha256(payload, getGenerationSecret()).subarray(0, 6);
  const combined = Buffer.concat([payload, sig]);

  const rawB32 = encodeBase32(combined);
  return { code: rawB32, formattedCode: formatCode(rawB32), combined, expDays };
}

export function validateVoucherCode(voucherCode: string, uuidStr?: string | null): CodecValidationResult {
  try {
    if (!voucherCode) return { valid: false, message: 'Empty voucher code' };

    const clean = voucherCode.trim().toUpperCase().replace(/-/g, '').replace(/ /g, '');

    for (const char of clean) {
      if (!CROCKFORD_ALPHABET.includes(char)) {
        return { valid: false, message: `Invalid character '${char}' in voucher` };
      }
    }

    if (clean.length !== 32) {
      return { valid: false, message: 'Invalid voucher code' };
    }

    const raw = decodeBase32(clean);
    if (raw.length !== 20) {
      return { valid: false, message: 'Invalid voucher code' };
    }

    const payload = raw.subarray(0, 14);
    const sig = raw.subarray(14, 20);

    let validSig = false;
    for (const k of getValidationCandidateSecrets()) {
      if (sig.equals(hmacSha256(payload, k).subarray(0, 6))) {
        validSig = true;
        break;
      }
    }
    if (!validSig) {
      return { valid: false, message: 'Invalid security signature' };
    }

    const vType = payload[0];
    const uHash = payload.subarray(1, 5);
    const voucherId = (payload[5] << 16) | (payload[6] << 8) | payload[7];
    const amount = (payload[8] << 16) | (payload[9] << 8) | payload[10];
    const share = payload[11];
    const expDays = (payload[12] << 8) | payload[13];

    if (vType === 1) {
      if (!uuidStr) {
        return { valid: false, message: 'Target machine UUID is required' };
      }
      const targetHash = uuidHash(uuidStr);
      if (!uHash.equals(targetHash)) {
        return { valid: false, message: 'Voucher is bound to a different machine UUID' };
      }
    } else if (vType === 2) {
      // universal — validator accepts for parity with game; this app never generates them
    } else {
      return { valid: false, message: 'Unknown voucher type' };
    }

    const expirySec = expDays > 0 ? expDays * 86400 : 0;
    if (expirySec > 0) {
      const nowDays = Math.floor(Date.now() / 1000 / 86400);
      if (nowDays > expDays) {
        return { valid: false, message: 'Voucher has expired' };
      }
    }

    return {
      valid: true,
      message: 'Voucher validated successfully',
      amount,
      share,
      expiry: expirySec,
      voucherId,
      type: vType,
      uuidHash: uHash.toString('hex').toUpperCase(),
    };
  } catch (e) {
    return { valid: false, message: `Validation error: ${e}` };
  }
}
