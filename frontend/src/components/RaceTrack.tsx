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
const LANE_HEIGHT = 60;
const HORSE_SIZE = 30;
const FINISH_LINE_X = TRACK_LENGTH - 100;
const NAME_AREA_WIDTH = 150;

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

    // Draw background (clean white)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw lanes with horse names and track lines
    for (let i = 0; i < 5; i++) {
      const laneY = i * LANE_HEIGHT + LANE_HEIGHT / 2;

      // Draw horse name
      ctx.fillStyle = '#000';
      ctx.font = '16px Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const horseName = horsePositions[i]?.horse || '';
      ctx.fillText(horseName, 10, laneY);

      // Draw track line
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(NAME_AREA_WIDTH, laneY);
      ctx.lineTo(TRACK_LENGTH - 20, laneY);
      ctx.stroke();
    }

    // Draw finish line
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(FINISH_LINE_X, 10);
    ctx.lineTo(FINISH_LINE_X, 5 * LANE_HEIGHT - 10);
    ctx.stroke();

    // Draw horses
    horsePositions.forEach((horsePos, index) => {
      const lane = index;
      const laneY = lane * LANE_HEIGHT + LANE_HEIGHT / 2;

      // Calculate X position with jank effect
      let baseX = NAME_AREA_WIDTH + (horsePos.position / 100) * (FINISH_LINE_X - NAME_AREA_WIDTH - HORSE_SIZE);

      // Add janky wobble during running
      if (raceState === 'running') {
        const jankOffset = (jankFrame - 1) * 3; // -3, 0, +3 offset
        baseX += jankOffset;
      }

      // Draw horse emoji
      ctx.font = `${HORSE_SIZE}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏇', baseX, laneY);

      // Winner indicator
      if (raceState === 'finished' && winner === horsePos.horse) {
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('★ WINNER', baseX + 50, laneY);
      }
    });

    // Draw race state indicator (removed - cleaner look)

  }, [horsePositions, raceState, winner, jankFrame]);

  return (
    <div className="race-track-container">
      <canvas
        ref={canvasRef}
        width={TRACK_LENGTH}
        height={5 * LANE_HEIGHT}
        style={{
          border: '1px solid #ccc',
          borderRadius: '4px',
          backgroundColor: '#fff',
        }}
      />
    </div>
  );
};
