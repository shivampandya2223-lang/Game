/**
 * Lighting System
 * Premium desert sky: gradient sky dome, sun disc, stars at night,
 * dynamic day-night cycle with cinematic colour grading.
 */

import * as THREE from 'three';

export interface LightingState {
  timeOfDay       : number;
  sunIntensity    : number;
  skyColor        : THREE.Color;
  ambientIntensity: number;
  period          : string;
}

interface ColorStop {
  time   : number;
  skyTop : THREE.Color;
  skyHor : THREE.Color;
  fog    : THREE.Color;
  sun    : THREE.Color;
  ambient: number;
}

export class LightingSystem {
  private scene  : THREE.Scene;
  private sun    : THREE.DirectionalLight;
  private ambient: THREE.AmbientLight;
  private hemi   : THREE.HemisphereLight;
  private fog    : THREE.Fog;

  // Sky dome — two-colour gradient via vertex colours
  private skyDome    : THREE.Mesh;
  private sunDisc    : THREE.Mesh;
  private moonDisc   : THREE.Mesh;
  private starField  : THREE.Points;

  private timeOfDay        = 14;
  private readonly TIME_SPEED = 0.003;

  private readonly STOPS: ColorStop[] = [
    // Midnight — deep indigo sky
    { time:  0, skyTop: new THREE.Color(0x03030e), skyHor: new THREE.Color(0x0c0a22), fog: new THREE.Color(0x080618), sun: new THREE.Color(0x5050a0), ambient: 0.05 },
    // Pre-dawn — dark warm horizon
    { time:  4, skyTop: new THREE.Color(0x06040f), skyHor: new THREE.Color(0x1e0e06), fog: new THREE.Color(0x160a04), sun: new THREE.Color(0x7050a0), ambient: 0.07 },
    // Sunrise glow — orange/red horizon, dark blue zenith
    { time:  5, skyTop: new THREE.Color(0x0e1840), skyHor: new THREE.Color(0xff4a0a), fog: new THREE.Color(0xff6828), sun: new THREE.Color(0xff8830), ambient: 0.20 },
    // Early morning — warm horizon, blue sky emerging
    { time:  6, skyTop: new THREE.Color(0x1a3a80), skyHor: new THREE.Color(0xff7820), fog: new THREE.Color(0xffa040), sun: new THREE.Color(0xffcc70), ambient: 0.35 },
    // Morning — clear blue sky, sandy fog
    { time:  8, skyTop: new THREE.Color(0x1255b0), skyHor: new THREE.Color(0x6ab0e0), fog: new THREE.Color(0xd8b878), sun: new THREE.Color(0xfff0c0), ambient: 0.55 },
    // Noon — deep azure zenith, pale horizon
    { time: 12, skyTop: new THREE.Color(0x0840b8), skyHor: new THREE.Color(0x5898d8), fog: new THREE.Color(0xc8a860), sun: new THREE.Color(0xffffff), ambient: 0.72 },
    // Afternoon — slightly warmer
    { time: 15, skyTop: new THREE.Color(0x0e4ec0), skyHor: new THREE.Color(0x68a8dc), fog: new THREE.Color(0xc09858), sun: new THREE.Color(0xffe888), ambient: 0.65 },
    // Late afternoon — golden hour begins
    { time: 17, skyTop: new THREE.Color(0x1a2870), skyHor: new THREE.Color(0xff7818), fog: new THREE.Color(0xff9838), sun: new THREE.Color(0xff9820), ambient: 0.45 },
    // Sunset — fiery orange/red horizon, purple zenith
    { time: 18, skyTop: new THREE.Color(0x200838), skyHor: new THREE.Color(0xff3808), fog: new THREE.Color(0xff5818), sun: new THREE.Color(0xff5010), ambient: 0.30 },
    // Dusk — deep purple, fading orange
    { time: 19, skyTop: new THREE.Color(0x0a0420), skyHor: new THREE.Color(0x3a1206), fog: new THREE.Color(0x2a0e04), sun: new THREE.Color(0xff3808), ambient: 0.14 },
    // Night — back to deep indigo
    { time: 21, skyTop: new THREE.Color(0x03030e), skyHor: new THREE.Color(0x0a0618), fog: new THREE.Color(0x060412), sun: new THREE.Color(0x5050a0), ambient: 0.06 },
    { time: 24, skyTop: new THREE.Color(0x03030e), skyHor: new THREE.Color(0x0c0a22), fog: new THREE.Color(0x080618), sun: new THREE.Color(0x5050a0), ambient: 0.05 },
  ];

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // ── Sun light ─────────────────────────────────────────────────────────
    this.sun = new THREE.DirectionalLight(0xffffff, 2.0);
    this.sun.castShadow = true;
    this.sun.shadow.camera.far    = 700;
    this.sun.shadow.camera.left   = -300;
    this.sun.shadow.camera.right  =  300;
    this.sun.shadow.camera.top    =  300;
    this.sun.shadow.camera.bottom = -300;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.bias          = -0.0002;
    this.sun.shadow.normalBias    = 0.015;
    scene.add(this.sun);
    scene.add(this.sun.target);

    // ── Hemisphere fill ───────────────────────────────────────────────────
    this.hemi = new THREE.HemisphereLight(0x87ceeb, 0xd4a060, 0.7);
    scene.add(this.hemi);

    // ── Ambient ───────────────────────────────────────────────────────────
    this.ambient = new THREE.AmbientLight(0xffeedd, 0.5);
    scene.add(this.ambient);

    // ── Sky dome with gradient ────────────────────────────────────────────
    this.skyDome = this.buildSkyDome();
    scene.add(this.skyDome);

    // ── Sun disc ──────────────────────────────────────────────────────────
    this.sunDisc = new THREE.Mesh(
      new THREE.SphereGeometry(18, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfffce0, fog: false })
    );
    scene.add(this.sunDisc);

    // ── Moon disc ─────────────────────────────────────────────────────────
    this.moonDisc = new THREE.Mesh(
      new THREE.SphereGeometry(10, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xd0d8e8, fog: false })
    );
    scene.add(this.moonDisc);

    // ── Stars ─────────────────────────────────────────────────────────────
    this.starField = this.buildStars();
    scene.add(this.starField);

    // ── Fog ───────────────────────────────────────────────────────────────
    this.fog = new THREE.Fog(0xd4a96a, 180, 1000);
    scene.fog = this.fog;

    this.applyTime();
  }

  // ── Sky dome — vertex-coloured sphere ─────────────────────────────────────

  private buildSkyDome(): THREE.Mesh {
    // Higher resolution sphere for smooth gradient
    const geo    = new THREE.SphereGeometry(950, 48, 32);
    const vCount = geo.attributes.position.count;
    const colors = new Float32Array(vCount * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side        : THREE.BackSide,
      fog         : false,
      depthWrite  : false,
    });
    return new THREE.Mesh(geo, mat);
  }

  private updateSkyGradient(top: THREE.Color, horizon: THREE.Color): void {
    const geo    = this.skyDome.geometry as THREE.BufferGeometry;
    const pos    = geo.attributes.position.array as Float32Array;
    const colors = geo.attributes.color.array as Float32Array;
    const vCount = pos.length / 3;

    // A third colour — the ground-level haze band just below horizon
    const haze = new THREE.Color().lerpColors(horizon, new THREE.Color(0x80500a), 0.35);

    for (let i = 0; i < vCount; i++) {
      const y = pos[i * 3 + 1];
      // t: 0 = bottom of sphere, 1 = top
      const t = Math.max(0, Math.min(1, (y / 950 + 1) * 0.5));

      let c: THREE.Color;
      if (t < 0.42) {
        // Below horizon: haze band
        const p = t / 0.42;
        const ep = p * p * (3 - 2 * p);
        c = new THREE.Color().lerpColors(haze, horizon, ep);
      } else {
        // Above horizon: horizon → zenith
        const p = (t - 0.42) / 0.58;
        // Exponential curve — sky darkens quickly above horizon
        const ep = 1 - Math.pow(1 - p, 1.8);
        c = new THREE.Color().lerpColors(horizon, top, ep);
      }

      colors[i * 3]     = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.attributes.color.needsUpdate = true;
  }

  // ── Stars ─────────────────────────────────────────────────────────────────

  private buildStars(): THREE.Points {
    const count  = 2000;
    const pos    = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Random point on upper hemisphere
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.random() * Math.PI * 0.5; // upper half only
      const r     = 900;
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const bright = 0.7 + Math.random() * 0.3;
      const warm   = Math.random() > 0.8 ? 0.9 : 1.0;
      colors[i * 3]     = bright * warm;
      colors[i * 3 + 1] = bright;
      colors[i * 3 + 2] = bright;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size        : 1.8,
      vertexColors: true,
      fog         : false,
      sizeAttenuation: true,
      transparent : true,
      opacity     : 1.0,
    });
    return new THREE.Points(geo, mat);
  }

  // ── Interpolation ─────────────────────────────────────────────────────────

  private interp(t: number): ColorStop & { skyTop: THREE.Color; skyHor: THREE.Color } {
    const stops = this.STOPS;
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i].time && t <= stops[i + 1].time) {
        a = stops[i]; b = stops[i + 1]; break;
      }
    }
    const range = b.time - a.time || 1;
    const p     = (t - a.time) / range;
    const ep    = p * p * (3 - 2 * p);

    return {
      time   : t,
      skyTop : new THREE.Color().copy(a.skyTop).lerp(b.skyTop, ep),
      skyHor : new THREE.Color().copy(a.skyHor).lerp(b.skyHor, ep),
      fog    : new THREE.Color().copy(a.fog).lerp(b.fog, ep),
      sun    : new THREE.Color().copy(a.sun).lerp(b.sun, ep),
      ambient: a.ambient + (b.ambient - a.ambient) * ep,
    };
  }

  private sunPosition(t: number): THREE.Vector3 {
    const angle  = ((t - 6) / 12) * Math.PI;
    const radius = 700;
    return new THREE.Vector3(
      Math.cos(angle - Math.PI / 2) * radius,
      Math.sin(angle) * radius + 20,
      -80
    );
  }

  private moonPosition(t: number): THREE.Vector3 {
    // Moon is opposite the sun
    const angle  = ((t + 6) / 12) * Math.PI;
    const radius = 700;
    return new THREE.Vector3(
      Math.cos(angle - Math.PI / 2) * radius,
      Math.sin(angle) * radius + 20,
      -80
    );
  }

  private sunIntensity(t: number): number {
    if (t >= 6  && t <= 18) return Math.max(0.15, Math.sin(((t - 6) / 12) * Math.PI) * 2.4);
    if (t > 18  && t < 20)  return (20 - t) * 0.12;
    if (t > 4   && t < 6)   return (t - 4)  * 0.12;
    return 0.05;
  }

  // ── Apply ─────────────────────────────────────────────────────────────────

  private applyTime(): void {
    const t   = this.timeOfDay;
    const c   = this.interp(t);
    const si  = this.sunIntensity(t);
    const sp  = this.sunPosition(t);
    const mp  = this.moonPosition(t);

    // Sun light
    this.sun.position.copy(sp);
    this.sun.color.copy(c.sun);
    this.sun.intensity  = si;
    this.sun.castShadow = si > 0.15;

    // Ambient
    this.ambient.color.copy(c.sun);
    this.ambient.intensity = c.ambient;

    // Hemisphere
    this.hemi.color.copy(c.skyHor);
    this.hemi.groundColor.set(0xc89050);
    this.hemi.intensity = c.ambient * 0.9;

    // Sky gradient
    this.updateSkyGradient(c.skyTop, c.skyHor);
    this.scene.background = c.skyTop.clone();

    // Fog
    this.fog.color.copy(c.fog);

    // Sun disc position & visibility
    this.sunDisc.position.copy(sp.clone().normalize().multiplyScalar(880));
    const sunVis = Math.max(0, si / 2.4);
    (this.sunDisc.material as THREE.MeshBasicMaterial).opacity = sunVis;
    (this.sunDisc.material as THREE.MeshBasicMaterial).transparent = true;

    // Sun disc colour — orange at horizon, white at noon
    const horizonFactor = 1 - Math.max(0, sp.y / 700);
    const discColor = new THREE.Color().lerpColors(
      new THREE.Color(0xffffff),
      new THREE.Color(0xff8020),
      horizonFactor * 0.8
    );
    (this.sunDisc.material as THREE.MeshBasicMaterial).color.copy(discColor);

    // Moon
    this.moonDisc.position.copy(mp.clone().normalize().multiplyScalar(880));
    const moonVis = t < 5 || t > 19 ? 0.85 : 0;
    (this.moonDisc.material as THREE.MeshBasicMaterial).opacity = moonVis;
    (this.moonDisc.material as THREE.MeshBasicMaterial).transparent = true;

    // Stars — visible at night
    const starOpacity = t < 5 || t > 19
      ? 0.9
      : t < 6
        ? (6 - t) * 0.9
        : t > 18
          ? (t - 18) * 0.9
          : 0;
    (this.starField.material as THREE.PointsMaterial).opacity = starOpacity;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(dt: number): void {
    this.timeOfDay = (this.timeOfDay + dt * this.TIME_SPEED) % 24;
    this.applyTime();
  }

  setTimeOfDay(h: number): void {
    this.timeOfDay = h % 24;
    this.applyTime();
  }

  getState(): LightingState {
    const t = this.timeOfDay;
    let period = 'Night';
    if      (t >= 6  && t < 12) period = 'Morning';
    else if (t >= 12 && t < 17) period = 'Afternoon';
    else if (t >= 17 && t < 20) period = 'Evening';
    return {
      timeOfDay       : t,
      sunIntensity    : this.sunIntensity(t),
      skyColor        : this.interp(t).skyTop,
      ambientIntensity: this.ambient.intensity,
      period,
    };
  }

  dispose(): void {
    this.scene.remove(this.sun, this.hemi, this.ambient,
                      this.skyDome, this.sunDisc, this.moonDisc, this.starField);
    this.skyDome.geometry.dispose();
    (this.skyDome.material as THREE.Material).dispose();
    this.sunDisc.geometry.dispose();
    (this.sunDisc.material as THREE.Material).dispose();
    this.moonDisc.geometry.dispose();
    (this.moonDisc.material as THREE.Material).dispose();
    this.starField.geometry.dispose();
    (this.starField.material as THREE.Material).dispose();
  }
}
