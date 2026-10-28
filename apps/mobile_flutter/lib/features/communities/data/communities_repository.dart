import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/communities/data/communities_api_client.dart';
import 'package:mobile/features/communities/domain/models/community_models.dart';

class CommunitiesRepository {
  final CommunitiesApiClient _apiClient;

  // In-memory cache
  final Map<String, CommunityModel> _cachedCommunities = {};
  final Map<String, List<CommunityPostModel>> _cachedPosts = {};

  CommunitiesRepository({
    CommunitiesApiClient? apiClient,
  }) : _apiClient = apiClient ?? CommunitiesApiClient();

  Map<String, CommunityModel> get cachedCommunities => Map.unmodifiable(_cachedCommunities);

  Future<List<CommunityModel>> listCommunities({
    String? interestId,
    bool? joinedOnly,
    String? search,
    String? token,
  }) async {
    try {
      final list = await _apiClient.listCommunities(
        interestId: interestId,
        joinedOnly: joinedOnly,
        search: search,
        token: token,
      );
      for (final comm in list) {
        _cachedCommunities[comm.id] = comm;
      }
      return list;
    } on NetworkFailure {
      var cached = _cachedCommunities.values.toList();
      if (joinedOnly == true) {
        cached = cached.where((c) => c.isJoined).toList();
      }
      if (search != null && search.isNotEmpty) {
        final query = search.toLowerCase();
        cached = cached.where((c) => c.name.toLowerCase().contains(query)).toList();
      }
      return cached;
    }
  }

  Future<CommunityModel> getCommunity(String identifier, {String? token}) async {
    try {
      final comm = await _apiClient.getCommunity(identifier, token: token);
      _cachedCommunities[comm.id] = comm;
      return comm;
    } on NetworkFailure {
      final cached = _cachedCommunities.values.firstWhere(
        (c) => c.id == identifier || c.slug == identifier,
        orElse: () => throw const NotFoundFailure(message: 'Community not found in offline cache'),
      );
      return cached;
    }
  }

  Future<CommunityModel> createCommunity(Map<String, dynamic> body, {String? token}) async {
    final comm = await _apiClient.createCommunity(body, token: token);
    _cachedCommunities[comm.id] = comm;
    return comm;
  }

  Future<void> joinCommunity(String communityId, {String? token}) async {
    await _apiClient.joinCommunity(communityId, token: token);
    final cached = _cachedCommunities[communityId];
    if (cached != null) {
      final newStatus = cached.visibility == CommunityVisibility.public
          ? CommunityMemberStatus.active
          : CommunityMemberStatus.pendingRequest;
      _cachedCommunities[communityId] = cached.copyWith(
        userStatus: newStatus,
        membersCount: newStatus == CommunityMemberStatus.active ? cached.membersCount + 1 : cached.membersCount,
      );
    }
  }

  Future<void> leaveCommunity(String communityId, {String? token}) async {
    await _apiClient.leaveCommunity(communityId, token: token);
    final cached = _cachedCommunities[communityId];
    if (cached != null) {
      _cachedCommunities[communityId] = cached.copyWith(
        clearUserStatus: true,
        clearUserRole: true,
        membersCount: cached.membersCount > 1 ? cached.membersCount - 1 : 1,
      );
    }
  }

  Future<void> inviteUser(String communityId, String targetUserId, {String? token}) async {
    await _apiClient.inviteUser(communityId, targetUserId, token: token);
  }

  Future<CommunityPostModel> createPost(String communityId, Map<String, dynamic> body, {String? token}) async {
    final post = await _apiClient.createPost(communityId, body, token: token);
    final currentList = _cachedPosts[communityId] ?? [];
    _cachedPosts[communityId] = [post, ...currentList];

    final cachedComm = _cachedCommunities[communityId];
    if (cachedComm != null) {
      _cachedCommunities[communityId] = cachedComm.copyWith(postsCount: cachedComm.postsCount + 1);
    }

    return post;
  }

  Future<List<CommunityPostModel>> listPosts(
    String communityId, {
    String? postType,
    bool? pinnedOnly,
    String? token,
  }) async {
    try {
      final posts = await _apiClient.listPosts(
        communityId,
        postType: postType,
        pinnedOnly: pinnedOnly,
        token: token,
      );
      _cachedPosts[communityId] = posts;
      return posts;
    } on NetworkFailure {
      final cached = _cachedPosts[communityId] ?? [];
      if (pinnedOnly == true) {
        return cached.where((p) => p.isPinned).toList();
      }
      return cached;
    }
  }

  Future<void> togglePinPost(String communityId, String postId, {String? token}) async {
    await _apiClient.togglePinPost(communityId, postId, token: token);
    final currentList = _cachedPosts[communityId];
    if (currentList != null) {
      final idx = currentList.indexWhere((p) => p.id == postId);
      if (idx >= 0) {
        final post = currentList[idx];
        final updatedPost = post.copyWith(isPinned: !post.isPinned);
        final updatedList = List<CommunityPostModel>.from(currentList);
        updatedList[idx] = updatedPost;
        _cachedPosts[communityId] = updatedList;
      }
    }
  }

  Future<void> respondToCollaboration(String postId, String status, {String? token}) async {
    await _apiClient.respondToCollaboration(postId, status, token: token);
  }

  Future<List<CommunityCollectionModel>> listCollections(String communityId, {String? token}) async {
    return _apiClient.listCollections(communityId, token: token);
  }

  Future<void> reportTarget(String communityId, Map<String, dynamic> body, {String? token}) async {
    await _apiClient.reportTarget(communityId, body, token: token);
  }

  Future<List<CommunityReportModel>> getModerationQueue(String communityId, {String? token}) async {
    return _apiClient.getModerationQueue(communityId, token: token);
  }

  Future<void> reviewReport(String communityId, String reportId, Map<String, dynamic> body, {String? token}) async {
    await _apiClient.reviewReport(communityId, reportId, body, token: token);
  }

  Future<void> submitAppeal(String communityId, String appealReason, {String? token}) async {
    await _apiClient.submitAppeal(communityId, appealReason, token: token);
  }

  Future<void> updateMemberRole(String communityId, String targetUserId, String role, {String? token}) async {
    await _apiClient.updateMemberRole(communityId, targetUserId, role, token: token);
  }

  Future<void> moderateMember(String communityId, String targetUserId, Map<String, dynamic> body, {String? token}) async {
    await _apiClient.moderateMember(communityId, targetUserId, body, token: token);
  }

  Future<void> handoverOwnership(String communityId, String newOwnerId, {String? token}) async {
    await _apiClient.handoverOwnership(communityId, newOwnerId, token: token);
    final cached = _cachedCommunities[communityId];
    if (cached != null) {
      _cachedCommunities[communityId] = cached.copyWith(
        userRole: CommunityMemberRole.admin,
      );
    }
  }
}
