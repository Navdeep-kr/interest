import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/features/search/data/search_api_client.dart';
import 'package:mobile/features/search/data/search_repository.dart';
import 'package:mobile/features/search/domain/models/search_models.dart';
import 'package:mobile/features/search/presentation/search_notifier.dart';
import 'package:mobile/features/search/presentation/search_state.dart';

class MockSearchApiClient extends SearchApiClient {
  @override
  Future<UnifiedSearchResultsModel> search({
    required String query,
    String type = 'all',
    int limit = 20,
    int offset = 0,
    String? token,
  }) async {
    if (query.contains('prohibited')) {
      return const UnifiedSearchResultsModel(
        query: 'prohibited',
        totalCount: 0,
        isProhibited: true,
        moderationMessage: 'Prohibited query under community guidelines.',
        emptySuggestions: {
          'trendingTopics': ['Calisthenics', 'Distributed Systems'],
          'popularHashtags': ['#ai', '#rust'],
        },
      );
    }

    return UnifiedSearchResultsModel(
      query: query,
      totalCount: 3,
      interests: const [
        InterestSearchResultModel(
          id: 'int-paxos',
          slug: 'paxos-consensus',
          title: 'Paxos Consensus',
          description: 'Distributed consensus algorithm',
          level: 2,
          categoryTitle: 'Distributed Systems',
          reelsCount: 45,
          viewerAffinityWeight: 0.95,
        ),
      ],
      users: const [
        UserSearchResultModel(
          id: 'u-1',
          username: 'lamport_fan',
          displayName: 'Leslie Fan',
          followersCount: 1200,
          reelsCount: 15,
          isVerified: true,
          sharedInterestsCount: 4,
        ),
      ],
      communities: const [
        CommunitySearchResultModel(
          id: 'comm-1',
          name: 'Distributed Systems Club',
          interestTitle: 'Distributed Systems',
          membersCount: 850,
          priceCents: 0,
          currency: 'USD',
          pricingType: 'free',
        ),
      ],
    );
  }

  @override
  Future<List<SafeAutocompleteSuggestionModel>> getSafeAutocomplete(
    String query, {
    int limit = 10,
    String? token,
  }) async {
    return const [
      SafeAutocompleteSuggestionModel(text: 'Paxos Consensus', type: 'topic'),
      SafeAutocompleteSuggestionModel(text: '@lamport_fan', type: 'creator'),
      SafeAutocompleteSuggestionModel(text: '#consensus', type: 'hashtag'),
    ];
  }

  @override
  Future<TransparentTrendingModel> getTransparentTrending({
    String window = '24h',
    int limit = 10,
    String? token,
  }) async {
    return TransparentTrendingModel(
      window: window,
      calculatedAt: '2026-10-16T12:00:00Z',
      topics: const [
        TrendingTopicItemModel(
          id: 't-1',
          slug: 'zkp',
          title: 'Zero Knowledge Proofs',
          categoryTitle: 'Cryptography',
          velocityScore: 120.5,
          postCount: 88,
          rank: 1,
        ),
      ],
      hashtags: const [
        TrendingHashtagItemModel(tag: '#zkp', postCount: 150, rank: 1),
      ],
    );
  }

  @override
  Future<List<RecentSearchItemModel>> getRecentSearches({
    int limit = 10,
    String? token,
  }) async {
    return const [
      RecentSearchItemModel(
        id: 'rec-1',
        queryText: 'distributed consensus',
        searchType: 'all',
        createdAt: '2026-10-16T11:00:00Z',
      ),
    ];
  }

  @override
  Future<void> recordRecentSearch({
    required String queryText,
    String searchType = 'all',
    String? token,
  }) async {}

  @override
  Future<void> deleteRecentSearch({
    required String searchId,
    String? token,
  }) async {}

  @override
  Future<void> clearRecentSearches({String? token}) async {}

  @override
  Future<TopicPageDetailsModel> getTopicPage({
    required String idOrSlug,
    String? token,
  }) async {
    return const TopicPageDetailsModel(
      id: 'int-paxos',
      slug: 'paxos-consensus',
      title: 'Paxos Consensus',
      description: 'Distributed consensus algorithm',
      level: 2,
      parentTitle: 'Distributed Systems',
      breadcrumbs: [
        BreadcrumbItemModel(id: 'root-cs', slug: 'cs', title: 'Computer Science', level: 0),
        BreadcrumbItemModel(id: 'cat-ds', slug: 'dist-sys', title: 'Distributed Systems', level: 1),
        BreadcrumbItemModel(id: 'int-paxos', slug: 'paxos-consensus', title: 'Paxos Consensus', level: 2),
      ],
      subtopics: [
        SubtopicItemModel(id: 'sub-mp', slug: 'multi-paxos', title: 'Multi-Paxos', reelsCount: 12),
      ],
      relatedInterests: [
        RelatedInterestItemModel(id: 'rel-raft', slug: 'raft', title: 'Raft Protocol', similarityScore: 0.94),
      ],
      reelsCount: 45,
      followersCount: 320,
      isFollowing: false,
      isMuted: false,
    );
  }

  @override
  Future<void> followTopic({required String id, String? token}) async {}

  @override
  Future<void> unfollowTopic({required String id, String? token}) async {}

  @override
  Future<bool> toggleMuteTopic({required String id, required bool isMuted, String? token}) async {
    return isMuted;
  }
}

void main() {
  group('Prompt 11 Flutter — Interest Graph & Search Flow Tests', () {
    late MockSearchApiClient apiClient;
    late PlatformSecureStorageService secureStorage;
    late SearchRepository repository;
    late SearchNotifier notifier;

    setUp(() {
      apiClient = MockSearchApiClient();
      secureStorage = PlatformSecureStorageService();
      repository = SearchRepository(apiClient: apiClient, secureStorage: secureStorage);
      notifier = SearchNotifier(repository: repository);
    });

    tearDown(() {
      notifier.dispose();
    });

    test('Loads initial state with recent searches and transparent trending metrics', () async {
      await notifier.loadInitialData();

      expect(notifier.state, isA<SearchInitialState>());
      final state = notifier.state as SearchInitialState;
      expect(state.recentSearches.length, 1);
      expect(state.recentSearches.first.queryText, 'distributed consensus');
      expect(state.trending?.topics.length, 1);
      expect(state.trending?.topics.first.title, 'Zero Knowledge Proofs');
      expect(state.trending?.topics.first.velocityScore, 120.5);
    });

    test('Switches transparent trending velocity window (24h to 72h)', () async {
      await notifier.loadInitialData();
      await notifier.switchTrendingWindow('72h');

      expect(notifier.activeTrendingWindow, '72h');
      final state = notifier.state as SearchInitialState;
      expect(state.trending?.window, '72h');
    });

    test('Executes multi-domain search returning topics, creators, and communities', () async {
      await notifier.executeSearch('consensus', type: 'all');

      expect(notifier.state, isA<SearchLoadedState>());
      final loaded = notifier.state as SearchLoadedState;
      expect(loaded.query, 'consensus');
      expect(loaded.results.totalCount, 3);
      expect(loaded.results.interests.length, 1);
      expect(loaded.results.interests.first.title, 'Paxos Consensus');
      expect(loaded.results.users.length, 1);
      expect(loaded.results.users.first.username, 'lamport_fan');
      expect(loaded.results.communities.length, 1);
      expect(loaded.results.communities.first.name, 'Distributed Systems Club');
    });

    test('Intercepts prohibited query and yields community safety moderation banner', () async {
      await notifier.executeSearch('prohibited term', type: 'all');

      expect(notifier.state, isA<SearchLoadedState>());
      final loaded = notifier.state as SearchLoadedState;
      expect(loaded.results.isProhibited, true);
      expect(loaded.results.moderationMessage, contains('community guidelines'));
      expect(loaded.results.emptySuggestions?['trendingTopics']?.length, 2);
    });

    test('Loads topic page details with breadcrumbs, subtopics, related topics and follow/mute toggles', () async {
      final details = await repository.getTopicPage('paxos-consensus');

      expect(details.title, 'Paxos Consensus');
      expect(details.breadcrumbs.length, 3);
      expect(details.breadcrumbs[0].title, 'Computer Science');
      expect(details.breadcrumbs[1].title, 'Distributed Systems');
      expect(details.breadcrumbs[2].title, 'Paxos Consensus');
      expect(details.subtopics.length, 1);
      expect(details.subtopics.first.title, 'Multi-Paxos');
      expect(details.relatedInterests.length, 1);
      expect(details.relatedInterests.first.title, 'Raft Protocol');
      expect(details.followersCount, 320);

      // Verify copyWith follow state toggle
      final updated = details.copyWith(
        isFollowing: true,
        followersCount: details.followersCount + 1,
      );
      expect(updated.isFollowing, true);
      expect(updated.followersCount, 321);

      // Verify copyWith mute state toggle
      final muted = updated.copyWith(isMuted: true);
      expect(muted.isMuted, true);
    });
  });
}
