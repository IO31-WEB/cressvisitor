// Small deterministic PRNG (mulberry32) + a string hash to derive a numeric
// seed from arbitrary strings (address + date range). We intentionally do
// NOT use Math.random anywhere in the synthetic generator so that the same
// address + date range always reproduces byte-identical demo data — this
// matters for screenshots, client demos, and PDF re-exports.

export function hashStringToSeed(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample via Box-Muller, driven by the seeded generator. */
export function seededGaussian(rand: () => number, mean = 0, stdDev = 1): number {
  const u1 = Math.max(rand(), Number.EPSILON);
  const u2 = rand();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * stdDev;
}

export function seededInt(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

export function seededChoice<T>(rand: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rand() * items.length)];
  if (item === undefined) throw new Error("seededChoice: empty array");
  return item;
}
