export class SeededRNG {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  /**
   * Returns a pseudo-random number between 0 (inclusive) and 1 (exclusive).
   * Uses a simple Linear Congruential Generator (LCG).
   */
  next(): number {
    // LCG constants (same as glibc)
    const a = 1103515245;
    const c = 12345;
    const m = 2147483648;

    this.seed = (a * this.seed + c) % m;
    return this.seed / m;
  }

  /**
   * Returns a pseudo-random integer between min (inclusive) and max (inclusive).
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}
