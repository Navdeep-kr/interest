import {
  vectorMagnitude,
  normalizeVector,
  cosineSimilarity,
  cosineDistance,
  applyVectorDrift,
  generateDeterministicUnitVector,
  computeVectorCentroid,
} from '@shared/vector-math';

describe('Vector Mathematics for 512-d Interest Space', () => {
  it('should normalize vectors to unit length (L2 norm = 1.0)', () => {
    const raw = [3, 4, 0, 0];
    const normalized = normalizeVector(raw);
    expect(vectorMagnitude(normalized)).toBeCloseTo(1.0, 5);
    expect(normalized[0]).toBeCloseTo(0.6, 5);
    expect(normalized[1]).toBeCloseTo(0.8, 5);
  });

  it('should calculate cosine similarity accurately', () => {
    const v1 = normalizeVector([1, 0, 0]);
    const v2 = normalizeVector([1, 0, 0]);
    const v3 = normalizeVector([0, 1, 0]);
    const v4 = normalizeVector([-1, 0, 0]);

    expect(cosineSimilarity(v1, v2)).toBeCloseTo(1.0, 5);
    expect(cosineSimilarity(v1, v3)).toBeCloseTo(0.0, 5);
    expect(cosineSimilarity(v1, v4)).toBeCloseTo(-1.0, 5);

    expect(cosineDistance(v1, v2)).toBeCloseTo(0.0, 5);
    expect(cosineDistance(v1, v3)).toBeCloseTo(1.0, 5);
    expect(cosineDistance(v1, v4)).toBeCloseTo(2.0, 5);
  });

  it('should generate deterministic 512-d unit vectors with norm 1.0', () => {
    const vecA = generateDeterministicUnitVector('modular-synths', 512);
    const vecB = generateDeterministicUnitVector('modular-synths', 512);
    const vecC = generateDeterministicUnitVector('horology-watchmaking', 512);

    expect(vecA.length).toBe(512);
    expect(vectorMagnitude(vecA)).toBeCloseTo(1.0, 5);
    expect(vecA).toEqual(vecB);
    expect(cosineSimilarity(vecA, vecC)).toBeLessThan(0.9);
  });

  it('should drift user interest vector closer on positive engagement and further on quick-skip', () => {
    const userVec = generateDeterministicUnitVector('user-initial', 512);
    const reelVec = generateDeterministicUnitVector('analog-wavefolding', 512);

    const initialSim = cosineSimilarity(userVec, reelVec);

    // Positive drift (high watch time / loop)
    const driftedPositive = applyVectorDrift(userVec, reelVec, 0.2);
    const newSimPositive = cosineSimilarity(driftedPositive, reelVec);
    expect(newSimPositive).toBeGreaterThan(initialSim);
    expect(vectorMagnitude(driftedPositive)).toBeCloseTo(1.0, 5);

    // Negative drift (quick skip)
    const driftedNegative = applyVectorDrift(userVec, reelVec, -0.2);
    const newSimNegative = cosineSimilarity(driftedNegative, reelVec);
    expect(newSimNegative).toBeLessThan(initialSim);
    expect(vectorMagnitude(driftedNegative)).toBeCloseTo(1.0, 5);
  });

  it('should compute centroid of multiple interest vectors properly', () => {
    const v1 = [1, 0];
    const v2 = [0, 1];
    const centroid = computeVectorCentroid([v1, v2]);

    expect(vectorMagnitude(centroid)).toBeCloseTo(1.0, 5);
    expect(centroid[0]).toBeCloseTo(Math.SQRT1_2, 5);
    expect(centroid[1]).toBeCloseTo(Math.SQRT1_2, 5);
  });
});
