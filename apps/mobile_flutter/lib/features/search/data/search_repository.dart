import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/features/search/data/search_api_client.dart';
import 'package:mobile/features/search/domain/models/search_models.dart';

class SearchRepository {
  final SearchApiClient apiClient;
  final SecureStorageService secureStorage;

  SearchRepository({
    required this.apiClient,
    required this.secureStorage,
  });

  Future<String?> _getToken() async {
    return secureStorage.getAccessToken();
  }

  Future<UnifiedSearchResultsModel> search({
    required String query,
    String type = 'all',
    int limit = 20,
    int offset = 0,
  }) async {
    final token = await _getToken();
    return apiClient.search(
      query: query,
      type: type,
      limit: limit,
      offset: offset,
      token: token,
    );
  }

  Future<List<SafeAutocompleteSuggestionModel>> getAutocomplete(
    String query, {
    int limit = 10,
  }) async {
    final token = await _getToken();
    return apiClient.getSafeAutocomplete(query, limit: limit, token: token);
  }

  Future<TransparentTrendingModel> getTrending({
    String window = '24h',
    int limit = 10,
  }) async {
    final token = await _getToken();
    return apiClient.getTransparentTrending(window: window, limit: limit, token: token);
  }

  Future<List<RecentSearchItemModel>> getRecentSearches({int limit = 10}) async {
    final token = await _getToken();
    return apiClient.getRecentSearches(limit: limit, token: token);
  }

  Future<void> recordRecentSearch({
    required String queryText,
    String searchType = 'all',
  }) async {
    final token = await _getToken();
    return apiClient.recordRecentSearch(
      queryText: queryText,
      searchType: searchType,
      token: token,
    );
  }

  Future<void> deleteRecentSearch(String searchId) async {
    final token = await _getToken();
    return apiClient.deleteRecentSearch(searchId: searchId, token: token);
  }

  Future<void> clearRecentSearches() async {
    final token = await _getToken();
    return apiClient.clearRecentSearches(token: token);
  }

  Future<TopicPageDetailsModel> getTopicPage(String idOrSlug) async {
    final token = await _getToken();
    return apiClient.getTopicPage(idOrSlug: idOrSlug, token: token);
  }

  Future<void> followTopic(String id) async {
    final token = await _getToken();
    return apiClient.followTopic(id: id, token: token);
  }

  Future<void> unfollowTopic(String id) async {
    final token = await _getToken();
    return apiClient.unfollowTopic(id: id, token: token);
  }

  Future<bool> toggleMuteTopic(String id, bool isMuted) async {
    final token = await _getToken();
    return apiClient.toggleMuteTopic(id: id, isMuted: isMuted, token: token);
  }
}
