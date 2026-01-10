import React, { useState } from 'react';
import type { Horse } from './RaceTrack';

interface BettingPanelProps {
  onPlaceBet: (horse: Horse, amount: number) => void;
  balance: number;
  bettingOpen: boolean;
}

const HORSES: { name: Horse; color: string; odds: number }[] = [
  { name: 'Red', color: '#e74c3c', odds: 4.0 },
  { name: 'Blue', color: '#3498db', odds: 4.0 },
  { name: 'Green', color: '#2ecc71', odds: 4.0 },
  { name: 'Yellow', color: '#f39c12', odds: 4.0 },
  { name: 'Purple', color: '#9b59b6', odds: 4.0 },
];

export const BettingPanel: React.FC<BettingPanelProps> = ({
  onPlaceBet,
  balance,
  bettingOpen
}) => {
  const [selectedHorse, setSelectedHorse] = useState<Horse | null>(null);
  const [betAmount, setBetAmount] = useState<string>('10');

  const handlePlaceBet = () => {
    if (!selectedHorse) {
      alert('Please select a horse!');
      return;
    }

    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid bet amount!');
      return;
    }

    if (amount > balance) {
      alert('Insufficient balance!');
      return;
    }

    onPlaceBet(selectedHorse, amount);
    setSelectedHorse(null);
    setBetAmount('10');
  };

  const potentialPayout = selectedHorse
    ? parseFloat(betAmount) * HORSES.find(h => h.name === selectedHorse)!.odds
    : 0;

  return (
    <div className="betting-panel">
      <h2>🎰 Place Your Bet</h2>

      <div className="balance">
        <strong>Balance:</strong> ${balance.toFixed(2)}
      </div>

      <div className="horse-selection">
        <h3>Select Your Horse:</h3>
        <div className="horse-grid">
          {HORSES.map((horse) => (
            <button
              key={horse.name}
              className={`horse-button ${selectedHorse === horse.name ? 'selected' : ''}`}
              onClick={() => setSelectedHorse(horse.name)}
              disabled={!bettingOpen}
              style={{
                backgroundColor: selectedHorse === horse.name ? horse.color : '#555',
                borderColor: horse.color,
              }}
            >
              <div className="horse-name">{horse.name}</div>
              <div className="horse-odds">{horse.odds}:1</div>
            </button>
          ))}
        </div>
      </div>

      <div className="bet-amount">
        <label htmlFor="bet-amount">
          <strong>Bet Amount:</strong>
        </label>
        <div className="amount-input-group">
          <span className="currency">$</span>
          <input
            id="bet-amount"
            type="number"
            min="1"
            max={balance}
            step="1"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            disabled={!bettingOpen}
          />
        </div>
      </div>

      {selectedHorse && (
        <div className="potential-payout">
          <strong>Potential Payout:</strong> ${potentialPayout.toFixed(2)}
        </div>
      )}

      <button
        className="place-bet-button"
        onClick={handlePlaceBet}
        disabled={!bettingOpen || !selectedHorse}
      >
        {bettingOpen ? '🏇 Place Bet' : '⏳ Betting Closed'}
      </button>

      {!bettingOpen && (
        <div className="betting-closed-message">
          Betting is currently closed. Wait for the next race!
        </div>
      )}
    </div>
  );
};
