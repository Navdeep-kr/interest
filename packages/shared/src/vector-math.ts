/**
 * Vector Mathematics Utility for 512-dimensional Interest Embeddings.
 * Provides unit normalization, cosine similarity, centroid updates, and vector drift.
 */

export const VECTOR_DIMENSION = 512;

export function vectorMagnitude(vec: number[]): number {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) {
    sum += vec[i] * vec[i];
  }
  return Math.sqrt(sum);
}

export function normalizeVector(vec: number[]): number[] {
  const mag = vectorMagnitude(vec);
  if (mag === 0) {
    const fallback = new Array(vec.length).fill(0);
    fallback[0] = 1.0;
    return fallback;
  }
  return vec.map((val) => val / mag);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let dotProduct = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
  }
  return dotProduct;
}

export function cosineDistance(a: number[], b: number[]): number {
  return 1 - cosineSimilarity(a, b);
}

export function applyVectorDrift(
  currentVector: number[],
  itemVector: number[],
  learningRate: number,
): number[] {
  const updated = new Array(currentVector.length);
  for (let i = 0; i < currentVector.length; i++) {
    updated[i] = currentVector[i] + learningRate * itemVector[i];
  }
  return normalizeVector(updated);
}

export function generateDeterministicUnitVector(
  seedSlug: string,
  dim: number = VECTOR_DIMENSION,
): number[] {
  let hash = 0;
  for (let i = 0; i < seedSlug.length; i++) {
    hash = (hash << 5) - hash + seedSlug.charCodeAt(i);
    hash |= 0;
  }

  const vec = new Array(dim);
  let localHash = hash;
  for (let i = 0; i < dim; i++) {
    localHash = (localHash * 1664525 + 1013904223) | 0;
    vec[i] = localHash / 2147483648;
  }

  return normalizeVector(vec);
}

export function computeVectorCentroid(vectors: number[][]): number[] {
  if (vectors.length === 0) {
    throw new Error('Cannot compute centroid of an empty array of vectors');
  }
  const dim = vectors[0].length;
  const sum = new Array(dim).fill(0);

  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      sum[i] += vec[i];
    }
  }

  return normalizeVector(sum);
}
