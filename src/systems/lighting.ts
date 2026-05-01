/**
 * Lighting System
 * Handles dynamic day-night cycle with realistic lighting
 */

import * as THREE from 'three';

export interface LightingState {
  timeOfDay: number;
  sunIntensity: number;
  sunColor: THREE.Color;
  skyColor: THREE.Color;
  ambientIntensity: number;
}

export class LightingSystem {
  private scene: THREE.Scene;
  private sunLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;
  private skyMesh: THREE.Mesh;
  private fog: THREE.Fog;
  
  // Time tracking
  private timeOfDay = 6; // 0-24 hours
  private timeSpeed = 0.005; // Speed of time progression
  
  // Color palettes
  private skyColors = [
    { time: 0, color: new THREE.Color(0x0a0a1a) },    // Midnight
    { time: 4, color: new THREE.Color(0x1a1a3a) },    // Pre-dawn
    { time: 6, color: new THREE.Color(0xff6b35) },    // Sunrise
    { time: 8, color: new THREE.Color(0x87ceeb) },    // Morning
    { time: 12, color: new THREE.Color(0x87ceeb) },   // Noon
    { time: 16, color: new THREE.Color(0xff8c42) },   // Afternoon
    { time: 18, color: new THREE.Color(0xff6b35) },   // Sunset
    { time: 20, color: new THREE.Color(0x1a1a3a) },   // Dusk
    { time: 24, color: new THREE.Color(0x0a0a1a) },   // Night
  ];

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Setup directional light (sun)
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.camera.far = 500;
    this.sunLight.shadow.camera.left = -200;
    this.sunLight.shadow.camera.right = 200;
    this.sunLight.shadow.camera.top = 200;
    this.sunLight.shadow.camera.bottom = -200;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.bias = -0.0001;
    scene.add(this.sunLight);

    // Setup ambient light
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(this.ambientLight);

    // Create sky
    this.skyMesh = this.createSkyMesh();
    scene.add(this.skyMesh);

    // Setup fog
    this.fog = new THREE.Fog(0x87ceeb, 500, 1000);
    scene.fog = this.fog;

    // Configure renderer settings
    scene.background = new THREE.Color(0x87ceeb);
  }

  private createSkyMesh(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(400, 64, 64);
    const material = new THREE.MeshBasicMaterial({
      color: 0x87ceeb,
      side: THREE.BackSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
  }

  private interpolateColor(_t: number): THREE.Color {
    // Normalize time to 0-1
    const normalizedTime = ((this.timeOfDay % 24) + 24) % 24;

    // Find surrounding color points
    let before = this.skyColors[0];
    let after = this.skyColors[this.skyColors.length - 1];

    for (let i = 0; i < this.skyColors.length - 1; i++) {
      if (normalizedTime >= this.skyColors[i].time && normalizedTime <= this.skyColors[i + 1].time) {
        before = this.skyColors[i];
        after = this.skyColors[i + 1];
        break;
      }
    }

    // Interpolate between colors
    const range = after.time - before.time;
    const progress = (normalizedTime - before.time) / range;
    const easeProgress = Math.sin(progress * Math.PI) * 0.5 + 0.5; // Smooth interpolation

    const result = new THREE.Color();
    result.lerpColors(before.color, after.color, easeProgress);
    return result;
  }

  private getSunIntensity(): number {
    const normalizedTime = ((this.timeOfDay % 24) + 24) % 24;

    // Sun intensity curve
    if (normalizedTime >= 6 && normalizedTime <= 18) {
      // Daytime - peak at noon
      const midday = Math.abs(normalizedTime - 12);
      return Math.max(0.3, 1 - midday * 0.06);
    } else if (normalizedTime > 18 && normalizedTime < 20) {
      // Sunset fade
      return 1 - (normalizedTime - 18) * 0.5;
    } else if (normalizedTime > 4 && normalizedTime < 6) {
      // Sunrise fade
      return (normalizedTime - 4) * 0.5;
    } else {
      // Night - faint moonlight
      return 0.1;
    }
  }

  private getSunPosition(): { x: number; y: number; z: number } {
    const normalizedTime = ((this.timeOfDay % 24) + 24) % 24;
    const angle = (normalizedTime / 24) * Math.PI * 2 - Math.PI / 2;

    const distance = 250;
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance + 50,
      z: 150,
    };
  }

  update(deltaTime: number): void {
    // Update time of day
    this.timeOfDay += deltaTime * this.timeSpeed;
    if (this.timeOfDay >= 24) {
      this.timeOfDay -= 24;
    }

    const intensity = this.getSunIntensity();
    const sunColor = this.interpolateColor(this.timeOfDay);
    const sunPos = this.getSunPosition();

    // Update sun light
    this.sunLight.color = sunColor;
    this.sunLight.intensity = Math.max(intensity, 0.1);
    this.sunLight.position.set(sunPos.x, sunPos.y, sunPos.z);

    // Update ambient light
    this.ambientLight.intensity = Math.max(intensity * 0.5, 0.15);
    this.ambientLight.color = this.interpolateColor(this.timeOfDay);

    // Update sky color
    const skyMaterial = new THREE.MeshBasicMaterial({
      color: this.interpolateColor(this.timeOfDay),
      side: THREE.BackSide,
    });
    this.skyMesh.material = skyMaterial;

    // Update fog color to match sky
    const fogColor = this.interpolateColor(this.timeOfDay);
    (this.fog.color as THREE.Color).copy(fogColor);

    // Update background
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(fogColor);
    } else {
      this.scene.background = fogColor.clone();
    }
  }

  getState(): LightingState {
    return {
      timeOfDay: this.timeOfDay,
      sunIntensity: this.getSunIntensity(),
      sunColor: new THREE.Color(this.sunLight.color),
      skyColor: new THREE.Color((this.skyMesh.material as THREE.MeshBasicMaterial).color),
      ambientIntensity: this.ambientLight.intensity,
    };
  }

  setTimeOfDay(hours: number): void {
    this.timeOfDay = hours % 24;
  }

  setTimeSpeed(speed: number): void {
    this.timeSpeed = speed;
  }

  dispose(): void {
    this.scene.remove(this.sunLight);
    this.scene.remove(this.ambientLight);
    this.scene.remove(this.skyMesh);
    this.skyMesh.geometry.dispose();
    (this.skyMesh.material as THREE.Material).dispose();
  }
}
