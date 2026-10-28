import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/features/creator/data/creator_api_client.dart';
import 'package:mobile/features/creator/data/creator_repository.dart';
import 'package:mobile/features/creator/domain/models/creator_models.dart';
import 'package:mobile/features/creator/presentation/creator_studio_notifier.dart';
import 'package:mobile/features/creator/presentation/screens/creator_drafts_screen.dart';
import 'package:mobile/features/creator/presentation/screens/creator_studio_screen.dart';

class WidgetTestMockCreatorApiClient extends CreatorApiClient {
  int saveDraftCalls = 0;
  int publishCalls = 0;
  bool returnEmptyDrafts = false;

  final List<LicensedSoundModel> sounds = const [
    LicensedSoundModel(
      id: 'sound-lofi-1',
      title: 'Midnight Lo-Fi Chill',
      artist: 'BeatCraft',
      durationSeconds: 60.0,
      audioUrl: 'https://cdn.interest.app/audio/lofi.mp3',
      genre: 'Lo-Fi',
      isLicensed: true,
      licenseType: 'CREATIVE_COMMONS',
      reelsCount: 1420,
    ),
  ];

  final List<CreatorDraftModel> drafts = [
    const CreatorDraftModel(
      id: 'draft-widget-1',
      userId: 'user-1',
      title: 'Tokyo Street Food',
      caption: 'Delicious skewers in Shinjuku',
      aspectRatio: AspectRatioPreset.vertical916,
      trimStartMs: 500,
      trimEndMs: 12000,
      coverFrameTimestampMs: 2000,
      createdAt: '2026-10-16T10:00:00Z',
      updatedAt: '2026-10-16T10:00:00Z',
    ),
  ];

  @override
  Future<List<LicensedSoundModel>> getLicensedSounds({
    String? query,
    int limit = 20,
    int offset = 0,
    String? token,
  }) async {
    return sounds;
  }

  @override
  Future<CreatorDraftModel> saveDraft({
    required CreatorDraftModel draft,
    String? token,
  }) async {
    saveDraftCalls++;
    return draft;
  }

  @override
  Future<List<CreatorDraftModel>> getDrafts({String? token}) async {
    if (returnEmptyDrafts) return [];
    return drafts;
  }

  @override
  Future<void> deleteDraft({
    required String draftId,
    String? token,
  }) async {
    drafts.removeWhere((d) => d.id == draftId);
  }

  @override
  Future<PublishingSessionModel> publishOrSchedule({
    required Map<String, dynamic> payload,
    String? token,
  }) async {
    publishCalls++;
    return PublishingSessionModel(
      sessionId: 'sess-1',
      reelId: 'reel-1',
      clientPublicationId: payload['clientPublicationId'] as String? ?? 'client-pub-1',
      status: 'PUBLISHED',
      stage: 'READY',
      progressPercent: 100.0,
      publishedAt: '2026-10-16T12:00:00Z',
      updatedAt: '2026-10-16T12:00:00Z',
    );
  }
}

void main() {
  late WidgetTestMockCreatorApiClient mockApiClient;
  late PlatformSecureStorageService secureStorage;
  late CreatorRepository repository;
  late CreatorStudioNotifier notifier;

  setUp(() async {
    mockApiClient = WidgetTestMockCreatorApiClient();
    secureStorage = PlatformSecureStorageService();
    await secureStorage.saveAccessToken('test_token');
    repository = CreatorRepository(apiClient: mockApiClient, secureStorage: secureStorage);
    notifier = CreatorStudioNotifier(repository: repository);
  });

  Widget createTestWidget(Widget child) {
    return MaterialApp(
      home: child,
    );
  }

  group('CreatorStudioScreen Widget Tests', () {
    testWidgets('renders studio screen, toolbar tabs, and AppBar actions', (tester) async {
      await tester.pumpWidget(createTestWidget(CreatorStudioScreen(notifier: notifier)));
      await tester.pumpAndSettle();

      expect(find.text('Creator Studio'), findsOneWidget);
      expect(find.text('Save Draft'), findsOneWidget);
      expect(find.text('Publish'), findsOneWidget);

      // Verify Toolbar tabs
      expect(find.text('Preview'), findsOneWidget);
      expect(find.text('Trim'), findsOneWidget);
      expect(find.text('Crop'), findsOneWidget);
      expect(find.text('Text'), findsOneWidget);
      expect(find.text('Subtitles'), findsOneWidget);
      expect(find.text('Sounds'), findsOneWidget);
      expect(find.text('Audio'), findsOneWidget);
      expect(find.text('Settings'), findsOneWidget);
    });

    testWidgets('switches toolbar tabs to Trim and Crop and changes aspect ratio', (tester) async {
      await tester.pumpWidget(createTestWidget(CreatorStudioScreen(notifier: notifier)));
      await tester.pumpAndSettle();

      // Tap on Crop tool
      await tester.tap(find.text('Crop'));
      await tester.pumpAndSettle();

      expect(find.text('9:16 (Reel)'), findsOneWidget);
      expect(find.text('1:1 (Square)'), findsOneWidget);

      // Tap 1:1 Square ChoiceChip
      await tester.tap(find.text('1:1 (Square)'));
      await tester.pumpAndSettle();

      expect(notifier.state.aspectRatio, AspectRatioPreset.square11);
    });

    testWidgets('adds text overlay and renders overlay on canvas', (tester) async {
      await tester.pumpWidget(createTestWidget(CreatorStudioScreen(notifier: notifier)));
      await tester.pumpAndSettle();

      // Tap on Text tool
      await tester.tap(find.text('Text'));
      await tester.pumpAndSettle();

      // Enter text
      final textInput = find.widgetWithText(TextField, 'Enter text overlay...');
      expect(textInput, findsOneWidget);
      await tester.enterText(textInput, 'Amazing Sunset');
      await tester.pumpAndSettle();

      // Tap Add Text button
      await tester.tap(find.text('Add Text'));
      await tester.pumpAndSettle();

      // Verify overlay added to state and canvas
      expect(find.text('Amazing Sunset'), findsWidgets);
      expect(notifier.state.textOverlays.length, 1);
    });

    testWidgets('tap on Save Draft button saves draft and displays confirmation', (tester) async {
      await tester.pumpWidget(createTestWidget(CreatorStudioScreen(notifier: notifier)));
      await tester.pumpAndSettle();

      final saveDraftBtn = find.text('Save Draft');
      expect(saveDraftBtn, findsOneWidget);
      await tester.tap(saveDraftBtn);
      await tester.pumpAndSettle();

      expect(find.text('Draft saved safely'), findsOneWidget);
      expect(mockApiClient.saveDraftCalls, 1);
    });
  });

  group('CreatorDraftsScreen Widget Tests', () {
    testWidgets('renders saved drafts list with item details', (tester) async {
      await tester.pumpWidget(createTestWidget(CreatorDraftsScreen(repository: repository)));
      await tester.pumpAndSettle();

      expect(find.text('Saved Drafts'), findsOneWidget);
      expect(find.text('Tokyo Street Food'), findsOneWidget);
      expect(find.textContaining('Ratio: 9:16'), findsOneWidget);
      expect(find.byIcon(Icons.edit), findsOneWidget);
      expect(find.byIcon(Icons.delete_outline), findsOneWidget);
    });

    testWidgets('displays empty state when there are no drafts', (tester) async {
      mockApiClient.returnEmptyDrafts = true;

      await tester.pumpWidget(createTestWidget(CreatorDraftsScreen(repository: repository)));
      await tester.pumpAndSettle();

      expect(find.text('No Saved Drafts'), findsOneWidget);
      expect(find.textContaining('Your unfinished reels and recipes will be preserved here safely.'), findsOneWidget);
      expect(find.text('Create New Reel'), findsOneWidget);
    });
  });
}
