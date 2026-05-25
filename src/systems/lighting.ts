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
  nightFactor     : number;
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
  private moonLight: THREE.DirectionalLight;
  private ambient: THREE.AmbientLight;
  private hemi   : THREE.HemisphereLight;
  private fog    : THREE.Fog;

  // Sky dome — two-colour gradient via vertex colours
  private skyDome    : THREE.Mesh;
  private sunDisc    : THREE.Mesh;
  private moonDisc   : THREE.Mesh;
  private starField  : THREE.Points;
  private focus      = new THREE.Vector3();

  private timeOfDay = 15.2;
  private readonly IDLE_DAY_SECONDS = 1080; // 18 minutes if the player waits.
  private readonly DRIVE_DAY_SECONDS = 420; // 7 minutes while driving.

  private readonly STOPS: ColorStop[] = [
    { time:  0, skyTop: new THREE.Color(0x030712), skyHor: new THREE.Color(0x08101f), fog: new THREE.Color(0x060a12), sun: new THREE.Color(0x9eb8ff), ambient: 0.08 },
    { time:  4, skyTop: new THREE.Color(0x050916), skyHor: new THREE.Color(0x20150f), fog: new THREE.Color(0x120d0b), sun: new THREE.Color(0xb8a2ff), ambient: 0.10 },
    { time:  5, skyTop: new THREE.Color(0x13254a), skyHor: new THREE.Color(0xc66f35), fog: new THREE.Color(0x8f6038), sun: new THREE.Color(0xf0a15a), ambient: 0.24 },
    { time:  6, skyTop: new THREE.Color(0x2f5f93), skyHor: new THREE.Color(0xd7a15a), fog: new THREE.Color(0xb68a56), sun: new THREE.Color(0xffd28a), ambient: 0.38 },
    { time:  8, skyTop: new THREE.Color(0x3f83c4), skyHor: new THREE.Color(0x9fc4db), fog: new THREE.Color(0xc0a476), sun: new THREE.Color(0xffedc0), ambient: 0.58 },
    { time: 12, skyTop: new THREE.Color(0x2d72bf), skyHor: new THREE.Color(0xa8cfe6), fog: new THREE.Color(0xcab48a), sun: new THREE.Color(0xffffff), ambient: 0.76 },
    { time: 15, skyTop: new THREE.Color(0x4f8bc5), skyHor: new THREE.Color(0xb5cbd8), fog: new THREE.Color(0xb99a68), sun: new THREE.Color(0xffe5a6), ambient: 0.64 },
    { time: 17, skyTop: new THREE.Color(0x40537e), skyHor: new THREE.Color(0xc88444), fog: new THREE.Color(0x9e7044), sun: new THREE.Color(0xffb064), ambient: 0.42 },
    { time: 18, skyTop: new THREE.Color(0x251c35), skyHor: new THREE.Color(0xb65b2d), fog: new THREE.Color(0x6e442d), sun: new THREE.Color(0xff7a38), ambient: 0.26 },
    { time: 19, skyTop: new THREE.Color(0x0b1024), skyHor: new THREE.Color(0x2f211d), fog: new THREE.Color(0x17100f), sun: new THREE.Color(0x8098d8), ambient: 0.13 },
    { time: 21, skyTop: new THREE.Color(0x030712), skyHor: new THREE.Color(0x08101f), fog: new THREE.Color(0x060a12), sun: new THREE.Color(0x9eb8ff), ambient: 0.08 },
    { time: 24, skyTop: new THREE.Color(0x030712), skyHor: new THREE.Color(0x08101f), fog: new THREE.Color(0x060a12), sun: new THREE.Color(0x9eb8ff), ambient: 0.08 },
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

    this.moonLight = new THREE.DirectionalLight(0xbfd2ff, 0.0);
    this.moonLight.castShadow = false;
    scene.add(this.moonLight);
    scene.add(this.moonLight.target);

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
    this.fog = new THREE.Fog(0xd4a96a, 160, 1050);
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
    if (t >= 5.5 && t <= 18.5) {
      const p = THREE.MathUtils.clamp((t - 5.5) / 13, 0, 1);
      return Math.max(0.08, Math.sin(p * Math.PI) * 2.35);
    }
    return 0;
  }

  private moonIntensity(t: number): number {
    if (t >= 19 || t <= 5) return 0.38;
    if (t > 5 && t < 6) return (6 - t) * 0.38;
    if (t > 18 && t < 19) return (t - 18) * 0.38;
    return 0;
  }

  getNightFactor(): number {
    const t = this.timeOfDay;
    if (t >= 19 || t <= 5) return 1;
    if (t > 18 && t < 19) return t - 18;
    if (t > 5 && t < 6) return 6 - t;
    return 0;
  }

  private cycleSpeed(speedKmh: number): number {
    const drive = THREE.MathUtils.clamp(speedKmh / 80, 0, 1);
    const daySeconds = THREE.MathUtils.lerp(this.IDLE_DAY_SECONDS, this.DRIVE_DAY_SECONDS, drive);
    return 24 / daySeconds;
  }

  // ── Apply ─────────────────────────────────────────────────────────────────

  private applyTime(): void {
    const t   = this.timeOfDay;
    const c   = this.interp(t);
    const si  = this.sunIntensity(t);
    const mi  = this.moonIntensity(t);
    const sp  = this.sunPosition(t);
    const mp  = this.moonPosition(t);

    this.skyDome.position.copy(this.focus);
    this.starField.position.copy(this.focus);
    this.sun.target.position.copy(this.focus);
    this.moonLight.target.position.copy(this.focus);

    // Sun light
    this.sun.position.copy(this.focus).add(sp);
    this.sun.color.copy(c.sun);
    this.sun.intensity  = si;
    this.sun.castShadow = si > 0.15;

    this.moonLight.position.copy(this.focus).add(mp);
    this.moonLight.color.set(0xbfd2ff);
    this.moonLight.intensity = mi;

    // Ambient
    this.ambient.color.copy(t < 5 || t > 19 ? new THREE.Color(0xaec6ff) : c.sun);
    this.ambient.intensity = c.ambient;

    // Hemisphere
    this.hemi.color.copy(c.skyHor);
    this.hemi.groundColor.set(t < 5 || t > 19 ? 0x2c3550 : 0xb08050);
    this.hemi.intensity = c.ambient * 0.9;

    // Sky gradient
    this.updateSkyGradient(c.skyTop, c.skyHor);
    this.scene.background = c.skyTop.clone();

    // Fog
    this.fog.color.copy(c.fog);

    // Sun disc position & visibility
    this.sunDisc.position.copy(this.focus).add(sp.clone().normalize().multiplyScalar(880));
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
    this.moonDisc.position.copy(this.focus).add(mp.clone().normalize().multiplyScalar(880));
    const moonVis = THREE.MathUtils.clamp(mi / 0.38, 0, 1) * 0.9;
    (this.moonDisc.material as THREE.MeshBasicMaterial).opacity = moonVis;
    (this.moonDisc.material as THREE.MeshBasicMaterial).transparent = true;

    // Stars — visible at night
    const starOpacity = t < 5 || t > 20
      ? 0.95
      : t < 6
        ? (6 - t) * 0.95
        : t > 18
          ? THREE.MathUtils.clamp((t - 18) / 2, 0, 1) * 0.95
          : 0;
    (this.starField.material as THREE.PointsMaterial).opacity = starOpacity;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(dt: number, speedKmh = 0, focus?: THREE.Vector3): void {
    if (focus) this.focus.copy(focus);
    this.timeOfDay = (this.timeOfDay + dt * this.cycleSpeed(speedKmh)) % 24;
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
      nightFactor     : this.getNightFactor(),
    };
  }

  dispose(): void {
    this.scene.remove(this.sun, this.moonLight, this.hemi, this.ambient,
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
