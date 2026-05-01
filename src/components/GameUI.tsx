/**
 * GameUI — Desert Buggy HUD
 * Minimal cinematic overlay: speed, time-of-day, FPS, controls
 */

import React, { useEffect, useRef } from 'react';
import { GameEngine } from '../systems/game-engine';
import './GameUI.css';

const GameUI: React.FC = () => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const engineRef    = useRef<GameEngine | null>(null);
  const rafRef       = useRef<number>(0);

  // DOM refs for direct mutation (no React re-renders every frame)
  const speedNumRef  = useRef<HTMLSpanElement>(null);
  const speedBarRef  = useRef<HTMLDivElement>(null);
  const timeRef      = useRef<HTMLSpanElement>(null);
  const periodRef    = useRef<HTMLSpanElement>(null);
  const fpsRef       = useRef<HTMLSpanElement>(null);
  const coordRef     = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new GameEngine(canvasRef.current);
    engineRef.current = engine;
    engine.start();

    // HUD update loop — runs independently of React
    const updateHUD = () => {
      const state = engine.getGameState();
      const { vehicle, lighting, fps } = state;

      // Speed
      const kmh = Math.floor(vehicle.speed);
      if (speedNumRef.current)  speedNumRef.current.textContent  = String(kmh);
      if (speedBarRef.current)  speedBarRef.current.style.width  = `${Math.min(kmh / 180 * 100, 100)}%`;

      // Time
      const h   = Math.floor(lighting.timeOfDay);
      const m   = Math.floor((lighting.timeOfDay - h) * 60);
      if (timeRef.current)   timeRef.current.textContent   = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      if (periodRef.current) periodRef.current.textContent = lighting.period;

      // FPS
      if (fpsRef.current)  fpsRef.current.textContent  = `${fps} FPS`;

      // Coordinates
      const p = vehicle.position;
      if (coordRef.current)
        coordRef.current.textContent =
          `${Math.floor(p.x)}, ${Math.floor(p.z)}`;

      rafRef.current = requestAnimationFrame(updateHUD);
    };
    rafRef.current = requestAnimationFrame(updateHUD);

    return () => {
      cancelAnimationFrame(rafRef.current);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  return (
    <div className="gc">
      <canvas ref={canvasRef} className="gc__canvas" />

      {/* ── HUD ─────────────────────────────────────────── */}
      <div className="hud">

        {/* Speed — bottom left */}
        <div className="hud__speed">
          <span className="hud__speed-num" ref={speedNumRef}>0</span>
          <span className="hud__speed-unit">km/h</span>
          <div className="hud__bar-bg">
            <div className="hud__bar-fill" ref={speedBarRef} />
          </div>
        </div>

        {/* Time — top right */}
        <div className="hud__time">
          <span className="hud__time-val" ref={timeRef}>14:00</span>
          <span className="hud__time-period" ref={periodRef}>Afternoon</span>
        </div>

        {/* FPS + coords — top left */}
        <div className="hud__info">
          <span ref={fpsRef}>60 FPS</span>
          <span className="hud__coord">📍 <span ref={coordRef}>0, 0</span></span>
        </div>

        {/* Controls — bottom right */}
        <div className="hud__controls">
          <div className="hud__ctrl-row"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Drive</div>
          <div className="hud__ctrl-row"><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> Also works</div>
          <div className="hud__ctrl-row"><kbd>Space</kbd> Handbrake / Drift</div>
        </div>

        {/* Desert title watermark */}
        <div className="hud__title">Desert Racer</div>

      </div>
    </div>
  );
};

export default GameUI;
