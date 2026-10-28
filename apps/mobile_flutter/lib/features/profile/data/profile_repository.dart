import 'package:flutter/foundation.dart';
import '../../../core/config/env_config.dart';
import '../../../core/error/failures.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../domain/models/user_profile.dart';
import '../domain/models/follow_request_item.dart';
import '../domain/models/profile_reel_item.dart';
import 'profile_api_client.dart';

class ProfileRepository {
  final ProfileApiClient apiClient;
  final SecureStorageService secureStorage;

  ProfileRepository({
    required this.apiClient,
    required this.secureStorage,
  });

  Future<String> _getRequiredToken() async {
    final token = await secureStorage.getAccessToken();
    if (token != null && token.isNotEmpty) return token;
    if (kIsWeb || EnvConfig.mockModeEnabled) {
      return 'mock_access_token_creator';
    }
    throw const AuthenticationFailure(
      message: 'No active session found. Please log in.',
      statusCode: 401,
    );
  }

  Future<UserProfile> getMyProfile() async {
    final token = await _getRequiredToken();
    return apiClient.getMyProfile(token: token);
  }

  Future<UserProfile> getProfile(String identifier) async {
    final token = await secureStorage.getAccessToken();
    return apiClient.getProfile(identifier, token: token);
  }

  Future<UserProfile> updateProfile(Map<String, dynamic> data) async {
    final token = await _getRequiredToken();
    return apiClient.updateProfile(data, token: token);
  }

  Future<List<ProfileReelItem>> getProfileReels(
    String userId, {
    int limit = 20,
    String? cursor,
  }) async {
    final token = await secureStorage.getAccessToken();
    return apiClient.getProfileReels(
      userId,
      token: token,
      limit: limit,
      cursor: cursor,
    );
  }

  Future<List<ProfileReelItem>> getProfileLikedReels(
    String userId, {
    int limit = 20,
    String? cursor,
  }) async {
    final token = await _getRequiredToken();
    return apiClient.getProfileLikedReels(
      userId,
      token: token,
      limit: limit,
      cursor: cursor,
    );
  }

  Future<Map<String, dynamic>> followUser(String userId) async {
    final token = await _getRequiredToken();
    return apiClient.followUser(userId, token: token);
  }

  Future<Map<String, dynamic>> unfollowUser(String userId) async {
    final token = await _getRequiredToken();
    return apiClient.unfollowUser(userId, token: token);
  }

  Future<Map<String, dynamic>> cancelFollowRequest(String userId) async {
    final token = await _getRequiredToken();
    return apiClient.cancelFollowRequest(userId, token: token);
  }

  Future<List<FollowRequestItem>> getPendingFollowRequests({
    int limit = 20,
    int offset = 0,
  }) async {
    final token = await _getRequiredToken();
    return apiClient.getPendingFollowRequests(
      token: token,
      limit: limit,
      offset: offset,
    );
  }

  Future<Map<String, dynamic>> respondFollowRequest(
    String requestId,
    String action,
  ) async {
    final token = await _getRequiredToken();
    return apiClient.respondFollowRequest(requestId, action, token: token);
  }

  Future<Map<String, dynamic>> restrictUser(String userId) async {
    final token = await _getRequiredToken();
    return apiClient.restrictUser(userId, token: token);
  }

  Future<Map<String, dynamic>> unrestrictUser(String userId) async {
    final token = await _getRequiredToken();
    return apiClient.unrestrictUser(userId, token: token);
  }

  Future<List<Map<String, dynamic>>> searchMentions(
    String query, {
    int limit = 20,
  }) async {
    final token = await _getRequiredToken();
    return apiClient.searchMentions(query, token: token, limit: limit);
  }

  Future<List<Map<String, dynamic>>> getRecommendations({
    int limit = 15,
  }) async {
    final token = await _getRequiredToken();
    return apiClient.getRecommendations(token: token, limit: limit);
  }
}
