/**
 * Simplex Noise Implementation
 * Used for procedural terrain generation
 */

export class SimplexNoise {
  private permutation: number[] = [];
  private p: number[] = [];

  constructor(seed = 0) {
    this.permutation = [];
    for (let i = 0; i < 256; i++) {
      this.permutation[i] = i;
    }

    // Shuffle with seed
    for (let i = 255; i > 0; i--) {
      const j = Math.floor((seed + Math.sin(seed * i) * 10000) * (i + 1)) % (i + 1);
      [this.permutation[i], this.permutation[j]] = [this.permutation[j], this.permutation[i]];
    }

    this.p = [...this.permutation, ...this.permutation];
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 8 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise(x: number, y: number): number {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = this.fade(xf);
    const v = this.fade(yf);

    const aa = this.p[this.p[xi] + yi];
    const ab = this.p[this.p[xi] + yi + 1];
    const ba = this.p[this.p[xi + 1] + yi];
    const bb = this.p[this.p[xi + 1] + yi + 1];

    const x1 = this.lerp(u, this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf));
    const x2 = this.lerp(u, this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1));

    return this.lerp(v, x1, x2);
  }

  fbm(x: number, y: number, octaves = 4, persistence = 0.5, lacunarity = 2): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let max_value = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise(x * frequency, y * frequency);
      max_value += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return value / max_value;
  }
}
