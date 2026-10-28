import 'package:flutter/material.dart';

enum SnapLensType {
  normal,
  goldenHour,
  cyberpunk,
  vintageFilm,
  noir,
  pastelBloom,
}

extension SnapLensTypeExt on SnapLensType {
  String get displayName {
    switch (this) {
      case SnapLensType.normal:
        return 'Original';
      case SnapLensType.goldenHour:
        return 'Golden Hour 🌆';
      case SnapLensType.cyberpunk:
        return 'Cyberpunk ⚡';
      case SnapLensType.vintageFilm:
        return 'Vintage 90s 🎬';
      case SnapLensType.noir:
        return 'Classic Noir 🖤';
      case SnapLensType.pastelBloom:
        return 'Pastel Bloom 🌸';
    }
  }

  ColorFilter? get colorFilter {
    switch (this) {
      case SnapLensType.normal:
        return null;
      case SnapLensType.goldenHour:
        return const ColorFilter.mode(Color(0x33FFB300), BlendMode.colorBurn);
      case SnapLensType.cyberpunk:
        return const ColorFilter.mode(Color(0x4400E5FF), BlendMode.colorDodge);
      case SnapLensType.vintageFilm:
        return const ColorFilter.mode(Color(0x44795548), BlendMode.color);
      case SnapLensType.noir:
        return const ColorFilter.matrix([
          0.33, 0.33, 0.33, 0, 0,
          0.33, 0.33, 0.33, 0, 0,
          0.33, 0.33, 0.33, 0, 0,
          0,    0,    0,    1, 0,
        ]);
      case SnapLensType.pastelBloom:
        return const ColorFilter.mode(Color(0x33F48FB1), BlendMode.softLight);
    }
  }
}

class SnapStreak {
  final String conversationId;
  final String friendUsername;
  final int streakDays;
  final bool isAtRisk; // Within 2 hours of expiring (hourglass ⏳)
  final DateTime lastSnapSentAt;

  const SnapStreak({
    required this.conversationId,
    required this.friendUsername,
    required this.streakDays,
    this.isAtRisk = false,
    required this.lastSnapSentAt,
  });
}

class EphemeralSnap {
  final String id;
  final String senderUsername;
  final String? senderAvatarUrl;
  final String mediaUrl;
  final String caption;
  final SnapLensType lens;
  final double durationSeconds;
  final bool isViewOnce;
  final bool isViewed;
  final bool isReplayed;
  final DateTime sentAt;

  const EphemeralSnap({
    required this.id,
    required this.senderUsername,
    this.senderAvatarUrl,
    required this.mediaUrl,
    required this.caption,
    this.lens = SnapLensType.normal,
    this.durationSeconds = 10.0,
    this.isViewOnce = true,
    this.isViewed = false,
    this.isReplayed = false,
    required this.sentAt,
  });

  EphemeralSnap copyWith({
    bool? isViewed,
    bool? isReplayed,
  }) {
    return EphemeralSnap(
      id: id,
      senderUsername: senderUsername,
      senderAvatarUrl: senderAvatarUrl,
      mediaUrl: mediaUrl,
      caption: caption,
      lens: lens,
      durationSeconds: durationSeconds,
      isViewOnce: isViewOnce,
      isViewed: isViewed ?? this.isViewed,
      isReplayed: isReplayed ?? this.isReplayed,
      sentAt: sentAt,
    );
  }
}
