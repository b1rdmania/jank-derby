# Jank Derby — DevNet Deployment Handoff (Validator Team)

This document is what you hand to the validator/operators so you can self-serve DevNet deployment and testing.

## What you (the app team) will do

- Upload the DAR to DevNet participant
- Allocate or use pre-allocated parties (Operator + demo players)
- Run the operator backend (creates races, commit-reveal, ticks, settles)
- Run the frontend (or deploy it) pointing at the backend

## What you need from the validator team (minimal, no ongoing workflow)

### 1) Network access

- VPN / routing instructions (if DevNet is private)
- **Base URL for JSON Ledger API v2** (e.g. `https://<host>:<port>`)
- Confirmation whether websockets are enabled (optional; this demo falls back to polling)

### 2) Auth (prefer “scoped self-serve”, avoid sharing admin credentials)

One of:

- **OAuth client** you control for DevNet JSON API
- Or a **JWT signing setup** where you can mint scoped tokens for:
  - `actAs` = Operator party
  - `actAs` = Player parties (for deposits + ClaimPayout)

If they insist on “login details”, ask for a **scoped dev account** (not shared admin).

### 3) Ledger permissions

- Permission to **upload DARs** to their DevNet participant
- Permission to **allocate parties** (or they can allocate once and hand you the party IDs)

## What to prepare before touching DevNet

### A) Version the build artifact

- Build the DAR:

```bash
export PATH="$HOME/.daml/bin:$PATH"
cd jank-derby
daml build
```

Output: `jank-derby/.daml/dist/jank-derby-0.0.1.dar`

### B) Capture the package-id (used by the backend for template identifiers)

```bash
export PATH="$HOME/.daml/bin:$PATH"
cd jank-derby
daml damlc inspect-dar .daml/dist/jank-derby-0.0.1.dar
```

You’ll see a line like:

- `jank-derby-0.0.1-<PACKAGE_ID>/...`

Set:

- `DAML_PACKAGE_ID=<PACKAGE_ID>`

## DevNet runbook (high-level)

### 1) Upload DAR to DevNet

Use JSON Ledger API v2 package upload endpoint (exact host/port from validator team):

- `POST /v2/packages` (or `/v2/dars`)

### 2) Parties

Decide one of:

- **They allocate parties and give you the full party IDs**, or
- **You allocate**:
  - `Operator`
  - `Alice`, `Bob` (demo players)

### 3) Configure backend

Set env:

- `DAML_JSON_API_URL=<devnet json api base url>`
- `DAML_PACKAGE_ID=<package id from DAR>`
- `OPERATOR_PARTY_HINT=<your operator party hint or name>`
- `DEMO_PLAYERS=Alice,Bob`
- Auth token env (if required by DevNet): `DAML_ACCESS_TOKEN=<token>`

Then run:

```bash
cd jank-derby/backend
npm install
npm run dev
```

### 4) Bootstrap and smoke test

```bash
curl -X POST <backend>/api/bootstrap
curl -X POST <backend>/api/races -H 'Content-Type: application/json' -d '{"bettingSeconds":30}'
```

Then place a bet via UI or:

```bash
curl -X POST <backend>/api/races/<raceId>/bet \
  -H 'Content-Type: application/json' \
  -d '{"player":"Alice","horse":"Green","amount":10}'
```

### 5) Frontend

Run locally or deploy (Vercel etc). Point it at the backend with:

- `VITE_BACKEND_URL=<backend base url>`

## Notes / limitations (current demo)

- Uses JSON Ledger API v2 endpoints (`/v2/...`).
- Uses **package-id template identifiers** (`<packageId>:HorseRaceSecure:Race` etc).
- Backend auto-settles bets and auto-claims payouts for demo players.
- Frontend has polling fallback; websockets are optional.

