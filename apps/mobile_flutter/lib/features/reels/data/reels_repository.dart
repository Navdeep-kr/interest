import 'package:mobile/core/error/failures.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/features/reels/domain/models/reel_item_model.dart';
import 'package:mobile/features/reels/domain/models/comment_item_model.dart';
import 'package:mobile/features/reels/domain/models/collection_item_model.dart';
import 'reels_api_client.dart';

class ReelsRepository {
  final ReelsApiClient apiClient;
  final SecureStorageService secureStorage;

  ReelsRepository({
    required this.apiClient,
    required this.secureStorage,
  });

  Future<String> _getRequiredToken() async {
    final token = await secureStorage.getAccessToken();
    if (token == null || token.isEmpty) {
      throw const AuthenticationFailure(
        message: 'No active session found. Please log in.',
        statusCode: 401,
      );
    }
    return token;
  }

  Future<List<ReelItemModel>> getFeed({
    int limit = 10,
    String? cursor,
    String? interestId,
    String mode = 'FOR_YOU',
  }) async {
    final token = await secureStorage.getAccessToken();
    return apiClient.getFeed(
      limit: limit,
      cursor: cursor,
      interestId: interestId,
      mode: mode,
      token: token,
    );
  }

  Future<Map<String, dynamic>> applyFeedControl({
    required String reelId,
    required String action,
    String? interestId,
  }) async {
    final token = await _getRequiredToken();
    return apiClient.applyFeedControl(
      reelId: reelId,
      action: action,
      interestId: interestId,
      token: token,
    );
  }

  Future<Map<String, dynamic>> resetFeedPreferences() async {
    final token = await _getRequiredToken();
    return apiClient.resetFeedPreferences(token: token);
  }

  Future<ReelItemModel> getReelById(String reelId) async {
    final token = await secureStorage.getAccessToken();
    return apiClient.getReelById(reelId, token: token);
  }

  Future<List<ReelItemModel>> getCreatorReels(
    String creatorId, {
    int limit = 20,
    String? cursor,
  }) async {
    final token = await secureStorage.getAccessToken();
    return apiClient.getCreatorReels(
      creatorId,
      limit: limit,
      cursor: cursor,
      token: token,
    );
  }

  Future<ReelItemModel> createImagePost({
    required String title,
    String? caption,
    required List<String> imageUrls,
    required String primaryInterestId,
    List<String>? interestTags,
    List<String>? hashtags,
    String visibility = 'PUBLIC',
  }) async {
    final token = await _getRequiredToken();
    return apiClient.createImagePost(
      title: title,
      caption: caption,
      imageUrls: imageUrls,
      primaryInterestId: primaryInterestId,
      interestTags: interestTags,
      hashtags: hashtags,
      visibility: visibility,
      token: token,
    );
  }

  Future<ReelItemModel> updateReel(
    String reelId, {
    String? title,
    String? caption,
    List<String>? hashtags,
    String? visibility,
    bool? isPinned,
  }) async {
    final token = await _getRequiredToken();
    return apiClient.updateReel(
      reelId,
      title: title,
      caption: caption,
      hashtags: hashtags,
      visibility: visibility,
      isPinned: isPinned,
      token: token,
    );
  }

  Future<void> deleteReel(String reelId) async {
    final token = await _getRequiredToken();
    await apiClient.deleteReel(reelId, token: token);
  }

  Future<ReelItemModel> pinReel(String reelId) async {
    final token = await _getRequiredToken();
    return apiClient.pinReel(reelId, token: token);
  }

  Future<ReelItemModel> unpinReel(String reelId) async {
    final token = await _getRequiredToken();
    return apiClient.unpinReel(reelId, token: token);
  }

  Future<void> hideReel(String reelId) async {
    final token = await _getRequiredToken();
    await apiClient.hideReel(reelId, token: token);
  }

  Future<void> unhideReel(String reelId) async {
    final token = await _getRequiredToken();
    await apiClient.unhideReel(reelId, token: token);
  }

  Future<Map<String, dynamic>> likeReel(String reelId) async {
    final token = await _getRequiredToken();
    return apiClient.likeReel(reelId, token: token);
  }

  Future<Map<String, dynamic>> unlikeReel(String reelId) async {
    final token = await _getRequiredToken();
    return apiClient.unlikeReel(reelId, token: token);
  }

  Future<Map<String, dynamic>> saveReel(String reelId, {String? collectionId}) async {
    final token = await _getRequiredToken();
    return apiClient.saveReel(reelId, collectionId: collectionId, token: token);
  }

  Future<Map<String, dynamic>> unsaveReel(String reelId) async {
    final token = await _getRequiredToken();
    return apiClient.unsaveReel(reelId, token: token);
  }

  Future<Map<String, dynamic>> shareReel(String reelId, {String? platform}) async {
    final token = await _getRequiredToken();
    return apiClient.shareReel(reelId, platform: platform, token: token);
  }

  Future<List<CommentItemModel>> getComments(
    String reelId, {
    int limit = 20,
    String? cursor,
  }) async {
    final token = await secureStorage.getAccessToken();
    return apiClient.getComments(
      reelId,
      limit: limit,
      cursor: cursor,
      token: token,
    );
  }

  Future<CommentItemModel> addComment(
    String reelId, {
    required String text,
    String? parentId,
  }) async {
    final token = await _getRequiredToken();
    return apiClient.addComment(
      reelId,
      text: text,
      parentId: parentId,
      token: token,
    );
  }

  Future<Map<String, dynamic>> likeComment(String commentId) async {
    final token = await _getRequiredToken();
    return apiClient.likeComment(commentId, token: token);
  }

  Future<Map<String, dynamic>> unlikeComment(String commentId) async {
    final token = await _getRequiredToken();
    return apiClient.unlikeComment(commentId, token: token);
  }

  Future<Map<String, dynamic>> pinComment(String commentId) async {
    final token = await _getRequiredToken();
    return apiClient.pinComment(commentId, token: token);
  }

  Future<void> deleteComment(String commentId) async {
    final token = await _getRequiredToken();
    await apiClient.deleteComment(commentId, token: token);
  }

  Future<List<CollectionItemModel>> getCollections() async {
    final token = await _getRequiredToken();
    return apiClient.getCollections(token: token);
  }

  Future<CollectionItemModel> createCollection({
    required String name,
    bool isPrivate = true,
  }) async {
    final token = await _getRequiredToken();
    return apiClient.createCollection(
      name: name,
      isPrivate: isPrivate,
      token: token,
    );
  }

  // ==========================================================================
  // MULTIPART VIDEO METHODS
  // ==========================================================================

  Future<Map<String, dynamic>> initiateMultipartUpload({
    required String filename,
    required String contentType,
    required int fileSizeBytes,
  }) async {
    final token = await _getRequiredToken();
    return apiClient.initiateMultipartUpload(
      filename: filename,
      contentType: contentType,
      fileSizeBytes: fileSizeBytes,
      token: token,
    );
  }

  Future<List<Map<String, dynamic>>> getMultipartPartUrls({
    required String reelId,
    required String uploadId,
    required String s3Key,
    required List<int> partNumbers,
  }) async {
    final token = await _getRequiredToken();
    return apiClient.getMultipartPartUrls(
      reelId: reelId,
      uploadId: uploadId,
      s3Key: s3Key,
      partNumbers: partNumbers,
      token: token,
    );
  }

  Future<Map<String, dynamic>> completeMultipartUpload({
    required String reelId,
    required String uploadId,
    required String s3Key,
    required List<Map<String, dynamic>> parts,
  }) async {
    final token = await _getRequiredToken();
    return apiClient.completeMultipartUpload(
      reelId: reelId,
      uploadId: uploadId,
      s3Key: s3Key,
      parts: parts,
      token: token,
    );
  }

  Future<Map<String, dynamic>> abortMultipartUpload({
    required String reelId,
    required String uploadId,
    required String s3Key,
  }) async {
    final token = await _getRequiredToken();
    return apiClient.abortMultipartUpload(
      reelId: reelId,
      uploadId: uploadId,
      s3Key: s3Key,
      token: token,
    );
  }

  Future<Map<String, dynamic>> finalizeReel({
    required String reelId,
    required String title,
    String? caption,
    List<String>? hashtags,
    required String primaryInterestId,
    List<String>? interestTagIds,
    String visibility = 'PUBLIC',
    double coverTimestampSeconds = 1.0,
  }) async {
    final token = await _getRequiredToken();
    return apiClient.finalizeReel(
      reelId: reelId,
      title: title,
      caption: caption,
      hashtags: hashtags,
      primaryInterestId: primaryInterestId,
      interestTagIds: interestTagIds,
      visibility: visibility,
      coverTimestampSeconds: coverTimestampSeconds,
      token: token,
    );
  }

  Future<Map<String, dynamic>> getReelStatus(String reelId) async {
    final token = await _getRequiredToken();
    return apiClient.getReelStatus(reelId, token: token);
  }
}
