# Canter Derby — Claude Context

## What this project is
Provably fair horse racing betting game on the Canton Network (Digital Asset's enterprise blockchain). 5 horses (Red/Blue/Green/Yellow/Purple), commit-reveal SHA256 RNG, DAML smart contracts.

## Status
- Frontend: live at https://jank-derby.vercel.app
- Mock backend (no Canton): live at https://canter-derby-mock-production.up.railway.app
- DAML contracts: written, tested, awaiting validator approval for DevNet deployment
- Real Canton backend: local only, not deployed

## Key URLs
- Frontend (Vercel): https://jank-derby.vercel.app
- Mock backend (Railway): https://canter-derby-mock-production.up.railway.app
- GitHub: https://github.com/b1rdmania/jank-derby
- DAML contracts on GitHub: https://github.com/b1rdmania/jank-derby/tree/master/daml

## Architecture
```
Frontend (static HTML, Vercel)
  → Mock backend (Node.js, Railway) [current]
  → Real backend (Node.js/Express/TS) + Canton JSON Ledger API v2 [future]
    → DAML contracts on Canton Network
```

## Stack
- **Frontend**: Single standalone HTML file (geocities aesthetic) — no framework, no build tools
- **Mock backend**: `backend/mock-server.js` — plain Node.js ESM, no dependencies beyond `ws`
- **Real backend**: `backend/src/index.ts` — Express 5, TypeScript, WebSocket, Canton JSON API v2
- **Contracts**: `daml/HorseRaceSecure.daml` — DAML 3.4.8

## Frontend config
Backend URL is set at top of `frontend/index.html`:
```js
var BACKEND_URL = window.CANTER_BACKEND_URL || 'https://canter-derby-mock-production.up.railway.app';
```
Override by setting `window.CANTER_BACKEND_URL` before the script runs.

## Horse odds
Red 2.5x | Blue 3.5x | Green 5.0x | Yellow 8.0x | Purple 12.0x

## Running locally
```bash
# Mock backend (no Canton needed)
cd backend && npm install && npm run mock

# Real backend (needs daml start first)
cd backend && cp .env.example .env && npm run dev

# Frontend — just open frontend/index.html in a browser
# or: npx serve frontend/
```

## Deployment
- Frontend: Vercel auto-deploys from GitHub master, static from `frontend/`
- Mock backend: Railway project `canter-derby-mock`, deploys from `backend/`
- Deploy backend: `cd backend && railway up`

## GeoCities frontend notes
- Pure HTML/CSS/JS, no React, no Vite, no build step
- `frontend/index.html` is the page; `frontend/geocities.html` is kept in sync as a copy
- Uses real animated GIFs from gifcities.org (blob.gifcities.org URLs)
- SKILL.md and GIF-CATALOG.md in repo root are the geocities skill reference files
