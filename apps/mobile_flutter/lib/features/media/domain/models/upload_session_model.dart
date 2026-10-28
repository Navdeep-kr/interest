enum UploadSessionStatus {
  pending,
  uploading,
  paused,
  processing,
  completed,
  failed,
  aborted,
}

class UploadPartItem {
  final int partNumber;
  final String etag;
  final int sizeBytes;
  final bool isCompleted;

  const UploadPartItem({
    required this.partNumber,
    required this.etag,
    this.sizeBytes = 0,
    this.isCompleted = true,
  });

  Map<String, dynamic> toJson() => {
        'partNumber': partNumber,
        'etag': etag,
      };

  factory UploadPartItem.fromJson(Map<String, dynamic> json) {
    return UploadPartItem(
      partNumber: (json['partNumber'] as num?)?.toInt() ?? 1,
      etag: json['etag'] as String? ?? '',
      sizeBytes: (json['sizeBytes'] as num?)?.toInt() ?? 0,
      isCompleted: json['isCompleted'] as bool? ?? true,
    );
  }
}

class UploadSessionModel {
  final String reelId;
  final String uploadId;
  final String s3Key;
  final String filename;
  final int fileSizeBytes;
  final int expectedParts;
  final List<UploadPartItem> completedParts;
  final UploadSessionStatus status;
  final double progressPercent;
  final String? errorReason;
  final String? hlsMasterUrl;

  const UploadSessionModel({
    required this.reelId,
    required this.uploadId,
    required this.s3Key,
    required this.filename,
    required this.fileSizeBytes,
    required this.expectedParts,
    this.completedParts = const [],
    this.status = UploadSessionStatus.pending,
    this.progressPercent = 0.0,
    this.errorReason,
    this.hlsMasterUrl,
  });

  UploadSessionModel copyWith({
    String? reelId,
    String? uploadId,
    String? s3Key,
    String? filename,
    int? fileSizeBytes,
    int? expectedParts,
    List<UploadPartItem>? completedParts,
    UploadSessionStatus? status,
    double? progressPercent,
    String? errorReason,
    String? hlsMasterUrl,
  }) {
    return UploadSessionModel(
      reelId: reelId ?? this.reelId,
      uploadId: uploadId ?? this.uploadId,
      s3Key: s3Key ?? this.s3Key,
      filename: filename ?? this.filename,
      fileSizeBytes: fileSizeBytes ?? this.fileSizeBytes,
      expectedParts: expectedParts ?? this.expectedParts,
      completedParts: completedParts ?? this.completedParts,
      status: status ?? this.status,
      progressPercent: progressPercent ?? this.progressPercent,
      errorReason: errorReason ?? this.errorReason,
      hlsMasterUrl: hlsMasterUrl ?? this.hlsMasterUrl,
    );
  }
}
