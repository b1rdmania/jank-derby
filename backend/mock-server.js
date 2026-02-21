// Canter Derby — mock backend (no Canton / DAML required)
// Run with: node mock-server.js

import http from 'http';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 4001;
const TICK_MS = 350;
const HORSES = ['Red', 'Blue', 'Green', 'Yellow', 'Purple'];
const ODDS   = { Red: 2.5, Blue: 3.5, Green: 5.0, Yellow: 8.0, Purple: 12.0 };
const STARTING_BALANCE = 1000;

// --- state ---
var balances = { Alice: STARTING_BALANCE, Bob: STARTING_BALANCE };
var races    = {};   // raceId -> race
var bets     = {};   // raceId -> [{player, horse, amount}]
var order    = [];   // raceId insertion order
var clients  = new Set();

// --- helpers ---
function uid() {
  return 'race-' + Date.now() + '-' + Math.floor(Math.random() * 9999);
}

function initPositions() {
  return HORSES.map(h => ({ horse: h, position: 0 }));
}

function view(raceId) {
  var r = races[raceId];
  if (!r) return null;
  return { raceId, state: r.state, winner: r.winner || null, positions: r.positions.map(p => ({ ...p })) };
}

function broadcast(msg) {
  var s = JSON.stringify(msg);
  clients.forEach(ws => { if (ws.readyState === 1) ws.send(s); });
}

function broadcastState() {
  broadcast({ type: 'state', races: order.map(view).filter(Boolean) });
}

// --- race loop ---
function tick(raceId) {
  var race = races[raceId];
  if (!race || race.state !== 'Running') return;

  var winner = null;
  for (var p of race.positions) {
    // speed inversely proportional to odds — favourites a bit faster on average
    var speed = (30 / ODDS[p.horse]) + Math.random() * 12;
    p.position = Math.min(100, p.position + speed);
    if (p.position >= 100 && !winner) winner = p.horse;
  }

  if (winner) {
    race.state  = 'Finished';
    race.winner = winner;
    // settle bets
    (bets[raceId] || []).forEach(b => {
      if (b.horse === winner) {
        balances[b.player] = (balances[b.player] || 0) + b.amount * ODDS[winner];
      }
    });
    broadcast({ type: 'race:update', race: view(raceId) });
    broadcast({ type: 'race:finished' });
  } else {
    broadcast({ type: 'race:update', race: view(raceId) });
    setTimeout(() => tick(raceId), TICK_MS);
  }
}

async function runRace(raceId, bettingSeconds) {
  await new Promise(r => setTimeout(r, bettingSeconds * 1000));
  var race = races[raceId];
  if (!race) return;

  race.state = 'BettingClosed';
  broadcast({ type: 'race:update', race: view(raceId) });

  await new Promise(r => setTimeout(r, 1000));

  race.state = 'Running';
  broadcast({ type: 'race:update', race: view(raceId) });
  tick(raceId);
}

// --- HTTP router (no framework, keep it lean) ---
function send(res, status, body) {
  var payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise(resolve => {
    var chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch { resolve({}); }
    });
  });
}

var server = http.createServer(async (req, res) => {
  var method = req.method;
  var url    = req.url.split('?')[0];

  // CORS preflight
  if (method === 'OPTIONS') { send(res, 204, {}); return; }

  // POST /api/bootstrap
  if (method === 'POST' && url === '/api/bootstrap') {
    balances = { Alice: STARTING_BALANCE, Bob: STARTING_BALANCE };
    send(res, 200, { ok: true });
    return;
  }

  // GET /api/state
  if (method === 'GET' && url === '/api/state') {
    send(res, 200, { races: order.map(view).filter(Boolean) });
    return;
  }

  // GET /api/accounts/:player
  var accountMatch = url.match(/^\/api\/accounts\/(.+)$/);
  if (method === 'GET' && accountMatch) {
    var player = decodeURIComponent(accountMatch[1]);
    send(res, 200, { player, balance: String(balances[player] ?? 0) });
    return;
  }

  // POST /api/races
  if (method === 'POST' && url === '/api/races') {
    var body = await readBody(req);
    var bettingSeconds = body.bettingSeconds || 30;
    var raceId = uid();
    races[raceId] = { state: 'Committed', positions: initPositions(), winner: null };
    bets[raceId]  = [];
    order.push(raceId);
    if (order.length > 10) order.shift();
    broadcast({ type: 'race:update', race: view(raceId) });
    runRace(raceId, bettingSeconds);
    send(res, 201, { raceId });
    return;
  }

  // POST /api/races/:raceId/bet
  var betMatch = url.match(/^\/api\/races\/(.+)\/bet$/);
  if (method === 'POST' && betMatch) {
    var raceId  = decodeURIComponent(betMatch[1]);
    var race    = races[raceId];
    if (!race)                       { send(res, 404, { error: 'Race not found' });      return; }
    if (race.state !== 'Committed')  { send(res, 400, { error: 'Betting is closed' });   return; }
    var body   = await readBody(req);
    var player = body.player;
    var horse  = body.horse;
    var amount = parseFloat(body.amount);
    if (!HORSES.includes(horse))          { send(res, 400, { error: 'Invalid horse' });        return; }
    if (!amount || amount <= 0)           { send(res, 400, { error: 'Invalid amount' });       return; }
    if ((balances[player] || 0) < amount) { send(res, 400, { error: 'Insufficient balance' }); return; }
    balances[player] -= amount;
    bets[raceId].push({ player, horse, amount });
    send(res, 200, { ok: true });
    return;
  }

  send(res, 404, { error: 'Not found' });
});

// --- WebSocket ---
var wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', ws => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'state', races: order.map(view).filter(Boolean) }));
  ws.on('close', () => clients.delete(ws));
});

server.listen(PORT, () => {
  console.log(`Canter Derby mock server → http://localhost:${PORT}`);
  console.log('No Canton required. Pure mock mode.');
});
