import 'dart:math' as math;

/// High-performance Vector Math engine for the 512-dimensional Interest embedding space.
class VectorMath {
  /// Computes cosine similarity between two float vectors.
  /// S_c(u, v) = (u . v) / (||u|| * ||v||)
  static double cosineSimilarity(List<double> u, List<double> v) {
    if (u.length != v.length || u.isEmpty) return 0.0;

    double dotProduct = 0.0;
    double normU = 0.0;
    double normV = 0.0;

    for (int i = 0; i < u.length; i++) {
      dotProduct += u[i] * v[i];
      normU += u[i] * u[i];
      normV += v[i] * v[i];
    }

    if (normU <= 0.0 || normV <= 0.0) return 0.0;

    final similarity = dotProduct / (math.sqrt(normU) * math.sqrt(normV));
    return similarity.clamp(-1.0, 1.0);
  }

  /// Normalizes a vector to unit length (L2 norm = 1.0).
  static List<double> normalize(List<double> vector) {
    double sumSquares = 0.0;
    for (final val in vector) {
      sumSquares += val * val;
    }

    if (sumSquares <= 0.0) return List<double>.from(vector);

    final norm = math.sqrt(sumSquares);
    return vector.map((val) => val / norm).toList();
  }

  /// Updates the user's affinity centroid using Exponential Moving Average:
  /// c_t = (1 - alpha) * c_{t-1} + alpha * v_{engagement}
  static List<double> updateCentroid({
    required List<double> currentCentroid,
    required List<double> engagementVector,
    double learningRate = 0.15,
  }) {
    if (currentCentroid.length != engagementVector.length) {
      return List<double>.from(currentCentroid);
    }

    final alpha = learningRate.clamp(0.01, 1.0);
    final updated = List<double>.filled(currentCentroid.length, 0.0);

    for (int i = 0; i < currentCentroid.length; i++) {
      updated[i] = (1.0 - alpha) * currentCentroid[i] + alpha * engagementVector[i];
    }

    return normalize(updated);
  }
}
