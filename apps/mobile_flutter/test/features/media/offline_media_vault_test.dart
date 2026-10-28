import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/media/domain/models/offline_media_item.dart';
import 'package:mobile/features/media/domain/services/offline_download_manager.dart';
import 'package:mobile/features/media/presentation/controllers/floating_pip_controller.dart';
import 'package:mobile/features/reels/domain/models/reel_item_model.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Snaptube Media Downloader & Vault Tests', () {
    late OfflineDownloadManager manager;

    setUp(() {
      manager = OfflineDownloadManager();
    });

    test('Initial seeds are populated and categorised correctly', () {
      expect(manager.allDownloads.isNotEmpty, isTrue);
      expect(manager.videoDownloads.isNotEmpty, isTrue);
      expect(manager.audioDownloads.isNotEmpty, isTrue);
      expect(manager.vaultedItems.isNotEmpty, isTrue);
    });

    test('Starting a new download adds progress and completes successfully', () async {
      const testReel = ReelItemModel(
        id: 'reel_test_snaptube',
        creatorId: 'c1',
        creator: ReelCreatorModel(id: 'c1', username: 'tester', displayName: 'Tester'),
        title: '4K Architectural Beauty',
        hlsMasterUrl: 'https://cdn.example.com/video.mp4',
        thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
        durationSeconds: 20.0,
        primaryInterestId: 'architecture',
        interestTags: ['architecture'],
        viewCount: 100,
        likeCount: 10,
        commentCount: 2,
        saveCount: 5,
        shareCount: 1,
        isLiked: false,
        isSaved: false,
        isFollowing: false,
        isPinned: false,
        mediaType: ReelMediaType.video,
        imageUrls: [],
        visibility: ReelItemVisibility.public,
        hashtags: ['arch'],
        createdAt: '2026-10-21T00:00:00Z',
      );

      final initialCount = manager.allDownloads.length;
      await manager.startDownload(reel: testReel, format: OfflineMediaFormat.video1080p);

      expect(manager.allDownloads.length, equals(initialCount + 1));
      final downloaded = manager.allDownloads.first;
      expect(downloaded.format, equals(OfflineMediaFormat.video1080p));
      expect(downloaded.isCompleted, isTrue);
    });

    test('Vault PIN validation, lock and unlock mechanisms', () {
      manager.lockVault();
      expect(manager.isVaultUnlocked, isFalse);

      final wrongAttempt = manager.unlockVault('0000');
      expect(wrongAttempt, isFalse);
      expect(manager.isVaultUnlocked, isFalse);

      final correctAttempt = manager.unlockVault('1234');
      expect(correctAttempt, isTrue);
      expect(manager.isVaultUnlocked, isTrue);
    });

    test('Toggling item into and out of secret vault', () {
      final item = manager.allDownloads.first;
      expect(item.isVaulted, isFalse);

      manager.toggleVault(item.id);
      expect(manager.vaultedItems.any((i) => i.id == item.id), isTrue);

      manager.toggleVault(item.id);
      expect(manager.allDownloads.any((i) => i.id == item.id), isTrue);
    });
  });

  group('Floating PiP & Background Audio Controller Tests', () {
    late FloatingPiPController pipController;

    setUp(() {
      pipController = FloatingPiPController();
    });

    test('Starting PiP initializes player state and timer', () {
      const testReel = ReelItemModel(
        id: 'pip_reel_1',
        creatorId: 'c1',
        creator: ReelCreatorModel(id: 'c1', username: 'sound_designer', displayName: 'Sound Designer'),
        title: 'Deep House Study Mix',
        hlsMasterUrl: 'https://cdn.example.com/audio.mp3',
        thumbnailUrl: 'https://cdn.example.com/cover.jpg',
        durationSeconds: 120.0,
        primaryInterestId: 'music',
        interestTags: ['music'],
        viewCount: 50,
        likeCount: 5,
        commentCount: 0,
        saveCount: 2,
        shareCount: 0,
        isLiked: false,
        isSaved: false,
        isFollowing: false,
        isPinned: false,
        mediaType: ReelMediaType.video,
        imageUrls: [],
        visibility: ReelItemVisibility.public,
        hashtags: ['music'],
        createdAt: '2026-10-21T00:00:00Z',
      );

      pipController.startPiP(reel: testReel, audioOnly: true);

      expect(pipController.hasActivePlayer, isTrue);
      expect(pipController.isAudioOnly, isTrue);
      expect(pipController.isPlaying, isTrue);
      expect(pipController.playbackSpeed, equals(1.0));

      // Cycle playback speeds: 1.0 -> 1.25 -> 1.5 -> 2.0 -> 1.0
      pipController.cycleSpeed();
      expect(pipController.playbackSpeed, equals(1.25));

      pipController.cycleSpeed();
      expect(pipController.playbackSpeed, equals(1.5));

      // Toggle Play / Pause
      pipController.togglePlayPause();
      expect(pipController.isPlaying, isFalse);

      // Close PiP
      pipController.closePiP();
      expect(pipController.hasActivePlayer, isFalse);
    });
  });
}
