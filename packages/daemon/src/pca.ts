/**
 * Pure TypeScript PCA implementation using the dual trick.
 *
 * For N vectors of dimension D where N << D (typical: N~200, D=1024),
 * the dual trick works on an N×N Gram matrix instead of D×D covariance,
 * making it vastly more efficient.
 */

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(v: number[]): number {
  return Math.sqrt(dot(v, v));
}

function normalize(v: number[]): number[] {
  const n = norm(v);
  if (n < 1e-10) return v.map(() => 0);
  return v.map((x) => x / n);
}

/**
 * Power iteration to find the dominant eigenvector of a symmetric matrix.
 * Returns [eigenvector, eigenvalue].
 */
function powerIteration(
  matrix: number[][],
  iterations = 100,
): [number[], number] {
  const n = matrix.length;
  // Random-ish initial vector (deterministic for reproducibility)
  let v = Array.from({ length: n }, (_, i) => Math.sin(i * 0.7 + 1.3));
  v = normalize(v);

  let eigenvalue = 0;
  for (let iter = 0; iter < iterations; iter++) {
    const next = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        next[i] += matrix[i][j] * v[j];
      }
    }
    eigenvalue = norm(next);
    if (eigenvalue < 1e-10) break;
    v = normalize(next);
  }

  return [v, eigenvalue];
}

/**
 * Deflate a symmetric matrix by removing the component along eigenvector v.
 * M' = M - eigenvalue * v * v^T
 */
function deflate(
  matrix: number[][],
  eigenvector: number[],
  eigenvalue: number,
): number[][] {
  const n = matrix.length;
  const result = matrix.map((row) => [...row]);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      result[i][j] -= eigenvalue * eigenvector[i] * eigenvector[j];
    }
  }
  return result;
}

export interface PCAResult {
  /** 2D projected points, each [x, y] normalized to roughly [-1, 1] */
  points: [number, number][];
  /** Eigenvalues for the two principal components */
  variance: [number, number];
}

/**
 * Project high-dimensional vectors down to 2D using PCA (dual trick).
 */
export function projectTo2D(vectors: number[][]): PCAResult {
  const n = vectors.length;

  if (n === 0) {
    return { points: [], variance: [0, 0] };
  }

  if (n === 1) {
    return { points: [[0, 0]], variance: [0, 0] };
  }

  // 1. Compute mean and center
  const d = vectors[0].length;
  const mean = new Array(d).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < d; i++) mean[i] += v[i];
  }
  for (let i = 0; i < d; i++) mean[i] /= n;

  const centered = vectors.map((v) => v.map((x, i) => x - mean[i]));

  // 2. Build N×N Gram matrix: G[i][j] = dot(centered[i], centered[j])
  const G: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const d = dot(centered[i], centered[j]);
      G[i][j] = d;
      G[j][i] = d;
    }
  }

  // 3. Find top 2 eigenvectors via power iteration + deflation
  const [ev1, lambda1] = powerIteration(G);
  const G2 = deflate(G, ev1, lambda1);
  const [ev2, lambda2] = powerIteration(G2);

  // 4. Project: the 2D coordinates are simply the Gram eigenvector components
  //    (scaled by sqrt of eigenvalue for proper variance representation)
  const scale1 = lambda1 > 1e-10 ? Math.sqrt(lambda1) : 1;
  const scale2 = lambda2 > 1e-10 ? Math.sqrt(lambda2) : 1;

  const rawPoints: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    rawPoints.push([ev1[i] * scale1, ev2[i] * scale2]);
  }

  // 5. Normalize to [-1, 1] range
  let maxAbs = 0;
  for (const [x, y] of rawPoints) {
    maxAbs = Math.max(maxAbs, Math.abs(x), Math.abs(y));
  }

  const points: [number, number][] =
    maxAbs > 1e-10
      ? rawPoints.map(([x, y]) => [x / maxAbs, y / maxAbs])
      : rawPoints.map(() => [
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1,
        ]);

  return { points, variance: [lambda1, lambda2] };
}
