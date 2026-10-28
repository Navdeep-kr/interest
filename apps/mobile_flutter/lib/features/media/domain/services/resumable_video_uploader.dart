import 'dart:async';
import 'dart:io';
import 'dart:math';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/reels/data/reels_repository.dart';
import '../models/upload_session_model.dart';

typedef UploadProgressCallback = void Function(int bytesUploaded, int totalBytes, double percent);

class ResumableVideoUploader {
  final ReelsRepository repository;
  final HttpClient _httpClient;

  static const int partSize = 5 * 1024 * 1024; // 5 MB minimum AWS S3 part size
  static const int maxFileSizeBytes = 500 * 1024 * 1024; // 500 MB max

  static const List<String> allowedExtensions = [
    '.mp4',
    '.mov',
    '.webm',
    '.m4v',
    '.3gp',
  ];

  bool _isPaused = false;
  bool _isCancelled = false;

  ResumableVideoUploader({
    required this.repository,
    HttpClient? httpClient,
  }) : _httpClient = httpClient ?? HttpClient() {
    _httpClient.connectionTimeout = const Duration(seconds: 30);
  }

  void pause() {
    _isPaused = true;
  }

  void resume() {
    _isPaused = false;
  }

  void cancel() {
    _isCancelled = true;
  }

  void reset() {
    _isPaused = false;
    _isCancelled = false;
  }

  /// Validates local video file metadata (size, format, existence).
  void validateVideoFile(File file) {
    if (!file.existsSync()) {
      throw const ValidationFailure(message: 'Selected video file does not exist.');
    }

    final length = file.lengthSync();
    if (length == 0) {
      throw const ValidationFailure(message: 'Selected video file is empty.');
    }

    if (length > maxFileSizeBytes) {
      throw const ValidationFailure(
        message: 'Video file exceeds maximum limit of 500 MB.',
      );
    }

    final path = file.path.toLowerCase();
    final hasValidExt = allowedExtensions.any((ext) => path.endsWith(ext));
    if (!hasValidExt) {
      throw const ValidationFailure(
        message: 'Invalid video format. Supported formats: MP4, QuickTime (MOV), WebM.',
      );
    }
  }

  /// Executes full end-to-end resumable multipart upload, completion, and finalization.
  Future<UploadSessionModel> uploadVideo({
    required File file,
    required String title,
    String? caption,
    List<String>? hashtags,
    required String primaryInterestId,
    List<String>? interestTagIds,
    String visibility = 'PUBLIC',
    UploadProgressCallback? onProgress,
  }) async {
    _isPaused = false;

    validateVideoFile(file);
    final fileSizeBytes = file.lengthSync();
    final filename = file.uri.pathSegments.isNotEmpty
        ? file.uri.pathSegments.last
        : 'video_${DateTime.now().millisecondsSinceEpoch}.mp4';

    // 1. Determine Content-Type
    String contentType = 'video/mp4';
    if (filename.toLowerCase().endsWith('.mov')) contentType = 'video/quicktime';
    if (filename.toLowerCase().endsWith('.webm')) contentType = 'video/webm';

    // 2. Initiate S3 Multipart Upload Session
    final initRes = await repository.initiateMultipartUpload(
      filename: filename,
      contentType: contentType,
      fileSizeBytes: fileSizeBytes,
    );

    final reelId = initRes['reelId'] as String;
    final uploadId = initRes['uploadId'] as String;
    final s3Key = initRes['s3Key'] as String;
    final expectedParts = (initRes['expectedParts'] as num?)?.toInt() ??
        max(1, (fileSizeBytes / partSize).ceil());

    UploadSessionModel session = UploadSessionModel(
      reelId: reelId,
      uploadId: uploadId,
      s3Key: s3Key,
      filename: filename,
      fileSizeBytes: fileSizeBytes,
      expectedParts: expectedParts,
      status: UploadSessionStatus.uploading,
    );

    // If cancelled before or during initiation, abort and exit
    if (_isCancelled) {
      await repository.abortMultipartUpload(
        reelId: reelId,
        uploadId: uploadId,
        s3Key: s3Key,
      );
      return session.copyWith(
        status: UploadSessionStatus.aborted,
        errorReason: 'Upload cancelled by user',
      );
    }

    final completedParts = <UploadPartItem>[];
    int uploadedBytes = 0;

    // 3. Process Parts
    final raf = await file.open(mode: FileMode.read);
    try {
      for (int partNum = 1; partNum <= expectedParts; partNum++) {
        if (_isCancelled) {
          await repository.abortMultipartUpload(
            reelId: reelId,
            uploadId: uploadId,
            s3Key: s3Key,
          );
          return session.copyWith(
            status: UploadSessionStatus.aborted,
            errorReason: 'Upload cancelled by user',
          );
        }

        while (_isPaused) {
          await Future.delayed(const Duration(milliseconds: 300));
          if (_isCancelled) {
            await repository.abortMultipartUpload(
              reelId: reelId,
              uploadId: uploadId,
              s3Key: s3Key,
            );
            return session.copyWith(status: UploadSessionStatus.aborted);
          }
        }

        // Fetch presigned URL for this part
        final partUrls = await repository.getMultipartPartUrls(
          reelId: reelId,
          uploadId: uploadId,
          s3Key: s3Key,
          partNumbers: [partNum],
        );
        final partUrl = partUrls.first['url'] as String;

        // Slice chunk
        final start = (partNum - 1) * partSize;
        final currentChunkSize = min(partSize, fileSizeBytes - start);
        await raf.setPosition(start);
        final chunkBytes = await raf.read(currentChunkSize);

        // Upload chunk with exponential backoff retry (up to 3 retries)
        final etag = await _uploadChunkWithRetry(partUrl, chunkBytes);

        completedParts.add(UploadPartItem(
          partNumber: partNum,
          etag: etag,
          sizeBytes: currentChunkSize,
        ));

        uploadedBytes += currentChunkSize;
        final percent = (uploadedBytes / fileSizeBytes) * 100.0;
        onProgress?.call(uploadedBytes, fileSizeBytes, percent);
      }
    } finally {
      await raf.close();
    }

    // 4. Complete Multipart Upload
    final partsPayload = completedParts
        .map((p) => {'partNumber': p.partNumber, 'etag': p.etag})
        .toList();

    await repository.completeMultipartUpload(
      reelId: reelId,
      uploadId: uploadId,
      s3Key: s3Key,
      parts: partsPayload,
    );

    // 5. Finalize Metadata and Queue Transcoding
    session = session.copyWith(
      completedParts: completedParts,
      status: UploadSessionStatus.processing,
      progressPercent: 100.0,
    );

    await repository.finalizeReel(
      reelId: reelId,
      title: title,
      caption: caption,
      hashtags: hashtags,
      primaryInterestId: primaryInterestId,
      interestTagIds: interestTagIds,
      visibility: visibility,
    );

    return session;
  }

  /// Uploads chunk to S3 PUT URL with retry and returns ETag.
  Future<String> _uploadChunkWithRetry(String putUrl, List<int> chunkBytes) async {
    int attempts = 0;
    while (attempts < 3) {
      attempts++;
      try {
        final request = await _httpClient.putUrl(Uri.parse(putUrl));
        request.headers.set(HttpHeaders.contentTypeHeader, 'application/octet-stream');
        request.contentLength = chunkBytes.length;
        request.add(chunkBytes);

        final response = await request.close().timeout(const Duration(seconds: 45));
        if (response.statusCode >= 200 && response.statusCode < 300) {
          final rawEtag = response.headers.value('etag') ?? '"etag-$attempts"';
          // Clean quotes if present
          final cleanEtag = rawEtag.replaceAll('"', '').trim();
          return '"$cleanEtag"';
        }
      } catch (e) {
        if (attempts >= 3) {
          throw ServerFailure(message: 'Failed to upload video chunk after 3 attempts: $e');
        }
        await Future.delayed(Duration(milliseconds: 300 * attempts));
      }
    }
    throw const ServerFailure(message: 'Upload chunk failed.');
  }

  /// Polls status until transcode completes or fails.
  Future<UploadSessionModel> waitForProcessing(
    UploadSessionModel session, {
    Duration timeout = const Duration(minutes: 5),
    Duration pollInterval = const Duration(seconds: 2),
  }) async {
    final startTime = DateTime.now();

    while (DateTime.now().difference(startTime) < timeout) {
      final statusRes = await repository.getReelStatus(session.reelId);
      final statusStr = statusRes['status'] as String? ?? '';

      if (statusStr == 'PUBLISHED') {
        return session.copyWith(
          status: UploadSessionStatus.completed,
          hlsMasterUrl: statusRes['hlsMasterUrl'] as String?,
          progressPercent: 100.0,
        );
      } else if (statusStr == 'FAILED') {
        return session.copyWith(
          status: UploadSessionStatus.failed,
          errorReason: statusRes['errorReason'] as String? ?? 'Transcoding failed',
        );
      }

      await Future.delayed(pollInterval);
    }

    return session.copyWith(
      status: UploadSessionStatus.processing,
      errorReason: 'Processing timed out. Video will be available once transcoding finishes.',
    );
  }
}
