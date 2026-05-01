/**
 * GameUI — Desert Racer HUD
 * Premium cinematic overlay with loading screen, speed gauge,
 * time-of-day, FPS, coordinates, and mini-compass.
 */

import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../systems/game-engine';
import './GameUI.css';

const GameUI: React.FC = () => {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const engineRef   = useRef<GameEngine | null>(null);
  const rafRef      = useRef<number>(0);
  const [loaded, setLoaded] = useState(false);

  // DOM refs — direct mutation, no React re-renders per frame
  const speedNumRef  = useRef<HTMLSpanElement>(null);
  const speedBarRef  = useRef<HTMLDivElement>(null);
  const speedNeedleRef = useRef<HTMLDivElement>(null);
  const timeRef      = useRef<HTMLSpanElement>(null);
  const periodRef    = useRef<HTMLSpanElement>(null);
  const fpsRef       = useRef<HTMLSpanElement>(null);
  const coordRef     = useRef<HTMLSpanElement>(null);
  const compassRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new GameEngine(canvasRef.current);
    engineRef.current = engine;
    engine.start();

    // Show HUD after a short delay (let scene load)
    const loadTimer = setTimeout(() => setLoaded(true), 1200);

    const updateHUD = () => {
      const state = engine.getGameState();
      const { vehicle, lighting, fps } = state;

      const kmh = Math.floor(vehicle.speed);

      // Speed number
      if (speedNumRef.current)
        speedNumRef.current.textContent = String(kmh);

      // Speed bar
      if (speedBarRef.current)
        speedBarRef.current.style.width = `${Math.min(kmh / 180 * 100, 100)}%`;

      // Speed needle (semicircle gauge: -135° to +135°)
      if (speedNeedleRef.current) {
        const angle = -135 + Math.min(kmh / 180, 1) * 270;
        speedNeedleRef.current.style.transform = `rotate(${angle}deg)`;
      }

      // Time
      const h = Math.floor(lighting.timeOfDay);
      const m = Math.floor((lighting.timeOfDay - h) * 60);
      if (timeRef.current)
        timeRef.current.textContent =
          `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (periodRef.current)
        periodRef.current.textContent = lighting.period;

      // FPS
      if (fpsRef.current)
        fpsRef.current.textContent = `${fps} FPS`;

      // Coords
      const p = vehicle.position;
      if (coordRef.current)
        coordRef.current.textContent = `${Math.floor(p.x)}, ${Math.floor(p.z)}`;

      // Compass — rotate based on vehicle yaw
      if (compassRef.current) {
        const yawDeg = (vehicle.rotation.y * 180 / Math.PI) % 360;
        compassRef.current.style.transform = `rotate(${-yawDeg}deg)`;
      }

      rafRef.current = requestAnimationFrame(updateHUD);
    };
    rafRef.current = requestAnimationFrame(updateHUD);

    return () => {
      clearTimeout(loadTimer);
      cancelAnimationFrame(rafRef.current);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  return (
    <div className="gc">
      <canvas ref={canvasRef} className="gc__canvas" />

      {/* ── Loading screen ─────────────────────────────────────────── */}
      <div className={`gc__loader ${loaded ? 'gc__loader--hidden' : ''}`}>
        <div className="gc__loader-inner">
          <div className="gc__loader-title">DESERT RACER</div>
          <div className="gc__loader-sub">Loading world…</div>
          <div className="gc__loader-bar">
            <div className="gc__loader-fill" />
          </div>
        </div>
      </div>

      {/* ── HUD ────────────────────────────────────────────────────── */}
      <div className={`hud ${loaded ? 'hud--visible' : ''}`}>

        {/* Speed gauge — bottom left */}
        <div className="hud__speed">
          <div className="hud__gauge">
            <svg className="hud__gauge-svg" viewBox="0 0 120 80">
              {/* Background arc */}
              <path
                d="M 10 75 A 55 55 0 0 1 110 75"
                fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6"
                strokeLinecap="round"
              />
              {/* Coloured arc — filled via clip trick */}
              <path
                d="M 10 75 A 55 55 0 0 1 110 75"
                fill="none" stroke="url(#speedGrad)" strokeWidth="6"
                strokeLinecap="round" strokeDasharray="173" strokeDashoffset="173"
                className="hud__gauge-arc"
              />
              <defs>
                <linearGradient id="speedGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%"   stopColor="#00e5ff" />
                  <stop offset="50%"  stopColor="#ff9020" />
                  <stop offset="100%" stopColor="#ff2020" />
                </linearGradient>
              </defs>
            </svg>
            {/* Needle */}
            <div className="hud__needle-wrap">
              <div className="hud__needle" ref={speedNeedleRef} />
            </div>
            <div className="hud__speed-center">
              <span className="hud__speed-num" ref={speedNumRef}>0</span>
              <span className="hud__speed-unit">km/h</span>
            </div>
          </div>
          <div className="hud__bar-bg">
            <div className="hud__bar-fill" ref={speedBarRef} />
          </div>
        </div>

        {/* Time — top right */}
        <div className="hud__time">
          <span className="hud__time-val" ref={timeRef}>15:00</span>
          <span className="hud__time-period" ref={periodRef}>Afternoon</span>
        </div>

        {/* Compass — top centre */}
        <div className="hud__compass-wrap">
          <div className="hud__compass" ref={compassRef}>
            <span className="hud__compass-n">N</span>
            <span className="hud__compass-s">S</span>
            <span className="hud__compass-e">E</span>
            <span className="hud__compass-w">W</span>
            <div className="hud__compass-needle" />
          </div>
        </div>

        {/* Info — top left */}
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

        {/* Title watermark */}
        <div className="hud__title">DESERT RACER</div>

      </div>
    </div>
  );
};

export default GameUI;
