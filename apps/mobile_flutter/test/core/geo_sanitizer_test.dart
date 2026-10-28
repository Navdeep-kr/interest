import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/sanitizer/geo_sanitizer.dart';

void main() {
  group('GeoSanitizer Tests (Zero-Location Invariant)', () {
    test('Strips latitude and longitude coordinates from text', () {
      const textWithCoords = 'Coffee extraction tips in Tokyo at 35.6762, 139.6503 for espresso lovers';
      final cleaned = GeoSanitizer.sanitizeText(textWithCoords);

      expect(cleaned, equals('Coffee extraction tips in Tokyo at for espresso lovers'));
      expect(GeoSanitizer.containsLocationCoordinates(cleaned), isFalse);
    });

    test('Leaves coordinate-free text completely unaltered', () {
      const pureInterestText = 'How to calibrate your pottery kiln for crystalline glazes';
      final result = GeoSanitizer.sanitizeText(pureInterestText);

      expect(result, equals(pureInterestText));
    });

    test('Deletes prohibited geo keys from telemetry payload maps', () {
      final dirtyPayload = {
        'reelId': 'reel-123',
        'durationMs': 15000,
        'lat': 37.7749,
        'lng': -122.4194,
        'city': 'San Francisco',
        'country': 'USA',
        'interestTag': 'Ceramics',
      };

      final cleanPayload = GeoSanitizer.sanitizePayload(dirtyPayload);

      expect(cleanPayload.containsKey('reelId'), isTrue);
      expect(cleanPayload.containsKey('durationMs'), isTrue);
      expect(cleanPayload.containsKey('interestTag'), isTrue);
      expect(cleanPayload.containsKey('lat'), isFalse);
      expect(cleanPayload.containsKey('lng'), isFalse);
      expect(cleanPayload.containsKey('city'), isFalse);
      expect(cleanPayload.containsKey('country'), isFalse);
    });
  });
}
