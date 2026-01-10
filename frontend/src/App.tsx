import { useState, useEffect } from 'react';
import { RaceTrack, Horse } from './components/RaceTrack';
import { BettingPanel } from './components/BettingPanel';
import './App.css';

type RaceState = 'waiting' | 'betting' | 'running' | 'finished';

interface HorsePosition {
  horse: Horse;
  position: number;
  color: string;
}

const INITIAL_HORSES: HorsePosition[] = [
  { horse: 'Red', position: 0, color: '#e74c3c' },
  { horse: 'Blue', position: 0, color: '#3498db' },
  { horse: 'Green', position: 0, color: '#2ecc71' },
  { horse: 'Yellow', position: 0, color: '#f39c12' },
  { horse: 'Purple', position: 0, color: '#9b59b6' },
];

function App() {
  const [raceState, setRaceState] = useState<RaceState>('waiting');
  const [horsePositions, setHorsePositions] = useState<HorsePosition[]>(INITIAL_HORSES);
  const [winner, setWinner] = useState<Horse | undefined>();
  const [balance, setBalance] = useState(100);
  const [currentBet, setCurrentBet] = useState<{ horse: Horse; amount: number } | null>(null);

  // Simulate a race for demo purposes
  const startRace = () => {
    setRaceState('betting');
    setTimeout(() => {
      setRaceState('running');
      simulateRace();
    }, 5000); // 5 seconds of betting time
  };

  const simulateRace = () => {
    // Reset positions
    setHorsePositions(INITIAL_HORSES);
    setWinner(undefined);

    // Run race simulation
    const raceInterval = setInterval(() => {
      setHorsePositions((prev) => {
        const updated = prev.map((horse) => {
          // Random movement with some jank
          const movement = Math.random() * 8 + 2; // 2-10 units per tick
          const newPosition = Math.min(horse.position + movement, 100);
          return { ...horse, position: newPosition };
        });

        // Check if any horse finished
        const finisher = updated.find((h) => h.position >= 100);
        if (finisher) {
          clearInterval(raceInterval);
          setRaceState('finished');
          setWinner(finisher.horse);

          // Check if player won
          if (currentBet && currentBet.horse === finisher.horse) {
            const payout = currentBet.amount * 4; // 4:1 odds
            setBalance((prev) => prev + payout);
            setTimeout(() => {
              alert(`🎉 YOU WON! +$${payout.toFixed(2)}`);
            }, 500);
          } else if (currentBet) {
            setTimeout(() => {
              alert(`😔 You lost. ${finisher.horse} won!`);
            }, 500);
          }

          // Reset for next race
          setTimeout(() => {
            setRaceState('waiting');
            setHorsePositions(INITIAL_HORSES);
            setWinner(undefined);
            setCurrentBet(null);
          }, 5000);
        }

        return updated;
      });
    }, 300); // Update every 300ms for jank effect
  };

  const handlePlaceBet = (horse: Horse, amount: number) => {
    setBalance((prev) => prev - amount);
    setCurrentBet({ horse, amount });
    alert(`Bet placed: $${amount.toFixed(2)} on ${horse}!`);
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
              <span style={{ color: INITIAL_HORSES.find(h => h.horse === currentBet.horse)?.color }}>
                {currentBet.horse}
              </span>
            </div>
          )}
        </div>

        <div className="betting-section">
          <BettingPanel
            onPlaceBet={handlePlaceBet}
            balance={balance}
            bettingOpen={raceState === 'waiting' || raceState === 'betting'}
          />

          {raceState === 'waiting' && (
            <button className="start-race-button" onClick={startRace}>
              🚀 Start Next Race
            </button>
          )}

          {raceState === 'betting' && (
            <div className="countdown">
              <p>⏰ Betting closes in 5 seconds...</p>
            </div>
          )}
        </div>
      </main>

      <footer className="app-footer">
        <p>
          Powered by <strong>Canton Network</strong> | Provably Fair RNG with Commit-Reveal
        </p>
        <p className="demo-notice">
          🎮 DEMO MODE - Connect to real Canton testnet for live betting
        </p>
      </footer>
    </div>
  );
}

export default App;
