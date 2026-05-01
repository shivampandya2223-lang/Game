/**
 * Lighting System
 * Desert day-night cycle: blazing noon sun → fiery sunset → starry night
 */

import * as THREE from 'three';

export interface LightingState {
  timeOfDay: number;   // 0-24
  sunIntensity: number;
  skyColor: THREE.Color;
  ambientIntensity: number;
  period: string;
}

interface ColorStop { time: number; sky: THREE.Color; fog: THREE.Color; sun: THREE.Color; ambient: number; }

export class LightingSystem {
  private scene: THREE.Scene;
  private sun: THREE.DirectionalLight;
  private ambient: THREE.AmbientLight;
  private hemi: THREE.HemisphereLight;
  private skyMesh: THREE.Mesh;
  private fog: THREE.Fog;

  private timeOfDay = 14;          // start mid-afternoon
  private readonly TIME_SPEED = 0.004; // real-time → game hours

  // Desert palette keyframes
  private readonly STOPS: ColorStop[] = [
    { time:  0, sky: new THREE.Color(0x05050f), fog: new THREE.Color(0x0a0a20), sun: new THREE.Color(0x8888cc), ambient: 0.08 },
    { time:  5, sky: new THREE.Color(0x2a1a0a), fog: new THREE.Color(0x3a2010), sun: new THREE.Color(0xff9940), ambient: 0.15 },
    { time:  6, sky: new THREE.Color(0xff7030), fog: new THREE.Color(0xff9050), sun: new THREE.Color(0xffcc80), ambient: 0.30 },
    { time:  8, sky: new THREE.Color(0x4fa0e0), fog: new THREE.Color(0xd4a96a), sun: new THREE.Color(0xfff0c0), ambient: 0.50 },
    { time: 12, sky: new THREE.Color(0x2a86e0), fog: new THREE.Color(0xd0a060), sun: new THREE.Color(0xffffff), ambient: 0.65 },
    { time: 16, sky: new THREE.Color(0x3a90d8), fog: new THREE.Color(0xc89050), sun: new THREE.Color(0xffe090), ambient: 0.55 },
    { time: 18, sky: new THREE.Color(0xff5010), fog: new THREE.Color(0xff7030), sun: new THREE.Color(0xff8040), ambient: 0.35 },
    { time: 19, sky: new THREE.Color(0x200a00), fog: new THREE.Color(0x3a1800), sun: new THREE.Color(0xff5020), ambient: 0.15 },
    { time: 22, sky: new THREE.Color(0x020208), fog: new THREE.Color(0x060614), sun: new THREE.Color(0x6060a0), ambient: 0.07 },
    { time: 24, sky: new THREE.Color(0x05050f), fog: new THREE.Color(0x0a0a20), sun: new THREE.Color(0x8888cc), ambient: 0.08 },
  ];

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // ── Sun ────────────────────────────────────────────────────────────────
    this.sun = new THREE.DirectionalLight(0xffffff, 1.8);
    this.sun.castShadow = true;
    this.sun.shadow.camera.far    = 600;
    this.sun.shadow.camera.left   = -250;
    this.sun.shadow.camera.right  =  250;
    this.sun.shadow.camera.top    =  250;
    this.sun.shadow.camera.bottom = -250;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias          = -0.0003;
    this.sun.shadow.normalBias    = 0.02;
    scene.add(this.sun);
    scene.add(this.sun.target); // target stays at 0,0,0

    // ── Hemisphere (sky/ground fill) ───────────────────────────────────────
    this.hemi = new THREE.HemisphereLight(0x87ceeb, 0xd4a060, 0.6);
    scene.add(this.hemi);

    // ── Ambient ────────────────────────────────────────────────────────────
    this.ambient = new THREE.AmbientLight(0xffeedd, 0.5);
    scene.add(this.ambient);

    // ── Sky sphere ────────────────────────────────────────────────────────
    this.skyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 16),
      new THREE.MeshBasicMaterial({ color: 0x2a86e0, side: THREE.BackSide, fog: false })
    );
    scene.add(this.skyMesh);

    // ── Fog (desert haze) ─────────────────────────────────────────────────
    this.fog = new THREE.Fog(0xd4a96a, 200, 900);
    scene.fog = this.fog;

    this.applyTime();
  }

  // ── Interpolation helpers ─────────────────────────────────────────────────

  private interp(t: number): ColorStop {
    const stops = this.STOPS;
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i].time && t <= stops[i + 1].time) {
        a = stops[i]; b = stops[i + 1]; break;
      }
    }
    const range = b.time - a.time || 1;
    const p     = (t - a.time) / range;
    const ep    = p * p * (3 - 2 * p); // smoothstep

    const sky = new THREE.Color().copy(a.sky).lerp(b.sky, ep);
    const fog = new THREE.Color().copy(a.fog).lerp(b.fog, ep);
    const sun = new THREE.Color().copy(a.sun).lerp(b.sun, ep);
    const ambient = a.ambient + (b.ambient - a.ambient) * ep;
    return { time: t, sky, fog, sun, ambient };
  }

  private sunPosition(t: number): THREE.Vector3 {
    // Arc from east (t=6) through zenith (t=12) to west (t=18)
    const angle  = ((t - 6) / 12) * Math.PI;      // 0 → π across the sky
    const radius = 400;
    return new THREE.Vector3(
      Math.cos(angle - Math.PI / 2) * radius,
      Math.sin(angle) * radius + 30,
      -60
    );
  }

  private sunIntensity(t: number): number {
    if (t >= 6  && t <= 18) return Math.max(0.2, Math.sin(((t - 6) / 12) * Math.PI) * 2.2);
    if (t > 18  && t < 20)  return (20 - t) * 0.15;
    if (t > 4   && t < 6)   return (t - 4)  * 0.15;
    return 0.06; // moonlight
  }

  // ── Apply current time to scene ───────────────────────────────────────────

  private applyTime(): void {
    const t   = this.timeOfDay;
    const c   = this.interp(t);
    const pos = this.sunPosition(t);
    const si  = this.sunIntensity(t);

    this.sun.position.copy(pos);
    this.sun.color.copy(c.sun);
    this.sun.intensity      = si;
    this.sun.castShadow     = si > 0.2;

    this.ambient.color.copy(c.sun);
    this.ambient.intensity  = c.ambient;

    this.hemi.color.copy(c.sky);          // HemisphereLight sky = .color
    this.hemi.groundColor.set(0xd4a060);
    this.hemi.intensity     = c.ambient * 0.8;

    (this.skyMesh.material as THREE.MeshBasicMaterial).color.copy(c.sky);
    this.fog.color.copy(c.fog);
    this.scene.background = c.sky.clone();
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(dt: number): void {
    this.timeOfDay = (this.timeOfDay + dt * this.TIME_SPEED) % 24;
    this.applyTime();
  }

  setTimeOfDay(h: number): void { this.timeOfDay = h % 24; this.applyTime(); }

  getState(): LightingState {
    const t = this.timeOfDay;
    let period = 'Night';
    if      (t >= 6  && t < 12) period = 'Morning';
    else if (t >= 12 && t < 17) period = 'Afternoon';
    else if (t >= 17 && t < 20) period = 'Evening';
    return {
      timeOfDay      : t,
      sunIntensity   : this.sunIntensity(t),
      skyColor       : (this.skyMesh.material as THREE.MeshBasicMaterial).color.clone(),
      ambientIntensity: this.ambient.intensity,
      period,
    };
  }

  dispose(): void {
    this.scene.remove(this.sun, this.hemi, this.ambient, this.skyMesh);
    this.skyMesh.geometry.dispose();
    (this.skyMesh.material as THREE.Material).dispose();
  }
}
