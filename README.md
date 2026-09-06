# WowBingo Voucher Web

Recharge WowBingo game credits from anywhere via hardware-locked voucher codes. This is the web version of `Voucher_Generator-GUI` — it generates **byte-compatible** voucher codes that existing offline game PCs already accept, with no changes to the game.

| Layer | Technology |
|---|---|
| Backend | NestJS (TypeScript) + Prisma ORM |
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Database | PostgreSQL (Neon free tier on Vercel) |
| Auth | JWT + Passport (12h tokens, ADMIN / AGENT roles) |
| Deploy | Vercel (two projects) |

## How it works

The web app ports the game's voucher engine (`compact_external_voucher.py`) 1:1 to TypeScript (`api/src/voucher/voucher-codec.ts`):

- 20-byte payload: `type(0x01)` + `SHA256(cleanUuid)[:4]` + random 24-bit id + `amount(3B)` + `share(1B)` + `expiryDays(2B epoch days, 0 = never)` + `HMAC-SHA256[:6]`
- Crockford Base32 → 32 chars formatted `XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XX`
- Game PCs validate **purely cryptographically** (no server contact) and record redemption locally, so web codes redeem exactly like GUI-generated ones
- The web DB tracks status for bookkeeping: `ACTIVE → REDEEMED / REVOKED`, `EXPIRED` computed. Game PC redemption remains the source of truth.

Verified: `api/test/parity.ts` cross-validates TS↔Python in both directions (`PARITY GATE PASSED`), and unit tests cover tamper, expiry, UUID binding, and format.

**Secrets.** By default codes are signed with the derived master secret (`SHA256("WOW_GAMES_BINGO_MASTER_VOUCHER_KEY_2026")`) — the same fallback field game PCs use. If your game PCs ship a custom `keys/voucher_secret.bin`, set `VOUCHER_SECRET_HEX` on the API to that file's hex. The repo's dev key is `381cdb70e3a8d020310e7d9daa2e011ef588045bcd245cd1e031a221606f28e6` (32 bytes).

## Roles

| Capability | ADMIN | AGENT |
|---|---|---|
| Register game PCs (UUID + owner info) | ✓ | ✓ |
| Edit / delete PCs | ✓ | — |
| Generate vouchers | ✓ | ✓ |
| Validate a code | ✓ | ✓ |
| Mark voucher redeemed | ✓ | ✓ |
| Revoke voucher | ✓ | — |
| Manage users | ✓ | — |

Every mutation is written to `AuditLog`.

## Repository layout

```
wowbingo-voucher-web/
├── api/            NestJS + Prisma (Vercel serverless)
│   ├── index.ts            serverless entry (Vercel)
│   ├── prisma/             schema, migrations, seed
│   ├── src/                auth, users, stations, vouchers, health, codec
│   └── test/               codec.spec.ts, parity.ts, py_bridge.py, e2e.ps1
├── web/            Next.js 14 App Router + Tailwind
│   ├── app/(auth)/login    sign-in / first-admin bootstrap
│   ├── app/(app)/…         dashboard, stations, vouchers, generate, users
│   └── lib/                api client, auth context
└── docker-compose.yml      local Postgres for development
```

## Local development

```bash
# 1. Postgres (either docker or your own)
cd wowbingo-voucher-web
docker compose up -d

# 2. API
cd api
cp .env.example .env         # fill DATABASE_URL/DIRECT_URL/JWT_SECRET
npm install                  # also runs prisma generate
npx prisma migrate deploy
npm run seed                 # admin: admin@wowbingo.local / ChangeMe!2026 (or ADMIN_* env)
npm run start:dev            # http://localhost:3001/api

# 3. Web
cd ../web
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:3001
npm install
npm run dev                  # http://localhost:3000
```

### Tests

```bash
cd api
npm test            # 11 codec unit tests
npm run test:parity # Python↔TS cross-parity gate (needs python on PATH)
```

`test/e2e.ps1` is a full HTTP E2E suite (auth, RBAC, stations, generation, validation, redemption, revocation) — it needs a reachable DB and a running API.

## Deploy to Vercel + Neon (free)

1. **Neon**: create a project → copy the **pooled** connection string (`...-pooler...`) and the **direct** one.
2. **Push this folder to a Git repo** (it can live inside your game repo; set Root Directory per project below).
3. **Vercel project A — API**
   - Root Directory: `wowbingo-voucher-web/api` (Framework preset: Other)
   - Env vars:
     - `DATABASE_URL` = pooled URL
     - `DIRECT_URL` = direct URL
     - `JWT_SECRET` = long random string
     - `VOUCHER_SECRET_HEX` = *(optional, see Secrets above)*
     - `CORS_ORIGIN` = `https://<your-web-project>.vercel.app`
4. **Apply migrations once** from your machine:
   ```bash
   cd api
   DATABASE_URL="<direct-url>" npx prisma migrate deploy
   ```
5. **Vercel project B — Web**
   - Root Directory: `wowbingo-voucher-web/web` (auto-detected Next.js)
   - Env var: `NEXT_PUBLIC_API_URL` = `https://<api-project>.vercel.app`
6. Open the web app → it detects there are no users → **Create admin account** → add agents under *Users*.

> Note: Next.js is pinned to 14.2.35 (latest 14.x, includes the Dec-2025 patches). `npm audit` may list advisories fixed only in Next 15/16 — most do not apply to this app (no middleware, no next/image, SSRF/DoS classes mitigated by Vercel's platform). Upgrade the major when you're ready.

## Operator runbook

1. On each game PC run `get_machine_uuid.py` (or the `.bat`) → copy the UUID.
2. In the web app → **Game PCs** → *Register PC*: paste UUID, add station name, owner full name, phone, address.
3. **Generate** → pick the PC, credit amount (presets or custom), validity days (`0` = never expires), commission share %, count → **Copy all** or **Print** (printable sheet includes owner + UUID for the receipt).
4. The PC owner redeems in-game (Recharge dialog). The code works only on that machine UUID, once.
5. Bookkeeping: **Vouchers** page shows status; use *Mark redeemed* when the PC confirms recharge, *Revoke* (admin) to kill an unused code.

**Validate tool** (Vouchers page): paste any code + a UUID to check binding, amount, share, and expiry before handing it over.

**Secret doctor:** generate one code in the web app and try redeeming on a real game PC. If the PC says *Invalid security signature*, that PC has a custom key file — set `VOUCHER_SECRET_HEX` to that machine's `keys/voucher_secret.bin` hex (`[BitConverter]::ToString([IO.File]::ReadAllBytes('keys\voucher_secret.bin')).Replace('-','')`) and redeploy.

## API reference

All routes are prefixed with `/api`. Auth via `Authorization: Bearer <token>`.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | public | liveness |
| GET | `/auth/has-users` | public | first-run detection |
| POST | `/auth/bootstrap` | public (no users yet) | create first ADMIN |
| POST | `/auth/login` | public | returns `{accessToken, user}` |
| GET | `/auth/me` | any | current user |
| GET/POST | `/users` | ADMIN | list / create users |
| PATCH | `/users/:id` | ADMIN | role, active, password, name |
| GET | `/stations` | any | list PCs (+voucher counts) |
| POST | `/stations` | any | register PC |
| PATCH/DELETE | `/stations/:id` | ADMIN | edit / delete (no vouchers attached) |
| POST | `/vouchers` | any | generate `{stationId, amount 1..16777215, daysValid 0..65535 (0=never), share 0..100, count 1..50, note}` |
| GET | `/vouchers` | any | paginated, filters `stationId`, `status=ACTIVE/EXPIRED/REDEEMED/REVOKED` |
| GET | `/vouchers/stats` | any | dashboard aggregates |
| POST | `/vouchers/validate` | any | codec check + optional DB record lookup |
| POST | `/vouchers/:id/redeem` | any | mark redeemed (ACTIVE only) |
| POST | `/vouchers/:id/revoke` | ADMIN | revoke |

## Security notes

- Voucher codes are HMAC-signed; the secret never leaves the server. Do not commit `VOUCHER_SECRET_HEX`.
- Codes cannot be forged to change amount/UUID/expiry (48-bit truncated HMAC over the full payload).
- Double-spend is enforced on the game PC (local used-codes ledger) exactly like GUI vouchers; web status is advisory.
- Passwords are bcrypt-hashed; JWTs expire in 12h; login is rate-limited.
- Expiry semantics: a `daysValid=N` voucher stops working at the start of the (N+1)-th day (UTC), matching the game's strictest gate.

## Verification results (this workspace)

- `npm run build` — API ✓, Web ✓
- `npm test` — 11/11 codec tests ✓
- `npm run test:parity` — PARITY GATE PASSED (TS→PY, PY→TS, master default, custom repo key, tamper rejection) ✓
- `test/e2e.ps1` — 25/25 checks ✓ against PostgreSQL 16 (auth, RBAC, station CRUD, batch generation, validation tool, redeem/revoke, audit)
