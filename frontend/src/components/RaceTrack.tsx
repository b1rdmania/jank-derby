import React, { useEffect, useRef, useState } from 'react';

export type Horse = 'Red' | 'Blue' | 'Green' | 'Yellow' | 'Purple';

interface HorsePosition {
  horse: Horse;
  position: number; // 0-100
  color: string;
}

interface RaceTrackProps {
  raceState: 'waiting' | 'betting' | 'running' | 'finished';
  horsePositions: HorsePosition[];
  winner?: Horse;
}

const TRACK_LENGTH = 800;
const LANE_HEIGHT = 80;
const HORSE_WIDTH = 40;
const HORSE_HEIGHT = 30;
const FINISH_LINE_X = TRACK_LENGTH - 50;

export const RaceTrack: React.FC<RaceTrackProps> = ({
  raceState,
  horsePositions,
  winner
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [jankFrame, setJankFrame] = useState(0);

  // Janky animation - update in discrete steps
  useEffect(() => {
    if (raceState !== 'running') return;

    const interval = setInterval(() => {
      setJankFrame(prev => (prev + 1) % 3); // 3 frame cycle for jank effect
    }, 200); // Update every 200ms for visible "steps"

    return () => clearInterval(interval);
  }, [raceState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background (fairground theme)
    ctx.fillStyle = '#2a1810';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw lanes with alternating stripes
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#3a2820' : '#4a3830';
      ctx.fillRect(0, i * LANE_HEIGHT, TRACK_LENGTH, LANE_HEIGHT);

      // Lane divider
      ctx.strokeStyle = '#5a4840';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, (i + 1) * LANE_HEIGHT);
      ctx.lineTo(TRACK_LENGTH, (i + 1) * LANE_HEIGHT);
      ctx.stroke();
    }

    // Draw finish line (checkered flag pattern)
    for (let y = 0; y < 5 * LANE_HEIGHT; y += 20) {
      for (let x = 0; x < 20; x += 20) {
        ctx.fillStyle = ((y / 20) + (x / 20)) % 2 === 0 ? '#fff' : '#000';
        ctx.fillRect(FINISH_LINE_X + x, y, 20, 20);
      }
    }

    // Draw horses
    horsePositions.forEach((horsePos, index) => {
      const lane = index;
      const laneY = lane * LANE_HEIGHT + (LANE_HEIGHT - HORSE_HEIGHT) / 2;

      // Calculate X position with jank effect
      let baseX = (horsePos.position / 100) * (FINISH_LINE_X - HORSE_WIDTH);

      // Add janky wobble during running
      if (raceState === 'running') {
        const jankOffset = (jankFrame - 1) * 3; // -3, 0, +3 offset
        baseX += jankOffset;
      }

      // Draw horse as a rectangle (keeping it simple and "janky")
      ctx.fillStyle = horsePos.color;
      ctx.fillRect(baseX, laneY, HORSE_WIDTH, HORSE_HEIGHT);

      // Add a simple "eye" to show direction
      ctx.fillStyle = '#000';
      ctx.fillRect(baseX + HORSE_WIDTH - 8, laneY + 8, 4, 4);

      // Horse label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(horsePos.horse, baseX + 2, laneY - 5);

      // Winner indicator
      if (raceState === 'finished' && winner === horsePos.horse) {
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 20px monospace';
        ctx.fillText('★ WINNER ★', baseX - 20, laneY - 10);
      }
    });

    // Draw race state indicator
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';

    if (raceState === 'waiting') {
      ctx.fillText('PLACE YOUR BETS!', TRACK_LENGTH / 2, 30);
    } else if (raceState === 'betting') {
      ctx.fillText('BETTING OPEN', TRACK_LENGTH / 2, 30);
    } else if (raceState === 'running') {
      ctx.fillText('THEY\'RE OFF!', TRACK_LENGTH / 2, 30);
    } else if (raceState === 'finished') {
      ctx.fillText(`${winner} WINS!`, TRACK_LENGTH / 2, 30);
    }

  }, [horsePositions, raceState, winner, jankFrame]);

  return (
    <div className="race-track-container">
      <canvas
        ref={canvasRef}
        width={TRACK_LENGTH}
        height={5 * LANE_HEIGHT}
        style={{
          border: '4px solid #8b4513',
          borderRadius: '8px',
          boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
          imageRendering: 'pixelated', // Enhance the janky pixel art feel
        }}
      />
    </div>
  );
};
