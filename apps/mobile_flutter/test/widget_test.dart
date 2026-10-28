import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app.dart';
import 'package:mobile/core/config/env_config.dart';

void main() {
  setUp(() {
    EnvConfig.initialize(overrideEnv: Environment.dev);
  });

  testWidgets('FoundationHomeScreen renders correctly with brand elements', (WidgetTester tester) async {
    // Build FoundationHomeScreen and trigger a frame.
    await tester.pumpWidget(
      const MaterialApp(
        home: FoundationHomeScreen(),
      ),
    );

    // Verify brand title is displayed
    expect(find.text('Interest'), findsOneWidget);

    // Verify environment indicator is rendered
    expect(find.text('DEV'), findsOneWidget);

    // Verify subtitle text
    expect(find.text('Foundation & Release Configuration'), findsOneWidget);

    // Verify Zero-Location policy badge
    expect(find.text('ENFORCED (0 Geo Permissions)'), findsOneWidget);
  });

  testWidgets('InterestApp renders LoginScreen when unauthenticated', (WidgetTester tester) async {
    await tester.pumpWidget(const InterestApp());
    await tester.pump();

    // Verify Login Screen brand text and form elements
    expect(find.text('Interest'), findsOneWidget);
    expect(find.text('Sign In'), findsOneWidget);
    expect(find.text('Sign Up'), findsOneWidget);
  });
}
