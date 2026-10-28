enum OfflineMediaFormat {
  video1080p,
  video720p,
  video480p,
  audioMp3,
}

extension OfflineMediaFormatExt on OfflineMediaFormat {
  String get label {
    switch (this) {
      case OfflineMediaFormat.video1080p:
        return '1080p Full HD (MP4)';
      case OfflineMediaFormat.video720p:
        return '720p HD (MP4)';
      case OfflineMediaFormat.video480p:
        return '480p Standard (MP4)';
      case OfflineMediaFormat.audioMp3:
        return 'Extract Audio (MP3 320kbps)';
    }
  }

  String get shortTag {
    switch (this) {
      case OfflineMediaFormat.video1080p:
        return '1080p';
      case OfflineMediaFormat.video720p:
        return '720p';
      case OfflineMediaFormat.video480p:
        return '480p';
      case OfflineMediaFormat.audioMp3:
        return 'MP3';
    }
  }

  bool get isAudio => this == OfflineMediaFormat.audioMp3;
}

class OfflineMediaItem {
  final String id;
  final String originalReelId;
  final String title;
  final String creatorUsername;
  final String? creatorAvatarUrl;
  final String mediaUrl;
  final String thumbnailUrl;
  final OfflineMediaFormat format;
  final int fileSizeBytes;
  final double durationSeconds;
  final double progress; // 0.0 to 1.0
  final bool isCompleted;
  final bool isVaulted; // Hidden in PIN protected vault
  final DateTime downloadedAt;

  const OfflineMediaItem({
    required this.id,
    required this.originalReelId,
    required this.title,
    required this.creatorUsername,
    this.creatorAvatarUrl,
    required this.mediaUrl,
    required this.thumbnailUrl,
    required this.format,
    required this.fileSizeBytes,
    required this.durationSeconds,
    this.progress = 1.0,
    this.isCompleted = true,
    this.isVaulted = false,
    required this.downloadedAt,
  });

  String get formattedFileSize {
    if (fileSizeBytes >= 1024 * 1024) {
      return '${(fileSizeBytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return '${(fileSizeBytes / 1024).toStringAsFixed(0)} KB';
  }

  String get formattedDuration {
    final minutes = (durationSeconds / 60).floor();
    final seconds = (durationSeconds % 60).floor();
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  OfflineMediaItem copyWith({
    String? id,
    String? originalReelId,
    String? title,
    String? creatorUsername,
    String? creatorAvatarUrl,
    String? mediaUrl,
    String? thumbnailUrl,
    OfflineMediaFormat? format,
    int? fileSizeBytes,
    double? durationSeconds,
    double? progress,
    bool? isCompleted,
    bool? isVaulted,
    DateTime? downloadedAt,
  }) {
    return OfflineMediaItem(
      id: id ?? this.id,
      originalReelId: originalReelId ?? this.originalReelId,
      title: title ?? this.title,
      creatorUsername: creatorUsername ?? this.creatorUsername,
      creatorAvatarUrl: creatorAvatarUrl ?? this.creatorAvatarUrl,
      mediaUrl: mediaUrl ?? this.mediaUrl,
      thumbnailUrl: thumbnailUrl ?? this.thumbnailUrl,
      format: format ?? this.format,
      fileSizeBytes: fileSizeBytes ?? this.fileSizeBytes,
      durationSeconds: durationSeconds ?? this.durationSeconds,
      progress: progress ?? this.progress,
      isCompleted: isCompleted ?? this.isCompleted,
      isVaulted: isVaulted ?? this.isVaulted,
      downloadedAt: downloadedAt ?? this.downloadedAt,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'originalReelId': originalReelId,
    'title': title,
    'creatorUsername': creatorUsername,
    'creatorAvatarUrl': creatorAvatarUrl,
    'mediaUrl': mediaUrl,
    'thumbnailUrl': thumbnailUrl,
    'format': format.name,
    'fileSizeBytes': fileSizeBytes,
    'durationSeconds': durationSeconds,
    'progress': progress,
    'isCompleted': isCompleted,
    'isVaulted': isVaulted,
    'downloadedAt': downloadedAt.toIso8601String(),
  };

  factory OfflineMediaItem.fromJson(Map<String, dynamic> json) {
    return OfflineMediaItem(
      id: json['id'] as String? ?? '',
      originalReelId: json['originalReelId'] as String? ?? '',
      title: json['title'] as String? ?? 'Downloaded Video',
      creatorUsername: json['creatorUsername'] as String? ?? 'creator',
      creatorAvatarUrl: json['creatorAvatarUrl'] as String?,
      mediaUrl: json['mediaUrl'] as String? ?? '',
      thumbnailUrl: json['thumbnailUrl'] as String? ?? '',
      format: OfflineMediaFormat.values.firstWhere(
        (f) => f.name == json['format'],
        orElse: () => OfflineMediaFormat.video720p,
      ),
      fileSizeBytes: (json['fileSizeBytes'] as num?)?.toInt() ?? 1024 * 1024 * 5,
      durationSeconds: (json['durationSeconds'] as num?)?.toDouble() ?? 15.0,
      progress: (json['progress'] as num?)?.toDouble() ?? 1.0,
      isCompleted: json['isCompleted'] as bool? ?? true,
      isVaulted: json['isVaulted'] as bool? ?? false,
      downloadedAt: DateTime.tryParse(json['downloadedAt'] as String? ?? '') ?? DateTime.now(),
    );
  }
}
