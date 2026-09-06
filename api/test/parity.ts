/**
 * Cross-parity gate: TS codec vs the game's Python implementation.
 *
 * Phase 1 (custom key, if the repo has keys/voucher_secret.bin):
 *   The Python generator loads that key when run from the repo root, so TS must be
 *   configured with the same key via VOUCHER_SECRET_HEX to interop.
 *   A) TS generates (custom key) → Python validates → must PASS
 *   B) Python generates (custom key) → TS validates → must PASS
 *
 * Phase 2 (derived master default, no env):
 *   C) TS generates (master) → Python validates via its candidate list → must PASS
 *
 * Uses test/py_bridge.py (imports CompactExternalVoucherGenerator directly) because
 * the game's argparse CLI crashes on Python 3.14 (a pre-existing game-code bug).
 *
 * Run: npm run test:parity
 */
import { execFileSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { makeVoucherBytes, validateVoucherCode } from '../src/voucher/voucher-codec';

const PY_CANDIDATES = ['python', 'python3', 'py'];
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const BRIDGE = path.join(__dirname, 'py_bridge.py');
const REPO_KEY = path.join(REPO_ROOT, 'keys', 'voucher_secret.bin');

function pythonBin(): string | null {
  for (const bin of PY_CANDIDATES) {
    try {
      execFileSync(bin, ['--version'], { stdio: 'ignore' });
      return bin;
    } catch {
      continue;
    }
  }
  return null;
}

function pyBridge(bin: string, args: string[]): any {
  const out = execFileSync(bin, [BRIDGE, ...args], {
    encoding: 'utf8',
    cwd: REPO_ROOT,
    timeout: 30000,
  });
  const line = out.trim().split(/\r?\n/).pop() || '';
  return JSON.parse(line);
}

const UUID = '4C4C4544-0046-4810-8035-B9C04F575A31';
const CASES = [
  { amount: 100, days: 30, share: 80 },
  { amount: 9750, days: 15, share: 15 },
  { amount: 16777215, days: 0, share: 100 },
  { amount: 1, days: 1, share: 0 },
];

let failures = 0;

function check(label: string, ok: boolean, detail: string) {
  console.log(`${label} => ${ok ? 'PASS' : 'FAIL'} ${detail}`);
  if (!ok) failures++;
}

function main() {
  if (!fs.existsSync(BRIDGE)) {
    console.error(`SKIP: bridge script not found at ${BRIDGE}`);
    return;
  }
  const bin = pythonBin();
  if (!bin) {
    console.error('SKIP: no python interpreter found on PATH');
    return;
  }
  console.log(`Python: ${bin}`);

  const sanity = pyBridge(bin, ['generate', UUID, '100', '30', '80']);
  if (!sanity.code) {
    console.error(`SKIP: python bridge failed: ${JSON.stringify(sanity)}`);
    return;
  }

  // Phase 1 — custom repo key (mirrors what the repo GUI uses)
  if (fs.existsSync(REPO_KEY)) {
    const keyHex = fs.readFileSync(REPO_KEY).toString('hex');
    process.env.VOUCHER_SECRET_HEX = keyHex;
    console.log(`Phase 1: custom key ${REPO_KEY} (${keyHex.slice(0, 16)}...)`);

    for (const c of CASES) {
      const { formattedCode } = makeVoucherBytes({ uuid: UUID, amount: c.amount, daysValid: c.days, share: c.share });
      const res = pyBridge(bin, ['validate', formattedCode, UUID]);
      check(
        `A) TS->PY ${formattedCode} amount=${c.amount} days=${c.days} share=${c.share}`,
        res.valid === true && res.amount === c.amount && res.share === c.share,
        JSON.stringify(res),
      );
    }

    for (const c of CASES) {
      const gen = pyBridge(bin, ['generate', UUID, String(c.amount), String(c.days), String(c.share)]);
      const res = validateVoucherCode(gen.code, UUID);
      check(
        `B) PY->TS ${gen.code} amount=${c.amount} days=${c.days} share=${c.share}`,
        res.valid === true && res.amount === c.amount && res.share === c.share,
        JSON.stringify(res),
      );
    }
    delete process.env.VOUCHER_SECRET_HEX;
  } else {
    console.log('Phase 1: skipped (no custom key in repo)');
  }

  // Phase 2 — derived master default
  console.log('Phase 2: derived master default secret');
  for (const c of CASES) {
    const { formattedCode } = makeVoucherBytes({ uuid: UUID, amount: c.amount, daysValid: c.days, share: c.share });
    const res = pyBridge(bin, ['validate', formattedCode, UUID]);
    check(
      `C) TS(master)->PY ${formattedCode} amount=${c.amount} days=${c.days} share=${c.share}`,
      res.valid === true && res.amount === c.amount && res.share === c.share,
      JSON.stringify(res),
    );
  }

  // Negative: tampered code rejected by both sides
  const { formattedCode } = makeVoucherBytes({ uuid: UUID, amount: 500, daysValid: 5, share: 50 });
  const last = formattedCode.slice(-1);
  const tampered = formattedCode.slice(0, -1) + (last === '0' ? '1' : '0');
  const pyRes = pyBridge(bin, ['validate', tampered, UUID]);
  const tsRes = validateVoucherCode(tampered, UUID);
  check('N) tampered rejected by both', pyRes.valid === false && tsRes.valid === false, '');

  if (failures > 0) {
    console.error(`PARITY GATE FAILED: ${failures} failure(s)`);
    process.exit(1);
  }
  console.log('PARITY GATE PASSED: TS codec is byte-compatible with the game validator.');
}

main();
