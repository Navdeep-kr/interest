import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/search/data/search_repository.dart';
import 'package:mobile/features/search/presentation/search_state.dart';

class SearchNotifier extends ChangeNotifier {
  final SearchRepository repository;

  SearchState _state = const SearchInitialState();
  SearchState get state => _state;

  Timer? _debounceTimer;
  String _activeTrendingWindow = '24h';
  String get activeTrendingWindow => _activeTrendingWindow;

  String _currentQuery = '';
  String get currentQuery => _currentQuery;

  String _currentTab = 'all';
  String get currentTab => _currentTab;

  SearchNotifier({required this.repository});

  void _setState(SearchState newState) {
    _state = newState;
    notifyListeners();
  }

  /// Initial load: fetches recent searches and trending velocity metrics.
  Future<void> loadInitialData() async {
    _setState(const SearchInitialState(isLoadingTrending: true));
    try {
      final recents = await repository.getRecentSearches(limit: 10);
      final trending = await repository.getTrending(window: _activeTrendingWindow, limit: 8);
      _setState(SearchInitialState(
        recentSearches: recents,
        trending: trending,
        isLoadingTrending: false,
      ));
    } catch (_) {
      _setState(const SearchInitialState(isLoadingTrending: false));
    }
  }

  /// Switch transparent trending velocity window (24h, 72h, 7d).
  Future<void> switchTrendingWindow(String window) async {
    if (_activeTrendingWindow == window) return;
    _activeTrendingWindow = window;

    if (_state is SearchInitialState) {
      final current = _state as SearchInitialState;
      _setState(current.copyWith(isLoadingTrending: true));
      try {
        final trending = await repository.getTrending(window: window, limit: 8);
        _setState(current.copyWith(trending: trending, isLoadingTrending: false));
      } catch (_) {
        _setState(current.copyWith(isLoadingTrending: false));
      }
    }
  }

  /// Search query typing with debounce for safe autocomplete.
  void onQueryChanged(String query) {
    _currentQuery = query.trim();
    _debounceTimer?.cancel();

    if (_currentQuery.isEmpty) {
      loadInitialData();
      return;
    }

    _debounceTimer = Timer(const Duration(milliseconds: 250), () async {
      try {
        final suggestions = await repository.getAutocomplete(_currentQuery, limit: 6);
        _setState(SearchAutocompleteState(
          query: _currentQuery,
          suggestions: suggestions,
        ));
      } catch (_) {}
    });
  }

  /// Execute authoritative search across domain tabs.
  Future<void> executeSearch(String query, {String? type}) async {
    final cleanQuery = query.trim();
    if (cleanQuery.isEmpty) return;

    _debounceTimer?.cancel();
    _currentQuery = cleanQuery;
    final searchType = type ?? _currentTab;
    _currentTab = searchType;

    _setState(SearchLoadingState(query: cleanQuery, activeTab: searchType));

    try {
      final results = await repository.search(
        query: cleanQuery,
        type: searchType,
        limit: 20,
      );

      // Record recent search asynchronously
      repository.recordRecentSearch(queryText: cleanQuery, searchType: searchType).catchError((_) {});

      _setState(SearchLoadedState(
        query: cleanQuery,
        activeTab: searchType,
        results: results,
      ));
    } on Failure catch (e) {
      _setState(SearchErrorState(query: cleanQuery, message: e.message));
    } catch (e) {
      _setState(SearchErrorState(query: cleanQuery, message: 'Search failed: $e'));
    }
  }

  /// Switch domain tab ('all', 'interests', 'users', 'reels', 'hashtags', 'communities').
  void switchDomainTab(String tab) {
    if (_currentTab == tab) return;
    _currentTab = tab;
    if (_currentQuery.isNotEmpty) {
      executeSearch(_currentQuery, type: tab);
    }
  }

  /// Delete a single recent search query.
  Future<void> deleteRecent(String searchId) async {
    try {
      await repository.deleteRecentSearch(searchId);
      if (_state is SearchInitialState) {
        final current = _state as SearchInitialState;
        final updated = current.recentSearches.where((s) => s.id != searchId).toList();
        _setState(current.copyWith(recentSearches: updated));
      }
    } catch (_) {}
  }

  /// Clear all recent searches.
  Future<void> clearAllRecents() async {
    try {
      await repository.clearRecentSearches();
      if (_state is SearchInitialState) {
        final current = _state as SearchInitialState;
        _setState(current.copyWith(recentSearches: []));
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    super.dispose();
  }
}
