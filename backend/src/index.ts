import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { z } from 'zod';

import { config } from './config.js';
import { JsonApiClient } from './jsonApi.js';
import { makeTemplateIds, type Horse } from './damlIds.js';
import { backendState } from './state.js';
import { generateSeed, sha256Hex } from './rng.js';

if (!config.packageId) {
  throw new Error(
    'Missing DAML_PACKAGE_ID. Set it in backend/.env (see backend/.env.example).'
  );
}

const templateIds = makeTemplateIds(config.packageId);
const api = new JsonApiClient(config.jsonApiUrl, process.env.DAML_ACCESS_TOKEN ?? '');

type RacePayload = {
  operator: string;
  raceId: string;
  seedCommitment: string;
  state: string;
  bettingDeadline: string;
  winner?: Horse | null;
  positions: any[];
  tickNumber: number;
};

type PlayerAccountPayload = {
  operator: string;
  player: string;
  balance: string;
};

async function ensureParty(hint: string): Promise<string> {
  const existing = backendState.parties[hint];
  if (existing) return existing;
  try {
    const res = await api.allocateParty({ partyIdHint: hint });
    backendState.parties[hint] = res.partyDetails.party;
    return res.partyDetails.party;
  } catch {
    // Fallback: list parties and try to find an exact prefix match.
    const listed = await api.listParties(hint).catch(() => api.listParties());
    const match =
      listed.partyDetails.find((p) => p.party.startsWith(`${hint}::`)) ??
      listed.partyDetails.find((p) => p.party.includes(`${hint}::`));
    if (!match) throw new Error(`Could not allocate or find party for hint=${hint}`);
    backendState.parties[hint] = match.party;
    return match.party;
  }
}

async function listActive<TPayload>(party: string, templateId: string): Promise<Array<{ contractId: string; payload: TPayload }>> {
  return api.listActiveContractsByTemplate<TPayload>(party, templateId);
}

async function getOrCreateOperatorContract(operatorParty: string): Promise<string> {
  const contracts = await listActive<{ operator: string }>(operatorParty, templateIds.Operator);
  const existing = contracts.find((c) => c.payload.operator === operatorParty);
  if (existing) return existing.contractId;
  return api.create({
    party: operatorParty,
    templateId: templateIds.Operator,
    createArguments: { operator: operatorParty },
  });
}

async function getActiveRace(operatorParty: string, raceId: string): Promise<{ contractId: string; payload: RacePayload }> {
  const races = await listActive<RacePayload>(operatorParty, templateIds.Race);
  const matches = races.filter((r) => r.payload.operator === operatorParty && r.payload.raceId === raceId);
  if (matches.length !== 1) throw new Error(`Expected exactly 1 active Race for raceId=${raceId}, got ${matches.length}`);
  return matches[0]!;
}

async function getActiveAccount(operatorParty: string, playerParty: string): Promise<{ contractId: string; payload: PlayerAccountPayload }> {
  const accts = await listActive<PlayerAccountPayload>(operatorParty, templateIds.PlayerAccount);
  const matches = accts.filter((a) => a.payload.operator === operatorParty && a.payload.player === playerParty);
  if (matches.length !== 1) throw new Error(`Expected exactly 1 active PlayerAccount for player=${playerParty}, got ${matches.length}`);
  return matches[0]!;
}

async function refreshRaceState(operatorParty: string, raceId: string) {
  const r = await getActiveRace(operatorParty, raceId);
  const winner = (r.payload.winner ?? undefined) || undefined;
  const positions = (r.payload.positions ?? []).map((t) => {
    if (Array.isArray(t) && t.length === 2) {
      const [horse, position] = t as [Horse, number];
      return { horse, position: typeof position === 'string' ? parseInt(position as any, 10) : position };
    }
    if (t && typeof t === 'object' && '_1' in t && '_2' in t) {
      const horse = (t as any)._1 as Horse;
      const raw = (t as any)._2 as any;
      const position = typeof raw === 'string' ? parseInt(raw, 10) : (raw as number);
      return { horse, position };
    }
    throw new Error('Unexpected positions encoding in Race payload');
  });
  backendState.races[raceId] = {
    raceId,
    contractId: r.contractId,
    state: r.payload.state as any,
    bettingDeadline: r.payload.bettingDeadline,
    winner: winner ?? undefined,
    positions,
    tickNumber: typeof (r.payload as any).tickNumber === 'string' ? parseInt((r.payload as any).tickNumber, 10) : r.payload.tickNumber,
  };
}

function broadcast(wss: WebSocketServer, data: unknown) {
  const msg = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

async function runRaceLoop(wss: WebSocketServer, operatorParty: string, raceId: string) {
  await refreshRaceState(operatorParty, raceId);
  broadcast(wss, { type: 'race:update', race: backendState.races[raceId] });

  const race = backendState.races[raceId]!;
  const deadlineMs = Date.parse(race.bettingDeadline);
  const waitMs = Math.max(0, deadlineMs - Date.now());
  if (waitMs > 0) {
    broadcast(wss, { type: 'race:betting', raceId, closesInMs: waitMs });
    await new Promise((r) => setTimeout(r, waitMs));
  }

  // Close betting
  {
    const current = await getActiveRace(operatorParty, raceId);
    await api.exercise<{ currentTime: string }, string>({
      party: operatorParty,
      templateId: templateIds.Race,
      contractId: current.contractId,
      choice: 'CloseBetting',
      choiceArgument: { currentTime: new Date().toISOString() },
    });
    await refreshRaceState(operatorParty, raceId);
    broadcast(wss, { type: 'race:update', race: backendState.races[raceId] });
  }

  // Reveal seed
  {
    const seed = backendState.seeds[raceId];
    if (!seed) throw new Error(`Missing seed for raceId=${raceId}`);
    const current = await getActiveRace(operatorParty, raceId);
    await api.exercise<{ revealedSeed: string }, string>({
      party: operatorParty,
      templateId: templateIds.Race,
      contractId: current.contractId,
      choice: 'RevealSeed',
      choiceArgument: { revealedSeed: seed },
    });
    await refreshRaceState(operatorParty, raceId);
    broadcast(wss, { type: 'race:update', race: backendState.races[raceId] });
  }

  // Tick until finished
  while (true) {
    const current = await getActiveRace(operatorParty, raceId);
    if (current.payload.state === 'Finished' || current.payload.state === 'Cancelled') break;
    await api.exercise<Record<string, never>, string>({
      party: operatorParty,
      templateId: templateIds.Race,
      contractId: current.contractId,
      choice: 'Tick',
      choiceArgument: {},
    });
    await refreshRaceState(operatorParty, raceId);
    broadcast(wss, { type: 'race:update', race: backendState.races[raceId] });
    await new Promise((r) => setTimeout(r, 300));
  }

  // Settle all bets and auto-claim payouts for demo convenience
  {
    const currentRace = await getActiveRace(operatorParty, raceId);
    const bets = await listActive<any>(operatorParty, templateIds.Bet);
    for (const b of bets.filter((bb) => bb.payload.raceId === raceId)) {
      const settlement = await api.exercise<{ raceCid: string }, { tag: string; value?: any }>({
        party: operatorParty,
        templateId: templateIds.Bet,
        contractId: b.contractId,
        choice: 'Settle',
        choiceArgument: { raceCid: currentRace.contractId },
      });

      if (settlement?.tag === 'Won') {
        const payoutCid = settlement.value as string;
        const playerParty = b.payload.player as string;
        const acct = await getActiveAccount(operatorParty, playerParty);
        await api.exercise<{ accountCid: string }, string>({
          party: playerParty,
          templateId: templateIds.Payout,
          contractId: payoutCid,
          choice: 'ClaimPayout',
          choiceArgument: { accountCid: acct.contractId },
        });
      }
    }
  }

  broadcast(wss, { type: 'race:finished', raceId });
}

const app = express();
app.use(cors());
app.use(express.json());

const wss = new WebSocketServer({ noServer: true });

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.post('/api/bootstrap', async (_req, res) => {
  const operatorParty = await ensureParty(config.operatorPartyHint);
  const players = await Promise.all(config.demoPlayerHints.map((p) => ensureParty(p)));

  const operatorCid = await getOrCreateOperatorContract(operatorParty);

  // Ensure accounts exist for demo players and seed balance
  for (const playerParty of players) {
    const existing = await listActive<PlayerAccountPayload>(operatorParty, templateIds.PlayerAccount);
    const has = existing.some((a) => a.payload.operator === operatorParty && a.payload.player === playerParty);
    if (!has) {
      await api.exercise<{ player: string }, string>({
        party: operatorParty,
        templateId: templateIds.Operator,
        contractId: operatorCid,
        choice: 'CreatePlayerAccount',
        choiceArgument: { player: playerParty },
      });
    }

    const acct = await getActiveAccount(operatorParty, playerParty);
    const bal = parseFloat(acct.payload.balance);
    if (Number.isFinite(bal) && bal < 100) {
      await api.exercise<{ amount: string }, string>({
        party: playerParty,
        templateId: templateIds.PlayerAccount,
        contractId: acct.contractId,
        choice: 'Deposit',
        choiceArgument: { amount: (100 - bal).toFixed(1) },
      });
    }
  }

  res.json({
    operatorParty,
    operatorCid,
    players: config.demoPlayerHints.map((h) => backendState.parties[h]),
    playerHints: config.demoPlayerHints,
  });
});

app.post('/api/races', async (req, res) => {
  const bodySchema = z.object({
    raceId: z.string().min(1).optional(),
    bettingSeconds: z.number().int().min(3).max(120).default(10),
  });
  const body = bodySchema.parse(req.body ?? {});
  const raceId = body.raceId ?? `race-${Date.now()}`;

  const operatorParty = await ensureParty(config.operatorPartyHint);
  const operatorCid = await getOrCreateOperatorContract(operatorParty);

  const seed = generateSeed();
  const commitment = sha256Hex(seed);
  backendState.seeds[raceId] = seed;

  const bettingDeadline = new Date(Date.now() + body.bettingSeconds * 1000).toISOString();

  await api.exercise<any, string>({
    party: operatorParty,
    templateId: templateIds.Operator,
    contractId: operatorCid,
    choice: 'CreateRace',
    choiceArgument: { raceId, seedCommitment: commitment, bettingDeadline },
  });

  await refreshRaceState(operatorParty, raceId);
  broadcast(wss, { type: 'race:update', race: backendState.races[raceId] });

  void runRaceLoop(wss, operatorParty, raceId).catch((e) => {
    broadcast(wss, { type: 'error', message: String(e?.message ?? e) });
  });

  res.json({ raceId, commitment });
});

app.get('/api/state', async (_req, res) => {
  res.json({ races: Object.values(backendState.races) });
});

app.get('/api/accounts/:player', async (req, res) => {
  const paramsSchema = z.object({ player: z.string().min(1) });
  const { player } = paramsSchema.parse(req.params);
  const operatorParty = await ensureParty(config.operatorPartyHint);
  const playerParty = await ensureParty(player);
  const acct = await getActiveAccount(operatorParty, playerParty);
  res.json({
    player,
    party: playerParty,
    accountCid: acct.contractId,
    balance: acct.payload.balance,
  });
});

app.post('/api/races/:raceId/bet', async (req, res) => {
  const paramsSchema = z.object({ raceId: z.string().min(1) });
  const bodySchema = z.object({
    player: z.string().min(1),
    horse: z.enum(['Red', 'Blue', 'Green', 'Yellow', 'Purple']),
    amount: z.number().positive(),
  });
  const { raceId } = paramsSchema.parse(req.params);
  const body = bodySchema.parse(req.body);

  const operatorParty = await ensureParty(config.operatorPartyHint);
  const playerParty = await ensureParty(body.player);

  const acct = await getActiveAccount(operatorParty, playerParty);
  const race = await getActiveRace(operatorParty, raceId);

  const betRequestCid = await api.exercise<{ raceId: string; horse: Horse; amount: string }, string>({
    party: playerParty,
    templateId: templateIds.PlayerAccount,
    contractId: acct.contractId,
    choice: 'PlaceBetRequest',
    choiceArgument: { raceId, horse: body.horse, amount: body.amount.toFixed(1) },
  });

  const accepted = await api.exercise<
    { accountCid: string; raceCid: string; maxLiabilityPerHorse: string; currentTime: string },
    unknown
  >({
    party: operatorParty,
    templateId: templateIds.BetRequest,
    contractId: betRequestCid,
    choice: 'AcceptBet',
    choiceArgument: {
      accountCid: acct.contractId,
      raceCid: race.contractId,
      maxLiabilityPerHorse: '1000.0',
      currentTime: new Date().toISOString(),
    },
  });

  await refreshRaceState(operatorParty, raceId);
  broadcast(wss, { type: 'race:update', race: backendState.races[raceId] });

  res.json({ accepted });
});

const server = app.listen(config.port, () => {
  console.log(`Jank Derby backend listening on http://localhost:${config.port}`);
});

server.on('upgrade', (request, socket, head) => {
  if (request.url?.startsWith('/ws')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'hello' }));
  ws.send(JSON.stringify({ type: 'state', races: Object.values(backendState.races) }));
});

