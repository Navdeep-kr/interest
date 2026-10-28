import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/communities/data/communities_api_client.dart';
import 'package:mobile/features/communities/data/communities_repository.dart';
import 'package:mobile/features/communities/domain/models/community_models.dart';
import 'package:mobile/features/communities/presentation/screens/communities_list_screen.dart';
import 'package:mobile/features/communities/presentation/screens/community_detail_screen.dart';
import 'package:mobile/features/communities/presentation/widgets/community_post_card.dart';

class MockCommunitiesApiClientForWidget extends CommunitiesApiClient {
  final testCommunity = CommunityModel(
    id: 'comm-w-1',
    creatorId: 'user-creator',
    name: 'Cybersecurity Explorers',
    slug: 'cybersecurity-explorers',
    description: 'Ethical hacking and defensive architecture.',
    visibility: CommunityVisibility.public,
    guidelines: const [
      CommunityGuidelineModel(id: 'g-1', title: 'Responsible Disclosure', description: 'Never post unpatched zero-days.'),
    ],
    membersCount: 120,
    postsCount: 35,
    isActive: true,
    userRole: CommunityMemberRole.member,
    userStatus: CommunityMemberStatus.active,
    createdAt: DateTime.now(),
    updatedAt: DateTime.now(),
  );

  final testPost = CommunityPostModel(
    id: 'post-w-1',
    communityId: 'comm-w-1',
    authorId: 'user-alice',
    author: const CommunityMemberUserInfoModel(
      id: 'user-alice',
      username: 'alice_sec',
      displayName: 'Alice Security',
      isVerified: true,
    ),
    postType: CommunityPostType.collaborative,
    title: 'Audit Report: Quantum-Resistant Encryption',
    body: 'Reviewing lattice cryptography implementation across microservices.',
    mediaUrls: const [],
    isPinned: true,
    pinnedAt: DateTime.now(),
    isAnnouncement: false,
    collaborationStatus: 'ACCEPTED',
    collaborators: const [
      CommunityCollaboratorModel(
        userId: 'user-bob',
        username: 'bob_crypto',
        displayName: 'Bob Crypto',
        status: 'ACCEPTED',
      ),
    ],
    likesCount: 50,
    commentsCount: 15,
    createdAt: DateTime.now(),
    updatedAt: DateTime.now(),
  );

  @override
  Future<List<CommunityModel>> listCommunities({
    String? interestId,
    bool? joinedOnly,
    String? search,
    String? token,
  }) async {
    return [testCommunity];
  }

  @override
  Future<CommunityModel> getCommunity(String identifier, {String? token}) async {
    return testCommunity;
  }

  @override
  Future<List<CommunityPostModel>> listPosts(
    String communityId, {
    String? postType,
    bool? pinnedOnly,
    String? token,
  }) async {
    return [testPost];
  }

  @override
  Future<List<CommunityCollectionModel>> listCollections(String communityId, {String? token}) async {
    return [];
  }
}

void main() {
  late CommunitiesRepository repository;
  late MockCommunitiesApiClientForWidget mockClient;

  setUp(() {
    mockClient = MockCommunitiesApiClientForWidget();
    repository = CommunitiesRepository(apiClient: mockClient);
  });

  group('CommunityPostCard Widget Tests', () {
    testWidgets('renders author, title, pinned badge, and co-authors pill', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: CommunityPostCard(
              post: mockClient.testPost,
              isStaff: true,
            ),
          ),
        ),
      );

      // Verify Pinned Badge
      expect(find.text('PINNED POST'), findsOneWidget);

      // Verify Author Header
      expect(find.text('Alice Security'), findsOneWidget);
      expect(find.text('@alice_sec'), findsOneWidget);
      expect(find.byIcon(Icons.verified), findsOneWidget);

      // Verify Post Title & Body
      expect(find.text('Audit Report: Quantum-Resistant Encryption'), findsOneWidget);
      expect(find.text('Reviewing lattice cryptography implementation across microservices.'), findsOneWidget);

      // Verify Collab Badge & Co-authors pill
      expect(find.text('Collab'), findsOneWidget);
      expect(find.text('Co-authored with: Bob Crypto'), findsOneWidget);
    });
  });

  group('CommunityDetailScreen Widget Tests', () {
    testWidgets('renders community header, visibility badge, member count, and tabs', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: CommunityDetailScreen(
            identifier: 'comm-w-1',
            repository: repository,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify Community Name & Description
      expect(find.text('Cybersecurity Explorers'), findsAtLeastNWidgets(1));
      expect(find.text('Ethical hacking and defensive architecture.'), findsOneWidget);

      // Verify Visibility & Member Count
      expect(find.text('Public'), findsOneWidget);
      expect(find.text('120 members'), findsOneWidget);

      // Verify Tabs
      expect(find.text('Discussions'), findsOneWidget);
      expect(find.text('Collections'), findsOneWidget);
      expect(find.text('Guidelines'), findsOneWidget);

      // Verify Post in Discussions Tab
      expect(find.text('Audit Report: Quantum-Resistant Encryption'), findsOneWidget);
    });
  });

  group('CommunitiesListScreen Widget Tests', () {
    testWidgets('renders search bar, joined filter, and community list cards', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: CommunitiesListScreen(
            repository: repository,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Topic Communities'), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);
      expect(find.text('Joined'), findsOneWidget);

      // Verify Community Card
      expect(find.text('Cybersecurity Explorers'), findsOneWidget);
      expect(find.textContaining('120 members'), findsOneWidget);
    });
  });
}
