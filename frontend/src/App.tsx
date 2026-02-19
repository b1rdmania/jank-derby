import { useEffect, useMemo, useRef, useState } from 'react';
import { RaceTrack, type Horse } from './components/RaceTrack';
import { BettingPanel } from './components/BettingPanel';
import './App.css';

type RaceState = 'waiting' | 'betting' | 'running' | 'finished';

interface HorsePosition {
  horse: Horse;
  position: number;
  color: string;
}

const HORSE_COLORS: Record<Horse, string> = {
  Red: '#e74c3c',
  Blue: '#3498db',
  Green: '#2ecc71',
  Yellow: '#f39c12',
  Purple: '#9b59b6',
};

const INITIAL_HORSES: HorsePosition[] = (Object.keys(HORSE_COLORS) as Horse[]).map((horse) => ({
  horse,
  position: 0,
  color: HORSE_COLORS[horse],
}));

function toUiRaceState(damlState?: string): RaceState {
  switch (damlState) {
    case 'Committed':
      return 'betting';
    case 'BettingClosed':
    case 'Running':
      return 'running';
    case 'Finished':
    case 'Cancelled':
      return 'finished';
    default:
      return 'waiting';
  }
}

function App() {
  const backendUrl = useMemo(
    () => (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:4001',
    []
  );
  const wsUrl = useMemo(() => backendUrl.replace(/^http/, 'ws') + '/ws', [backendUrl]);

  const [raceState, setRaceState] = useState<RaceState>('waiting');
  const [horsePositions, setHorsePositions] = useState<HorsePosition[]>(INITIAL_HORSES);
  const [winner, setWinner] = useState<Horse | undefined>();
  const [balance, setBalance] = useState(0);
  const [player, setPlayer] = useState('Alice');
  const [raceId, setRaceId] = useState<string | null>(null);
  const [currentBet, setCurrentBet] = useState<{ horse: Horse; amount: number } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const refreshBalance = async () => {
    const res = await fetch(`${backendUrl}/api/accounts/${encodeURIComponent(player)}`);
    if (!res.ok) return;
    const json = (await res.json()) as { balance: string };
    setBalance(parseFloat(json.balance));
  };

  const bootstrap = async () => {
    await fetch(`${backendUrl}/api/bootstrap`, { method: 'POST' });
    await refreshBalance();
  };

  useEffect(() => {
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refreshBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data as string) as any;
      if (msg.type === 'state') {
        const races = (msg.races ?? []) as any[];
        const last = races.length > 0 ? races[races.length - 1] : null;
        if (last) {
          setRaceId(last.raceId);
          setRaceState(toUiRaceState(last.state));
          setWinner(last.winner);
          setHorsePositions(
            (last.positions ?? []).map((p: any) => {
              const horse = p.horse as Horse;
              return {
                horse,
                position: typeof p.position === 'string' ? parseInt(p.position, 10) : (p.position as number),
                color: HORSE_COLORS[horse],
              };
            })
          );
        }
      }
      if (msg.type === 'race:update') {
        const r = msg.race as {
          raceId: string;
          state: string;
          winner?: Horse;
          positions: Array<{ horse: Horse; position: number }>;
        };
        setRaceId(r.raceId);
        setRaceState(toUiRaceState(r.state));
        setWinner(r.winner);
        setHorsePositions(
          r.positions.map((p: any) => {
            const horse = p.horse as Horse;
            return {
              horse,
              position: typeof p.position === 'string' ? parseInt(p.position, 10) : (p.position as number),
              color: HORSE_COLORS[horse],
            };
          })
        );
      }
      if (msg.type === 'race:finished') {
        void refreshBalance();
      }
      if (msg.type === 'error') {
        // eslint-disable-next-line no-alert
        alert(msg.message);
      }
    };

    return () => ws.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl]);

  // Polling fallback (useful when WS is flaky in dev environments)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${backendUrl}/api/state`);
        if (!res.ok) return;
        const json = (await res.json()) as { races: any[] };
        const races = json.races ?? [];
        const last = races.length > 0 ? races[races.length - 1] : null;
        if (!last) return;
        setRaceId(last.raceId);
        setRaceState(toUiRaceState(last.state));
        setWinner(last.winner);
        setHorsePositions(
          (last.positions ?? []).map((p: any) => {
            const horse = p.horse as Horse;
            return {
              horse,
              position: typeof p.position === 'string' ? parseInt(p.position, 10) : (p.position as number),
              color: HORSE_COLORS[horse],
            };
          })
        );
      } catch {
        // ignore
      }
    }, 500);
    return () => clearInterval(interval);
  }, [backendUrl]);

  const startRace = async () => {
    const res = await fetch(`${backendUrl}/api/races`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bettingSeconds: 30 }),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-alert
      alert(`Failed to start race: ${res.statusText}`);
      return;
    }
    const json = (await res.json()) as { raceId: string };
    setRaceId(json.raceId);
    setRaceState('betting');
    setCurrentBet(null);
    setWinner(undefined);
    setHorsePositions(INITIAL_HORSES);
  };

  const handlePlaceBet = async (horse: Horse, amount: number) => {
    if (!raceId) return;
    setCurrentBet({ horse, amount });
    await fetch(`${backendUrl}/api/races/${encodeURIComponent(raceId)}/bet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player, horse, amount }),
    });
    await refreshBalance();
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🏇 JANK DERBY 🏇</h1>
        <p className="tagline">The Jankiest Horse Racing on Canton Network</p>
      </header>

      <main className="app-main">
        <div className="race-section">
          <RaceTrack
            raceState={raceState}
            horsePositions={horsePositions}
            winner={winner}
          />

          {currentBet && raceState !== 'waiting' && (
            <div className="current-bet-display">
              <strong>Your Bet:</strong> ${currentBet.amount.toFixed(2)} on{' '}
              <span style={{ color: HORSE_COLORS[currentBet.horse] }}>
                {currentBet.horse}
              </span>
            </div>
          )}
        </div>

        <div className="betting-section">
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <label>
              <strong>Player:</strong>{' '}
              <select value={player} onChange={(e) => setPlayer(e.target.value)}>
                <option value="Alice">Alice</option>
                <option value="Bob">Bob</option>
              </select>
            </label>
          </div>

          <BettingPanel
            onPlaceBet={handlePlaceBet}
            balance={balance}
            bettingOpen={raceState === 'betting'}
          />

          {(raceState === 'waiting' || raceState === 'finished') && (
            <button className="start-race-button" onClick={startRace}>
              🚀 Start Next Race
            </button>
          )}

          {raceState === 'betting' && (
            <div className="countdown">
              <p>⏰ Betting open…</p>
            </div>
          )}
        </div>
      </main>

      <footer className="app-footer">
        <p>
          Powered by <strong>Canton Network</strong> | Provably Fair RNG with Commit-Reveal
        </p>
        <p className="demo-notice">
          🎮 Local demo mode (backend + Daml JSON-API)
        </p>
      </footer>
    </div>
  );
}

export default App;
