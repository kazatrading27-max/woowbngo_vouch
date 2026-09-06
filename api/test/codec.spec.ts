import {
  CROCKFORD_ALPHABET,
  encodeBase32,
  decodeBase32,
  makeVoucherBytes,
  validateVoucherCode,
  getMasterSecret,
} from '../src/voucher/voucher-codec';

const UUID = '4C4C4544-0046-4810-8035-B9C04F575A31';

describe('voucher-codec (parity with compact_external_voucher.py)', () => {
  it('derives the master secret deterministically', () => {
    const a = getMasterSecret();
    const b = getMasterSecret();
    expect(a.equals(b)).toBe(true);
    expect(a.length).toBe(32);
  });

  it('encodes/decodes Base32 losslessly for 20 bytes', () => {
    const buf = Buffer.alloc(20);
    for (let i = 0; i < 20; i++) buf[i] = (i * 37 + 11) % 256;
    const enc = encodeBase32(buf);
    expect(enc.length).toBe(32);
    expect(decodeBase32(enc).equals(buf)).toBe(true);
  });

  it('round-trips a generated voucher with the same UUID', () => {
    const { formattedCode } = makeVoucherBytes({ uuid: UUID, amount: 9750, daysValid: 30, share: 15, voucherId: 42 });
    const res = validateVoucherCode(formattedCode, UUID);
    expect(res.valid).toBe(true);
    expect(res.amount).toBe(9750);
    expect(res.share).toBe(15);
    expect(res.voucherId).toBe(42);
  });

  it('formats as XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XX', () => {
    const { formattedCode } = makeVoucherBytes({ uuid: UUID, amount: 100, daysValid: 30, share: 80 });
    expect(formattedCode.split('-').map((c) => c.length).join('-')).toBe('5-5-5-5-5-5-2');
    expect(formattedCode.replace(/-/g, '').length).toBe(32);
  });

  it('rejects wrong UUID', () => {
    const { formattedCode } = makeVoucherBytes({ uuid: UUID, amount: 100, daysValid: 30, share: 80 });
    const res = validateVoucherCode(formattedCode, 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE');
    expect(res.valid).toBe(false);
    expect(res.message).toBe('Voucher is bound to a different machine UUID');
  });

  it('rejects tampered code (signature failure)', () => {
    const { formattedCode } = makeVoucherBytes({ uuid: UUID, amount: 100, daysValid: 30, share: 80 });
    const chars = formattedCode.split('');
    const idx = CROCKFORD_ALPHABET.indexOf(chars[0]);
    chars[0] = CROCKFORD_ALPHABET[(idx + 1) % CROCKFORD_ALPHABET.length];
    const res = validateVoucherCode(chars.join(''), UUID);
    expect(res.valid).toBe(false);
    expect(res.message).toBe('Invalid security signature');
  });

  it('handles never-expiring vouchers (daysValid=0)', () => {
    const { formattedCode } = makeVoucherBytes({ uuid: UUID, amount: 100, daysValid: 0, share: 80 });
    const res = validateVoucherCode(formattedCode, UUID);
    expect(res.valid).toBe(true);
    expect(res.expiry).toBe(0);
  });

  it('rejects expired vouchers', () => {
    const nowDays = Math.floor(Date.now() / 1000 / 86400);
    const { formattedCode, expDays } = makeVoucherBytes({ uuid: UUID, amount: 100, daysValid: 1, share: 80 });
    expect(expDays).toBe(nowDays + 1);
    jest.spyOn(Date, 'now').mockReturnValue((expDays + 2) * 86400 * 1000);
    const res = validateVoucherCode(formattedCode, UUID);
    (Date.now as jest.Mock).mockRestore();
    expect(res.valid).toBe(false);
    expect(res.message).toBe('Voucher has expired');
  });

  it('rejects codes with invalid characters or wrong length', () => {
    expect(validateVoucherCode('!!!!').valid).toBe(false);
    expect(validateVoucherCode('ABCDEF').valid).toBe(false);
    expect(validateVoucherCode('A'.repeat(40), UUID).valid).toBe(false);
  });

  it('requires a UUID for targeted vouchers', () => {
    const { formattedCode } = makeVoucherBytes({ uuid: UUID, amount: 100, daysValid: 30, share: 80 });
    const res = validateVoucherCode(formattedCode, undefined);
    expect(res.valid).toBe(false);
    expect(res.message).toBe('Target machine UUID is required');
  });

  it('ignores dashes/case in input code and uuid (trim only, like Python)', () => {
    const { formattedCode } = makeVoucherBytes({ uuid: '4c4c4544-0046-4810-8035-b9c04f575a31', amount: 100, daysValid: 30, share: 80 });
    const res = validateVoucherCode(formattedCode.toLowerCase(), '  4c4c4544004648108035b9c04f575a31  ');
    expect(res.valid).toBe(true);
  });
});
