import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/stories/data/stories_api_client.dart';
import 'package:mobile/features/stories/data/stories_repository.dart';
import 'package:mobile/features/stories/domain/models/story_models.dart';
import 'package:mobile/features/stories/presentation/screens/story_composer_screen.dart';
import 'package:mobile/features/stories/presentation/screens/story_player_screen.dart';
import 'package:mobile/features/stories/presentation/widgets/stories_tray_widget.dart';

class MockStoriesApiClientForWidget extends StoriesApiClient {
  @override
  Future<List<CreatorStoryTrayModel>> getStoriesTray({String? token}) async => [];

  @override
  Future<void> recordView(String storyId, RecordStoryViewRequest request, {String? token}) async {}

  @override
  Future<void> reactToStory(String storyId, String reaction, {String? token}) async {}

  @override
  Future<void> replyToStory(String storyId, String text, {String? token}) async {}

  @override
  Future<void> reportStory(String storyId, String reason, String? details, {String? token}) async {}

  @override
  Future<void> deleteStory(String storyId, {String? token}) async {}
}

void main() {
  late StoriesRepository repository;

  const testCreator = StoryCreatorModel(
    id: 'user_bob',
    username: 'bob_creator',
    displayName: 'Bob The Builder',
    isVerified: true,
  );

  final testStory = StoryModel(
    id: 'story_widget_1',
    creatorId: 'user_bob',
    creator: testCreator,
    mediaType: StoryMediaType.photo,
    mediaUrl: 'https://test.com/photo.jpg',
    durationSeconds: 5.0,
    caption: 'Check out this awesome view! #nature',
    textOverlays: const [
      StoryOverlayModel(
        id: 'overlay_1',
        text: 'Hello World',
        fontSize: 20,
        xPercent: 50,
        yPercent: 50,
      ),
    ],
    audience: StoryAudience.public,
    allowReplies: StoryReplySetting.all,
    createdAt: DateTime.now().subtract(const Duration(hours: 3)),
    expiresAt: DateTime.now().add(const Duration(hours: 21)),
    isExpired: false,
    isViewed: false,
    viewProgressPercent: 0.0,
    viewsCount: 42,
    reactionsCount: 12,
  );

  final testTray = [
    CreatorStoryTrayModel(
      creatorId: 'user_bob',
      username: 'bob_creator',
      displayName: 'Bob The Builder',
      isVerified: true,
      hasUnviewedStories: true,
      latestStoryAt: DateTime.now(),
      stories: [testStory],
    ),
  ];

  setUp(() {
    repository = StoriesRepository(apiClient: MockStoriesApiClientForWidget());
  });

  group('StoriesTrayWidget Tests', () {
    testWidgets('renders Your Story button and creator items with verified badge', (tester) async {
      bool addStoryTapped = false;
      CreatorStoryTrayModel? tappedCreator;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StoriesTrayWidget(
              tray: testTray,
              currentUserId: 'my_user_id',
              onAddStoryTap: () => addStoryTapped = true,
              onStoryTap: (creator) => tappedCreator = creator,
            ),
          ),
        ),
      );

      // Verify Your Story is present
      expect(find.text('Your Story'), findsOneWidget);
      expect(find.byIcon(Icons.add), findsOneWidget);

      // Verify Bob The Builder is present
      expect(find.text('Bob The Builder'), findsOneWidget);
      expect(find.byIcon(Icons.verified), findsOneWidget);

      // Tap Your Story
      await tester.tap(find.byKey(const Key('stories_tray_your_story')));
      expect(addStoryTapped, true);

      // Tap Bob's story
      await tester.tap(find.byKey(const Key('stories_tray_creator_user_bob')));
      expect(tappedCreator?.creatorId, 'user_bob');
    });
  });

  group('StoryPlayerScreen Tests', () {
    testWidgets('renders player header, caption, reaction emojis, and privacy warning modal', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: StoryPlayerScreen(
            stories: [testStory],
            currentUserId: 'other_viewer_id',
            repository: repository,
          ),
        ),
      );
      await tester.pump();

      // Verify Creator Name and Verification
      expect(find.text('Bob The Builder'), findsOneWidget);
      expect(find.byIcon(Icons.verified), findsOneWidget);

      // Verify Caption
      expect(find.text('Check out this awesome view! #nature'), findsOneWidget);

      // Verify Text Overlay
      expect(find.text('Hello World'), findsOneWidget);

      // Verify Reaction Emojis
      expect(find.text('❤️'), findsOneWidget);
      expect(find.text('🔥'), findsOneWidget);
      expect(find.text('😂'), findsOneWidget);

      // Verify Privacy / Screenshot Advisory Button
      final shieldIcon = find.byIcon(Icons.shield_outlined);
      expect(shieldIcon, findsOneWidget);

      // Tap privacy icon
      await tester.tap(shieldIcon);
      await tester.pumpAndSettle();

      // Check advisory text appears
      expect(find.text('Story Privacy'), findsOneWidget);
      expect(
        find.textContaining('Expiring content cannot prevent viewers from taking screenshots'),
        findsOneWidget,
      );

      // Close dialog
      await tester.tap(find.text('Understood'));
      await tester.pumpAndSettle();
      expect(find.text('Story Privacy'), findsNothing);
    });
  });

  group('StoryComposerScreen Tests', () {
    testWidgets('renders composer controls with media picker, audience options, and screenshot notice', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: StoryComposerScreen(
            repository: repository,
          ),
        ),
      );

      expect(find.text('New Story'), findsOneWidget);
      expect(find.text('Share'), findsOneWidget);
      expect(find.text('Photo'), findsOneWidget);
      expect(find.text('Video'), findsOneWidget);
      expect(find.text('Audience Selection'), findsOneWidget);
      expect(find.textContaining('Stories expire automatically in 24 hours'), findsOneWidget);
    });
  });
}
