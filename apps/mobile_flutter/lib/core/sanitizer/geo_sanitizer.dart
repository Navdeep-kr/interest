/// Zero-Location architectural guard.
/// Ensures no GPS coordinates, latitude/longitude numbers, or geographical
/// identifiers leak into telemetry, search queries, or outgoing payloads.
class GeoSanitizer {
  // Regex for latitude/longitude coordinate pairs (e.g., 37.7749, -122.4194)
  static final RegExp _latLngRegex = RegExp(
    r'[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)',
  );

  // Prohibited geo-centric keywords and parameter keys
  static final List<String> _prohibitedKeys = [
    'latitude',
    'longitude',
    'lat',
    'lng',
    'geo',
    'geolocation',
    'coordinates',
    'city',
    'country',
    'postalcode',
    'zipcode',
    'nearby',
    'location',
  ];

  /// Sanitizes user text (titles, captions, search queries) by stripping coordinates.
  static String sanitizeText(String text) {
    if (text.isEmpty) return text;
    var result = text.replaceAll(_latLngRegex, '');
    // Clean up multiple spaces left behind by removal
    result = result.replaceAll(RegExp(r'\s{2,}'), ' ').trim();
    return result;
  }

  /// Sanitizes payload maps by deleting any prohibited location keys.
  static Map<String, dynamic> sanitizePayload(Map<String, dynamic> payload) {
    final cleanMap = Map<String, dynamic>.from(payload);
    cleanMap.removeWhere((key, value) {
      final lowerKey = key.toLowerCase();
      return _prohibitedKeys.any((prohibited) => lowerKey.contains(prohibited));
    });
    return cleanMap;
  }

  /// Verifies whether a string contains prohibited coordinate patterns.
  static bool containsLocationCoordinates(String text) {
    return _latLngRegex.hasMatch(text);
  }
}
