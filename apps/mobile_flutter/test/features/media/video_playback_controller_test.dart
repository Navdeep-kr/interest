import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/media/presentation/controllers/video_playback_controller.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('VideoPlaybackController Lifecycle & Memory Tests', () {
    test('Initializes with buffering and transitions to playing when autoPlay is true', () async {
      final controller = VideoPlaybackController(
        videoUrl: 'https://cdn.interest.app/reels/test/master.m3u8',
        autoPlay: true,
      );

      // Initially buffering
      expect(controller.state, PlaybackState.buffering);

      // Wait for initialization delay
      await Future.delayed(const Duration(milliseconds: 200));

      expect(controller.state, PlaybackState.playing);
      controller.dispose();
    });

    test('pause transitions state to paused and play resumes playing', () async {
      final controller = VideoPlaybackController(
        videoUrl: 'https://cdn.interest.app/reels/test/master.m3u8',
        autoPlay: true,
      );
      await Future.delayed(const Duration(milliseconds: 200));

      controller.pause();
      expect(controller.state, PlaybackState.paused);

      controller.play();
      expect(controller.state, PlaybackState.playing);

      controller.dispose();
    });

    test('didChangeAppLifecycleState pauses video when app goes to background', () async {
      final controller = VideoPlaybackController(
        videoUrl: 'https://cdn.interest.app/reels/test/master.m3u8',
        autoPlay: true,
      );
      await Future.delayed(const Duration(milliseconds: 200));
      expect(controller.state, PlaybackState.playing);

      // Simulate app backgrounded
      controller.didChangeAppLifecycleState(AppLifecycleState.paused);
      expect(controller.state, PlaybackState.paused);

      // Simulate app foregrounded
      controller.didChangeAppLifecycleState(AppLifecycleState.resumed);
      expect(controller.state, PlaybackState.playing);

      controller.dispose();
    });

    test('onScrolledOffScreen pauses video to conserve mobile CPU & memory', () async {
      final controller = VideoPlaybackController(
        videoUrl: 'https://cdn.interest.app/reels/test/master.m3u8',
        autoPlay: true,
      );
      await Future.delayed(const Duration(milliseconds: 200));
      expect(controller.state, PlaybackState.playing);

      // Card scrolled off screen
      controller.onScrolledOffScreen();
      expect(controller.state, PlaybackState.paused);

      // Card scrolled back into view
      controller.onScrolledOnScreen();
      expect(controller.state, PlaybackState.playing);

      controller.dispose();
    });

    test('toggleMute alternates mute state', () {
      final controller = VideoPlaybackController(
        videoUrl: 'https://cdn.interest.app/reels/test/master.m3u8',
      );

      expect(controller.isMuted, isFalse);
      controller.toggleMute();
      expect(controller.isMuted, isTrue);
      controller.toggleMute();
      expect(controller.isMuted, isFalse);

      controller.dispose();
    });
  });
}
