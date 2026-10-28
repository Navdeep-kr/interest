import 'package:mobile/features/search/domain/models/search_models.dart';

abstract class SearchState {
  const SearchState();
}

class SearchInitialState extends SearchState {
  final List<RecentSearchItemModel> recentSearches;
  final TransparentTrendingModel? trending;
  final bool isLoadingTrending;

  const SearchInitialState({
    this.recentSearches = const [],
    this.trending,
    this.isLoadingTrending = false,
  });

  SearchInitialState copyWith({
    List<RecentSearchItemModel>? recentSearches,
    TransparentTrendingModel? trending,
    bool? isLoadingTrending,
  }) {
    return SearchInitialState(
      recentSearches: recentSearches ?? this.recentSearches,
      trending: trending ?? this.trending,
      isLoadingTrending: isLoadingTrending ?? this.isLoadingTrending,
    );
  }
}

class SearchAutocompleteState extends SearchState {
  final String query;
  final List<SafeAutocompleteSuggestionModel> suggestions;

  const SearchAutocompleteState({
    required this.query,
    required this.suggestions,
  });
}

class SearchLoadingState extends SearchState {
  final String query;
  final String activeTab;

  const SearchLoadingState({
    required this.query,
    required this.activeTab,
  });
}

class SearchLoadedState extends SearchState {
  final String query;
  final String activeTab; // 'all' | 'topics' | 'creators' | 'reels' | 'hashtags' | 'communities'
  final UnifiedSearchResultsModel results;

  const SearchLoadedState({
    required this.query,
    required this.activeTab,
    required this.results,
  });

  SearchLoadedState copyWith({
    String? query,
    String? activeTab,
    UnifiedSearchResultsModel? results,
  }) {
    return SearchLoadedState(
      query: query ?? this.query,
      activeTab: activeTab ?? this.activeTab,
      results: results ?? this.results,
    );
  }
}

class SearchErrorState extends SearchState {
  final String query;
  final String message;

  const SearchErrorState({
    required this.query,
    required this.message,
  });
}
