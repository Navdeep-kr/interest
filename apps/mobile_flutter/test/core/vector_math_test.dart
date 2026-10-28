import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/math/vector_math.dart';

void main() {
  group('VectorMath Tests (512-dim Cosine Similarity & Centroids)', () {
    test('Cosine similarity of identical vectors equals 1.0', () {
      final v1 = [0.5, 0.5, 0.5, 0.5];
      final similarity = VectorMath.cosineSimilarity(v1, v1);

      expect(similarity, closeTo(1.0, 0.0001));
    });

    test('Cosine similarity of orthogonal vectors equals 0.0', () {
      final v1 = [1.0, 0.0, 0.0, 0.0];
      final v2 = [0.0, 1.0, 0.0, 0.0];
      final similarity = VectorMath.cosineSimilarity(v1, v2);

      expect(similarity, closeTo(0.0, 0.0001));
    });

    test('Cosine similarity of opposite vectors equals -1.0', () {
      final v1 = [1.0, 0.0, 0.0];
      final v2 = [-1.0, 0.0, 0.0];
      final similarity = VectorMath.cosineSimilarity(v1, v2);

      expect(similarity, closeTo(-1.0, 0.0001));
    });

    test('Centroid updates toward engaged vector with learning rate alpha', () {
      final initialCentroid = [1.0, 0.0];
      final engagementVector = [0.0, 1.0];

      final updated = VectorMath.updateCentroid(
        currentCentroid: initialCentroid,
        engagementVector: engagementVector,
        learningRate: 0.2,
      );

      // (1 - 0.2)*1.0 = 0.8, 0.2*1.0 = 0.2
      // norm = sqrt(0.8^2 + 0.2^2) = sqrt(0.68) ≈ 0.8246
      // normalized x ≈ 0.9701, y ≈ 0.2425
      expect(updated[0], closeTo(0.9701, 0.001));
      expect(updated[1], closeTo(0.2425, 0.001));
    });
  });
}
