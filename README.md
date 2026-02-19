# Jank Derby (Canton / Daml) — Local Demo

This repo contains:

- **`daml/`**: Daml smart contracts (commit-reveal RNG + tick-based race)
- **`backend/`**: Operator backend (TypeScript) that drives races via JSON Ledger API v2
- **`frontend/`**: React UI (bets + janky race canvas)

## Prereqs

- Daml SDK installed (this project uses `sdk-version: 3.4.8` in `daml.yaml`)
- Node.js (for backend + frontend)

## Run locally (Sandbox + JSON API)

### 1) Start the ledger + JSON API

From `jank-derby/`:

```bash
export PATH="$HOME/.daml/bin:$PATH"
daml start --sandbox-port 6865 --json-api-port 7575 --wait-for-signal yes
```

This builds the DAR, uploads it, and starts the **JSON Ledger API v2** on `http://localhost:7575`.

### 2) Start the backend

In a second terminal:

```bash
cd backend
npm install
npm run dev
```

The backend listens on `http://localhost:4001`.

### 3) Start the frontend

In a third terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Notes

- The backend talks to **JSON Ledger API v2** (endpoints under `/v2/...`).
- Template identifiers are sent in the (deprecated, but supported) **package-id format**:
  - `"<packageId>:HorseRaceSecure:Race"`, etc.
  - For local dev, `backend/.env` is pre-filled with `DAML_PACKAGE_ID`.

