import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/media/presentation/widgets/video_reel_player.dart';

void main() {
  testWidgets('VideoReelPlayer renders player container and handles tap gestures', (tester) async {
    bool doubleTapped = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 360,
            height: 640,
            child: VideoReelPlayer(
              videoUrl: 'https://cdn.interest.app/reels/test/master.m3u8',
              thumbnailUrl: 'https://cdn.interest.app/reels/test/thumb.jpg',
              autoPlay: true,
              onDoubleTap: () => doubleTapped = true,
            ),
          ),
        ),
      ),
    );

    // Initial render shows buffering progress or container
    expect(find.byType(VideoReelPlayer), findsOneWidget);

    // Tap to pause/play
    await tester.tap(find.byType(VideoReelPlayer));
    await tester.pump(const Duration(milliseconds: 650));

    // Double tap triggers callback (e.g. like animation)
    await tester.tap(find.byType(VideoReelPlayer));
    await tester.pump(const Duration(milliseconds: 50));
    await tester.tap(find.byType(VideoReelPlayer));
    await tester.pumpAndSettle();
    expect(doubleTapped, isTrue);
  });
}
