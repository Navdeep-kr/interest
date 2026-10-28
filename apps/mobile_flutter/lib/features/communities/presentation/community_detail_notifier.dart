import 'package:flutter/foundation.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/communities/data/communities_repository.dart';
import 'package:mobile/features/communities/domain/models/community_models.dart';

class CommunityDetailState {
  final bool isLoading;
  final String? errorMessage;
  final CommunityModel? community;
  final List<CommunityPostModel> posts;
  final List<CommunityCollectionModel> collections;
  final List<CommunityReportModel> modQueue;
  final int activeTabIndex; // 0: Discussions, 1: Collections, 2: Rules, 3: Mod Queue

  const CommunityDetailState({
    this.isLoading = false,
    this.errorMessage,
    this.community,
    this.posts = const [],
    this.collections = const [],
    this.modQueue = const [],
    this.activeTabIndex = 0,
  });

  CommunityDetailState copyWith({
    bool? isLoading,
    String? errorMessage,
    CommunityModel? community,
    List<CommunityPostModel>? posts,
    List<CommunityCollectionModel>? collections,
    List<CommunityReportModel>? modQueue,
    int? activeTabIndex,
  }) {
    return CommunityDetailState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      community: community ?? this.community,
      posts: posts ?? this.posts,
      collections: collections ?? this.collections,
      modQueue: modQueue ?? this.modQueue,
      activeTabIndex: activeTabIndex ?? this.activeTabIndex,
    );
  }
}

class CommunityDetailNotifier extends ChangeNotifier {
  final CommunitiesRepository repository;
  final String identifier;
  final String? authToken;

  CommunityDetailState _state = const CommunityDetailState();
  CommunityDetailState get state => _state;

  CommunityDetailNotifier({
    required this.repository,
    required this.identifier,
    this.authToken,
  }) {
    loadCommunityData();
  }

  void setTabIndex(int index) {
    _state = _state.copyWith(activeTabIndex: index);
    notifyListeners();

    if (index == 1 && _state.collections.isEmpty && _state.community != null) {
      loadCollections();
    } else if (index == 3 && _state.modQueue.isEmpty && _state.community?.isStaff == true) {
      loadModQueue();
    }
  }

  Future<void> loadCommunityData() async {
    _state = _state.copyWith(isLoading: true, errorMessage: null);
    notifyListeners();

    try {
      final comm = await repository.getCommunity(identifier, token: authToken);
      final posts = await repository.listPosts(comm.id, token: authToken);

      _state = _state.copyWith(
        isLoading: false,
        community: comm,
        posts: posts,
      );
    } on Failure catch (e) {
      _state = _state.copyWith(isLoading: false, errorMessage: e.message);
    } catch (e) {
      _state = _state.copyWith(isLoading: false, errorMessage: 'Failed to load community: $e');
    }
    notifyListeners();
  }

  Future<void> loadCollections() async {
    if (_state.community == null) return;
    try {
      final cols = await repository.listCollections(_state.community!.id, token: authToken);
      _state = _state.copyWith(collections: cols);
      notifyListeners();
    } catch (_) {}
  }

  Future<void> loadModQueue() async {
    if (_state.community == null || !_state.community!.isStaff) return;
    try {
      final queue = await repository.getModerationQueue(_state.community!.id, token: authToken);
      _state = _state.copyWith(modQueue: queue);
      notifyListeners();
    } catch (_) {}
  }

  Future<void> joinCommunity() async {
    if (_state.community == null) return;
    try {
      await repository.joinCommunity(_state.community!.id, token: authToken);
      await loadCommunityData();
    } on Failure catch (e) {
      _state = _state.copyWith(errorMessage: e.message);
      notifyListeners();
    }
  }

  Future<void> leaveCommunity() async {
    if (_state.community == null) return;
    try {
      await repository.leaveCommunity(_state.community!.id, token: authToken);
      await loadCommunityData();
    } on Failure catch (e) {
      _state = _state.copyWith(errorMessage: e.message);
      notifyListeners();
    }
  }

  Future<void> createPost({
    required String title,
    required String body,
    CommunityPostType postType = CommunityPostType.discussion,
    List<String>? collaboratorIds,
    bool isPinned = false,
  }) async {
    if (_state.community == null) return;

    try {
      final post = await repository.createPost(
        _state.community!.id,
        {
          'title': title,
          'body': body,
          'postType': postType.value,
          if (collaboratorIds != null) 'collaboratorIds': collaboratorIds,
          if (isPinned) 'isPinned': true,
        },
        token: authToken,
      );

      _state = _state.copyWith(posts: [post, ..._state.posts]);
      notifyListeners();
    } on Failure catch (e) {
      _state = _state.copyWith(errorMessage: e.message);
      notifyListeners();
    }
  }

  Future<void> togglePinPost(String postId) async {
    if (_state.community == null) return;
    try {
      await repository.togglePinPost(_state.community!.id, postId, token: authToken);
      final updatedList = _state.posts.map((p) {
        if (p.id == postId) {
          return p.copyWith(isPinned: !p.isPinned);
        }
        return p;
      }).toList();
      _state = _state.copyWith(posts: updatedList);
      notifyListeners();
    } catch (_) {}
  }

  Future<void> reportTarget(String targetType, String targetId, String reason, String? details) async {
    if (_state.community == null) return;
    await repository.reportTarget(
      _state.community!.id,
      {
        'targetType': targetType,
        'targetId': targetId,
        'reason': reason,
        if (details != null) 'details': details,
      },
      token: authToken,
    );
  }

  Future<void> resolveReport(String reportId, String status, String? actionTaken) async {
    if (_state.community == null) return;
    await repository.reviewReport(
      _state.community!.id,
      reportId,
      {
        'status': status,
        if (actionTaken != null) 'actionTaken': actionTaken,
      },
      token: authToken,
    );
    await loadModQueue();
    await loadCommunityData();
  }
}
