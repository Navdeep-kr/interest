import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/reels/data/reels_repository.dart';
import 'package:mobile/features/media/domain/services/resumable_video_uploader.dart';
import 'package:mobile/features/media/domain/models/upload_session_model.dart';

class MockReelsRepositoryForUpload implements ReelsRepository {
  bool initiateCalled = false;
  bool partUrlsCalled = false;
  bool completeCalled = false;
  bool abortCalled = false;
  bool finalizeCalled = false;
  int getStatusCalls = 0;

  List<Map<String, dynamic>> lastCompletedParts = [];

  @override
  Future<Map<String, dynamic>> initiateMultipartUpload({
    required String filename,
    required String contentType,
    required int fileSizeBytes,
  }) async {
    initiateCalled = true;
    return {
      'reelId': 'reel-upload-test-1',
      'uploadId': 'upload-id-123',
      's3Key': 'uploads/raw/test.mp4',
      'expectedParts': 2,
    };
  }

  @override
  Future<List<Map<String, dynamic>>> getMultipartPartUrls({
    required String reelId,
    required String uploadId,
    required String s3Key,
    required List<int> partNumbers,
  }) async {
    partUrlsCalled = true;
    return partNumbers.map((pNum) => {'partNumber': pNum, 'url': 'https://s3.test/part-$pNum'}).toList();
  }

  @override
  Future<Map<String, dynamic>> completeMultipartUpload({
    required String reelId,
    required String uploadId,
    required String s3Key,
    required List<Map<String, dynamic>> parts,
  }) async {
    completeCalled = true;
    lastCompletedParts = parts;
    return {'success': true};
  }

  @override
  Future<Map<String, dynamic>> abortMultipartUpload({
    required String reelId,
    required String uploadId,
    required String s3Key,
  }) async {
    abortCalled = true;
    return {'aborted': true};
  }

  @override
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
    finalizeCalled = true;
    return {'status': 'PROCESSING'};
  }

  @override
  Future<Map<String, dynamic>> getReelStatus(String reelId) async {
    getStatusCalls++;
    if (getStatusCalls >= 2) {
      return {
        'status': 'PUBLISHED',
        'hlsMasterUrl': 'https://cdn.interest.app/reels/test/master.m3u8',
      };
    }
    return {'status': 'PROCESSING'};
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  late MockReelsRepositoryForUpload mockRepo;
  late ResumableVideoUploader uploader;
  late Directory tempDir;
  late File sampleVideoFile;

  setUp(() {
    mockRepo = MockReelsRepositoryForUpload();
    uploader = ResumableVideoUploader(repository: mockRepo);
    tempDir = Directory.systemTemp.createTempSync('video_upload_test_');

    // Create a 10KB mock video file
    sampleVideoFile = File('${tempDir.path}/sample.mp4');
    sampleVideoFile.writeAsBytesSync(List.filled(10 * 1024, 0x42));
  });

  tearDown(() {
    try {
      tempDir.deleteSync(recursive: true);
    } catch (_) {}
  });

  group('Video File Validation Invariants', () {
    test('rejects non-existent file with ValidationFailure', () {
      final nonExistent = File('${tempDir.path}/does_not_exist.mp4');
      expect(
        () => uploader.validateVideoFile(nonExistent),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('rejects non-video file extension with ValidationFailure', () {
      final textFile = File('${tempDir.path}/notes.txt');
      textFile.writeAsStringSync('not a video');
      expect(
        () => uploader.validateVideoFile(textFile),
        throwsA(isA<ValidationFailure>()),
      );
    });

    test('accepts valid video formats (.mp4, .mov, .webm)', () {
      expect(() => uploader.validateVideoFile(sampleVideoFile), returnsNormally);

      final movFile = File('${tempDir.path}/sample.mov');
      movFile.writeAsBytesSync(List.filled(500, 0x11));
      expect(() => uploader.validateVideoFile(movFile), returnsNormally);
    });
  });

  group('Resumable Multipart Lifecycle', () {
    test('waitForProcessing polls until status reaches PUBLISHED', () async {
      const session = UploadSessionModel(
        reelId: 'reel-upload-test-1',
        uploadId: 'upload-id-123',
        s3Key: 'uploads/raw/test.mp4',
        filename: 'sample.mp4',
        fileSizeBytes: 10 * 1024,
        expectedParts: 1,
        status: UploadSessionStatus.processing,
      );

      final completed = await uploader.waitForProcessing(
        session,
        pollInterval: const Duration(milliseconds: 50),
      );

      expect(completed.status, UploadSessionStatus.completed);
      expect(completed.hlsMasterUrl, contains('master.m3u8'));
      expect(mockRepo.getStatusCalls, 2);
    });

    test('cancel aborts upload and invokes repository.abortMultipartUpload', () async {
      uploader.cancel();

      // Trigger upload which should detect cancellation
      final session = await uploader.uploadVideo(
        file: sampleVideoFile,
        title: 'Cancelled Test Reel',
        primaryInterestId: 'distributed-systems',
      );

      expect(session.status, UploadSessionStatus.aborted);
      expect(mockRepo.abortCalled, isTrue);
    });
  });
}
