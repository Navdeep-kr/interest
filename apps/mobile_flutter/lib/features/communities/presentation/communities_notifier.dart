import 'package:flutter/foundation.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/communities/data/communities_repository.dart';
import 'package:mobile/features/communities/domain/models/community_models.dart';

class CommunitiesListState {
  final bool isLoading;
  final String? errorMessage;
  final List<CommunityModel> communities;
  final bool joinedOnly;
  final String searchQuery;

  const CommunitiesListState({
    this.isLoading = false,
    this.errorMessage,
    this.communities = const [],
    this.joinedOnly = false,
    this.searchQuery = '',
  });

  CommunitiesListState copyWith({
    bool? isLoading,
    String? errorMessage,
    List<CommunityModel>? communities,
    bool? joinedOnly,
    String? searchQuery,
  }) {
    return CommunitiesListState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      communities: communities ?? this.communities,
      joinedOnly: joinedOnly ?? this.joinedOnly,
      searchQuery: searchQuery ?? this.searchQuery,
    );
  }
}

class CommunitiesNotifier extends ChangeNotifier {
  final CommunitiesRepository repository;
  final String? authToken;

  CommunitiesListState _state = const CommunitiesListState();
  CommunitiesListState get state => _state;

  CommunitiesNotifier({
    required this.repository,
    this.authToken,
  }) {
    loadCommunities();
  }

  Future<void> loadCommunities() async {
    _state = _state.copyWith(isLoading: true, errorMessage: null);
    notifyListeners();

    try {
      final list = await repository.listCommunities(
        joinedOnly: _state.joinedOnly,
        search: _state.searchQuery.isEmpty ? null : _state.searchQuery,
        token: authToken,
      );
      _state = _state.copyWith(isLoading: false, communities: list);
    } on Failure catch (e) {
      _state = _state.copyWith(isLoading: false, errorMessage: e.message);
    } catch (e) {
      _state = _state.copyWith(isLoading: false, errorMessage: 'Failed to load communities: $e');
    }
    notifyListeners();
  }

  void setJoinedOnly(bool val) {
    if (_state.joinedOnly != val) {
      _state = _state.copyWith(joinedOnly: val);
      loadCommunities();
    }
  }

  void setSearchQuery(String query) {
    _state = _state.copyWith(searchQuery: query);
    loadCommunities();
  }
}
