import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/reels/domain/models/reel_item_model.dart';
import 'package:mobile/features/reels/presentation/widgets/engagement_bar.dart';

void main() {
  const testReel = ReelItemModel(
    id: 'reel-test-1',
    creatorId: 'c-1',
    creator: ReelCreatorModel(id: 'c-1', username: 'dev', displayName: 'Developer'),
    title: 'Testing Engagement Bar',
    caption: 'Widget test suite',
    hlsMasterUrl: 'https://cdn.example.com/stream.m3u8',
    thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
    durationSeconds: 30.0,
    primaryInterestId: 'testing',
    interestTags: ['testing'],
    viewCount: 15400,
    likeCount: 1250, // Should format as 1.2K or 1250 depending on logic (>=1000 is 1.3K / 1.2K)
    commentCount: 42,
    saveCount: 300,
    shareCount: 15,
    isLiked: false,
    isSaved: false,
    isFollowing: false,
    isPinned: false,
    mediaType: ReelMediaType.video,
    imageUrls: [],
    visibility: ReelItemVisibility.public,
    hashtags: ['test'],
    createdAt: '2026-10-15T00:00:00Z',
  );

  testWidgets('EngagementBar renders action buttons and formatted counts', (tester) async {
    bool liked = false;
    bool commented = false;
    bool saved = false;
    bool shared = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: EngagementBar(
            reel: testReel,
            onLike: () => liked = true,
            onComment: () => commented = true,
            onSave: () => saved = true,
            onShare: () => shared = true,
          ),
        ),
      ),
    );

    // Verify Like button and count
    expect(find.byKey(const Key('engagement_like_button')), findsOneWidget);
    expect(find.text('1.3K'), findsOneWidget); // 1250 / 1000 = 1.3K (toStringAsFixed(1))

    // Verify Comment button and count
    expect(find.byKey(const Key('engagement_comment_button')), findsOneWidget);
    expect(find.text('42'), findsOneWidget);

    // Verify Save button and count
    expect(find.byKey(const Key('engagement_save_button')), findsOneWidget);
    expect(find.text('300'), findsOneWidget);

    // Verify Share button and count
    expect(find.byKey(const Key('engagement_share_button')), findsOneWidget);
    expect(find.text('15'), findsOneWidget);

    // Tap Like
    await tester.tap(find.byKey(const Key('engagement_like_button')));
    expect(liked, isTrue);

    // Tap Comment
    await tester.tap(find.byKey(const Key('engagement_comment_button')));
    expect(commented, isTrue);

    // Tap Save
    await tester.tap(find.byKey(const Key('engagement_save_button')));
    expect(saved, isTrue);

    // Tap Share
    await tester.tap(find.byKey(const Key('engagement_share_button')));
    expect(shared, isTrue);
  });
}
