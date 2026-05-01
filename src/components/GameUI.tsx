/**
 * Game UI Component
 * Displays HUD overlay with speed, time of day, etc.
 */

import React, { useEffect, useRef } from 'react';
import type { GameState } from '../systems/game-engine';
import { GameEngine } from '../systems/game-engine';
import './GameUI.css';

interface GameUIProps {
  onGameStateUpdate?: (state: GameState) => void;
}

export const GameUI: React.FC<GameUIProps> = ({ onGameStateUpdate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameEngineRef = useRef<GameEngine | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const hudElementsRef = useRef<{
    speedValue?: HTMLDivElement;
    timeValue?: HTMLDivElement;
    timePeriod?: HTMLDivElement;
    fpsDisplay?: HTMLDivElement;
  }>({});

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize game
    const gameEngine = new GameEngine(canvasRef.current);
    gameEngineRef.current = gameEngine;
    gameEngine.start();

    // Cache HUD elements for direct DOM updates
    hudElementsRef.current = {
      speedValue: document.querySelector('.speed-value') as HTMLDivElement,
      timeValue: document.querySelector('.time-value') as HTMLDivElement,
      timePeriod: document.querySelector('.time-period') as HTMLDivElement,
      fpsDisplay: document.querySelector('.fps-display') as HTMLDivElement,
    };

    // Update HUD every frame without React re-renders
    const updateHUD = () => {
      const state = gameEngine.getGameState();
      gameStateRef.current = state;
      onGameStateUpdate?.(state);

      // Direct DOM updates to avoid React re-renders
      if (hudElementsRef.current.speedValue) {
        hudElementsRef.current.speedValue.textContent = Math.floor(state.vehicle.speed).toString();
      }
      if (hudElementsRef.current.timeValue) {
        const h = Math.floor(state.lighting.timeOfDay);
        const m = Math.floor((state.lighting.timeOfDay - h) * 60);
        hudElementsRef.current.timeValue.textContent =
          `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      }
      if (hudElementsRef.current.timePeriod) {
        const h = Math.floor(state.lighting.timeOfDay);
        let period = 'Night';
        if (h >= 6 && h < 12) period = 'Morning';
        else if (h >= 12 && h < 18) period = 'Afternoon';
        else if (h >= 18 && h < 21) period = 'Evening';
        hudElementsRef.current.timePeriod.textContent = period;
      }
      if (hudElementsRef.current.fpsDisplay) {
        hudElementsRef.current.fpsDisplay.textContent = `${state.fps} FPS`;
      }
    };

    const updateInterval = setInterval(updateHUD, 16);

    // Cleanup
    return () => {
      clearInterval(updateInterval);
      gameEngine.dispose();
      gameEngineRef.current = null;
    };
  }, [onGameStateUpdate]);

  return (
    <div className="game-container">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />

      {/* HUD Overlay */}
      <div className="hud">
        {/* Speed Indicator */}
        <div className="speed-display">
          <div className="speed-value">0</div>
          <div className="speed-unit">km/h</div>
        </div>

        {/* Time of Day */}
        <div className="time-display">
          <div className="time-value">00:00</div>
          <div className="time-period">Morning</div>
        </div>

        {/* FPS Counter */}
        <div className="fps-display">60 FPS</div>

        {/* Controls Help */}
        <div className="controls-help">
          <div className="control-item">W / ↑ - Accelerate</div>
          <div className="control-item">S / ↓ - Brake/Reverse</div>
          <div className="control-item">A / ← - Turn Left</div>
          <div className="control-item">D / → - Turn Right</div>
          <div className="control-item">SPACE - Handbrake/Drift</div>
        </div>
      </div>
    </div>
  );
};

export default GameUI;
