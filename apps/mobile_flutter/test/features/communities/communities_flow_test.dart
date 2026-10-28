import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/communities/data/communities_api_client.dart';
import 'package:mobile/features/communities/data/communities_repository.dart';
import 'package:mobile/features/communities/domain/models/community_models.dart';
import 'package:mobile/features/communities/presentation/communities_notifier.dart';
import 'package:mobile/features/communities/presentation/community_detail_notifier.dart';

class MockCommunitiesApiClient extends CommunitiesApiClient {
  int listCalls = 0;
  int getCalls = 0;
  int joinCalls = 0;
  int leaveCalls = 0;
  int createPostCalls = 0;
  int togglePinCalls = 0;
  int reportCalls = 0;
  int resolveReportCalls = 0;

  bool shouldSimulateOffline = false;

  final List<CommunityModel> mockCommunities = [
    CommunityModel(
      id: 'comm-1',
      creatorId: 'user-owner',
      name: 'Flutter Architects',
      slug: 'flutter-architects',
      description: 'Advanced Flutter patterns and architecture.',
      visibility: CommunityVisibility.public,
      guidelines: const [
        CommunityGuidelineModel(id: 'g-1', title: 'Be Respectful', description: 'No flame wars.'),
      ],
      membersCount: 42,
      postsCount: 15,
      isActive: true,
      userRole: CommunityMemberRole.moderator,
      userStatus: CommunityMemberStatus.active,
      createdAt: DateTime.now().subtract(const Duration(days: 10)),
      updatedAt: DateTime.now().subtract(const Duration(days: 1)),
    ),
    CommunityModel(
      id: 'comm-2',
      creatorId: 'user-owner-2',
      name: 'Stealth Startup AI',
      slug: 'stealth-startup-ai',
      description: 'Private discussions for AI founders.',
      visibility: CommunityVisibility.private,
      guidelines: const [],
      membersCount: 8,
      postsCount: 5,
      isActive: true,
      userRole: null,
      userStatus: null,
      createdAt: DateTime.now().subtract(const Duration(days: 30)),
      updatedAt: DateTime.now().subtract(const Duration(days: 2)),
    ),
  ];

  final List<CommunityPostModel> mockPosts = [
    CommunityPostModel(
      id: 'post-1',
      communityId: 'comm-1',
      authorId: 'user-alice',
      author: const CommunityMemberUserInfoModel(
        id: 'user-alice',
        username: 'alice_flutter',
        displayName: 'Alice In Tech',
        isVerified: true,
      ),
      postType: CommunityPostType.discussion,
      title: 'State management best practices',
      body: 'Riverpod vs BLoC in enterprise apps',
      mediaUrls: const [],
      isPinned: true,
      pinnedAt: DateTime.now(),
      isAnnouncement: false,
      collaborationStatus: 'NONE',
      collaborators: const [],
      likesCount: 25,
      commentsCount: 12,
      createdAt: DateTime.now().subtract(const Duration(hours: 3)),
      updatedAt: DateTime.now().subtract(const Duration(hours: 3)),
    ),
    CommunityPostModel(
      id: 'post-2',
      communityId: 'comm-1',
      authorId: 'user-bob',
      author: const CommunityMemberUserInfoModel(
        id: 'user-bob',
        username: 'bob_dev',
        displayName: 'Bob The Builder',
        isVerified: false,
      ),
      postType: CommunityPostType.collaborative,
      title: 'Open Source UI Toolkit Collaboration',
      body: 'Building accessible widgets together',
      mediaUrls: const [],
      isPinned: false,
      isAnnouncement: false,
      collaborationStatus: 'ACCEPTED',
      collaborators: const [
        CommunityCollaboratorModel(
          userId: 'user-alice',
          username: 'alice_flutter',
          displayName: 'Alice In Tech',
          status: 'ACCEPTED',
        ),
      ],
      likesCount: 18,
      commentsCount: 6,
      createdAt: DateTime.now().subtract(const Duration(hours: 1)),
      updatedAt: DateTime.now().subtract(const Duration(hours: 1)),
    ),
  ];

  @override
  Future<List<CommunityModel>> listCommunities({
    String? interestId,
    bool? joinedOnly,
    String? search,
    String? token,
  }) async {
    listCalls++;
    if (shouldSimulateOffline) throw const NetworkFailure();

    var result = List<CommunityModel>.from(mockCommunities);
    if (joinedOnly == true) {
      result = result.where((c) => c.isJoined).toList();
    }
    if (search != null && search.isNotEmpty) {
      result = result.where((c) => c.name.toLowerCase().contains(search.toLowerCase())).toList();
    }
    return result;
  }

  @override
  Future<CommunityModel> getCommunity(String identifier, {String? token}) async {
    getCalls++;
    if (shouldSimulateOffline) throw const NetworkFailure();

    final found = mockCommunities.firstWhere(
      (c) => c.id == identifier || c.slug == identifier,
      orElse: () => throw const NotFoundFailure(message: 'Community not found'),
    );
    return found;
  }

  @override
  Future<void> joinCommunity(String communityId, {String? token}) async {
    joinCalls++;
  }

  @override
  Future<void> leaveCommunity(String communityId, {String? token}) async {
    leaveCalls++;
  }

  @override
  Future<CommunityPostModel> createPost(String communityId, Map<String, dynamic> body, {String? token}) async {
    createPostCalls++;
    return CommunityPostModel(
      id: 'post-new-created',
      communityId: communityId,
      authorId: 'user-me',
      author: const CommunityMemberUserInfoModel(
        id: 'user-me',
        username: 'me',
        displayName: 'Myself',
      ),
      postType: CommunityPostTypeExt.fromString(body['postType'] as String?),
      title: body['title'] as String,
      body: body['body'] as String,
      mediaUrls: const [],
      isPinned: body['isPinned'] == true,
      isAnnouncement: false,
      collaborationStatus: 'NONE',
      collaborators: const [],
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );
  }

  @override
  Future<List<CommunityPostModel>> listPosts(
    String communityId, {
    String? postType,
    bool? pinnedOnly,
    String? token,
  }) async {
    if (shouldSimulateOffline) throw const NetworkFailure();
    var list = List<CommunityPostModel>.from(mockPosts);
    if (pinnedOnly == true) {
      list = list.where((p) => p.isPinned).toList();
    }
    return list;
  }

  @override
  Future<void> togglePinPost(String communityId, String postId, {String? token}) async {
    togglePinCalls++;
  }

  @override
  Future<void> reportTarget(String communityId, Map<String, dynamic> body, {String? token}) async {
    reportCalls++;
  }

  @override
  Future<List<CommunityReportModel>> getModerationQueue(String communityId, {String? token}) async {
    return [
      CommunityReportModel(
        id: 'rep-1',
        communityId: communityId,
        reporterId: 'user-reporter',
        targetType: 'POST',
        targetId: 'post-1',
        reason: 'SPAM',
        details: 'Offensive thread',
        status: 'PENDING',
        createdAt: DateTime.now(),
      ),
    ];
  }

  @override
  Future<void> reviewReport(String communityId, String reportId, Map<String, dynamic> body, {String? token}) async {
    resolveReportCalls++;
  }
}

void main() {
  late MockCommunitiesApiClient mockApiClient;
  late CommunitiesRepository repository;

  setUp(() {
    mockApiClient = MockCommunitiesApiClient();
    repository = CommunitiesRepository(apiClient: mockApiClient);
  });

  group('1. Domain Models & Serialization', () {
    test('CommunityModel correctly parses JSON and computes role/joined properties', () {
      final json = mockApiClient.mockCommunities[0].toJson();
      final comm = CommunityModel.fromJson(json);

      expect(comm.id, 'comm-1');
      expect(comm.name, 'Flutter Architects');
      expect(comm.visibility, CommunityVisibility.public);
      expect(comm.isJoined, true);
      expect(comm.isStaff, true);
      expect(comm.guidelines.length, 1);
      expect(comm.guidelines[0].title, 'Be Respectful');
    });

    test('CommunityPostModel serializes collaborative and pinned attributes accurately', () {
      final json = mockApiClient.mockPosts[1].toJson();
      final post = CommunityPostModel.fromJson(json);

      expect(post.id, 'post-2');
      expect(post.postType, CommunityPostType.collaborative);
      expect(post.collaborationStatus, 'ACCEPTED');
      expect(post.collaborators.length, 1);
      expect(post.collaborators[0].displayName, 'Alice In Tech');
    });
  });

  group('2. CommunitiesRepository Operations & Caching', () {
    test('listCommunities populates cache and supports offline fallback', () async {
      final list = await repository.listCommunities();
      expect(mockApiClient.listCalls, 1);
      expect(list.length, 2);
      expect(repository.cachedCommunities.length, 2);

      // Offline mode
      mockApiClient.shouldSimulateOffline = true;
      final offlineList = await repository.listCommunities(joinedOnly: true);
      expect(offlineList.length, 1);
      expect(offlineList[0].id, 'comm-1');
    });

    test('optimistically updates community membership on join and leave', () async {
      await repository.getCommunity('comm-2');
      expect(repository.cachedCommunities['comm-2']?.userStatus, null);

      await repository.joinCommunity('comm-2');
      expect(mockApiClient.joinCalls, 1);
      expect(repository.cachedCommunities['comm-2']?.userStatus, CommunityMemberStatus.pendingRequest);

      // Now join comm-1 (public) and leave
      await repository.getCommunity('comm-1');
      await repository.leaveCommunity('comm-1');
      expect(mockApiClient.leaveCalls, 1);
      expect(repository.cachedCommunities['comm-1']?.userStatus, null);
    });
  });

  group('3. CommunitiesNotifier & Search Query Filtering', () {
    test('filters list by search query and joined status', () async {
      final notifier = CommunitiesNotifier(repository: repository);
      await notifier.loadCommunities();

      expect(notifier.state.communities.length, 2);

      notifier.setSearchQuery('Flutter');
      await Future.delayed(Duration.zero);
      expect(notifier.state.communities.length, 1);
      expect(notifier.state.communities[0].name, 'Flutter Architects');

      notifier.setSearchQuery('');
      notifier.setJoinedOnly(true);
      await Future.delayed(Duration.zero);
      expect(notifier.state.communities.length, 1);
      expect(notifier.state.communities[0].isJoined, true);

      notifier.dispose();
    });
  });

  group('4. CommunityDetailNotifier Interactions & Moderation', () {
    test('loads community data and creates new discussion post', () async {
      final notifier = CommunityDetailNotifier(
        repository: repository,
        identifier: 'comm-1',
      );

      await notifier.loadCommunityData();
      expect(notifier.state.community?.name, 'Flutter Architects');
      expect(notifier.state.posts.length, 2);

      // Create new post
      await notifier.createPost(
        title: 'New RFC on Navigation 3.0',
        body: 'Here are the design details',
      );

      expect(mockApiClient.createPostCalls, 1);
      expect(notifier.state.posts.length, 3);
      expect(notifier.state.posts[0].title, 'New RFC on Navigation 3.0');

      notifier.dispose();
    });

    test('toggles pin status on posts', () async {
      final notifier = CommunityDetailNotifier(
        repository: repository,
        identifier: 'comm-1',
      );
      await notifier.loadCommunityData();

      expect(notifier.state.posts[0].isPinned, true);
      await notifier.togglePinPost('post-1');

      expect(mockApiClient.togglePinCalls, 1);
      expect(notifier.state.posts[0].isPinned, false);

      notifier.dispose();
    });

    test('submits target report and reviews moderation queue', () async {
      final notifier = CommunityDetailNotifier(
        repository: repository,
        identifier: 'comm-1',
      );
      await notifier.loadCommunityData();

      await notifier.reportTarget('POST', 'post-1', 'HATE_SPEECH', 'Inappropriate discussion');
      expect(mockApiClient.reportCalls, 1);

      // Staff reviews mod queue
      notifier.setTabIndex(3); // Mod Queue tab

      await notifier.loadModQueue();
      expect(notifier.state.modQueue.length, 1);
      expect(notifier.state.modQueue[0].reason, 'SPAM');

      await notifier.resolveReport('rep-1', 'RESOLVED', 'REMOVE_POST');
      expect(mockApiClient.resolveReportCalls, 1);

      notifier.dispose();
    });
  });
}
