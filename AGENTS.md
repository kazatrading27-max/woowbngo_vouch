# AGENTS.md

WowBingo Voucher Web — generates hardware-locked voucher codes for offline game PCs over the web. It is a TypeScript port of the desktop GUI (`Voucher_Generator-GUI`); codes must remain **byte-compatible** with what existing game PCs already validate.

## Layout

- `api/` — NestJS 10 + Prisma 5 backend (Vercel serverless, entry `api/index.ts`, routes prefixed `/api`)
  - `src/voucher/voucher-codec.ts` — the codec: pure crypto/format logic, **no DB, no NestJS imports**
  - `src/vouchers/` — NestJS module that uses the codec + Prisma (generation, validate, redeem, revoke, stats)
  - `src/auth/`, `src/users/`, `src/stations/`, `src/common/`, `src/prisma/` — JWT auth (12h tokens), ADMIN/AGENT RBAC, audit logging
  - `prisma/` — schema, migrations, seed
  - `test/` — `codec.spec.ts` (unit), `parity.ts` + `py_bridge.py` (TS↔Python cross-parity), `e2e.ps1`, `history-e2e.ps1` (HTTP E2E, need running API + DB)
  - `Voucher_Generator-GUI/` — reference desktop implementation incl. original Python voucher engine; do not modify
- `web/` — Next.js 14 (App Router) + Tailwind frontend
  - `app/(auth)/login`, `app/(app)/{dashboard,stations,vouchers,users}`, `lib/` (API client, auth context, types)
- `docker-compose.yml` — local Postgres 16 (`postgres:postgres@localhost:5432/wowbingo`)

## Commands

```bash
docker compose up -d                 # local Postgres (from repo root)

# API (cd api)
npm install                          # postinstall runs prisma generate
cp .env.example .env                 # DATABASE_URL / DIRECT_URL / JWT_SECRET
npx prisma migrate deploy
npm run seed                         # admin: admin@wowbingo.local / ChangeMe!2026
npm run start:dev                    # API on http://localhost:3001/api
npm test                             # codec unit tests (jest, test/*.spec.ts)
npm run test:parity                  # Python↔TS parity gate — needs python on PATH
npm run build

# Web (cd web)
cp .env.example .env.local           # NEXT_PUBLIC_API_URL=http://localhost:3001
npm run dev                          # http://localhost:3000
npm run build
```

There is no lint config in either package. `api/test/e2e.ps1` and `history-e2e.ps1` are PowerShell — run from Git Bash via `powershell -File`.

## Critical rules

- **Codec compatibility is the hard constraint.** `voucher-codec.ts` mirrors the game's Python engine 1:1 (20-byte payload, HMAC-SHA256[:6], Crockford Base32, `XXXXX-…-XX` format). Any change to payload layout, hashing, or encoding breaks every deployed game PC. After touching the codec, `npm run test:parity` must print `PARITY GATE PASSED`.
- **Secret derivation**: default signing secret is `SHA256("WOW_GAMES_BINGO_MASTER_VOUCHER_KEY_2026")`; a machine with a custom `keys/voucher_secret.bin` overrides via `VOUCHER_SECRET_HEX`. Never commit real secrets (`.env` is gitignored; the committed dev key under `api/data/` is for local testing only).
- **Expiry semantics**: `daysValid=N` expires at the start of the (N+1)-th day UTC — matches the game's strictest gate. `0` = never expires.
- **Web DB status (`ACTIVE/REDEEMED/REVOKED`, `EXPIRED` computed) is bookkeeping only.** The game PC's local used-codes ledger is the source of truth for redemption.
- **Every mutation writes an `AuditLog`** — new mutating endpoints must do the same.
- **RBAC**: AGENT can register PCs, generate, validate, redeem; ADMIN-only: edit/delete PCs, revoke, manage users. Wire new routes through the existing guards.
- **Next.js is pinned to 14.2.35** deliberately (latest 14.x with Dec-2025 patches); known `npm audit` advisories are accepted until a deliberate major upgrade.

## Environment notes

- Dev machine is Windows (Git Bash shell); paths in scripts may use PowerShell specifics.
- Deployment is two separate Vercel projects rooted at `api/` and `web/`, with a Neon Postgres (pooled `DATABASE_URL` + direct `DIRECT_URL`).
- Full API route table and operator runbook: see `README.md` — read it before changing auth, RBAC, or voucher flow.
