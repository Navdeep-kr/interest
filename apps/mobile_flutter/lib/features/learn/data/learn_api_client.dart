import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:mobile/core/config/env_config.dart';
import '../domain/models/learn_models.dart';

class LearnApiClient {
  final String baseUrl;
  final dynamic _httpClient;

  LearnApiClient({
    String? baseUrl,
    dynamic httpClient,
  })  : baseUrl = baseUrl ?? EnvConfig.apiBaseUrl,
        _httpClient = httpClient ?? (kIsWeb ? null : _createDefaultClient()) {
    if (!kIsWeb && _httpClient is HttpClient) {
      _httpClient.connectionTimeout = const Duration(seconds: 15);
    }
  }

  static dynamic _createDefaultClient() {
    if (kIsWeb) return null;
    return HttpClient();
  }

  // Fallback in-memory dataset matching backend seed
  final List<Map<String, dynamic>> _mockPathsJson = [
    {
      'id': 'path-uiux-foundations',
      'title': 'Mobile UI/UX Design System Foundations',
      'slug': 'mobile-ui-design-foundations',
      'description':
          'Accredited professional certification covering modern mobile interface architecture, design tokens, and accessibility standards.',
      'interestId': 'interest_design_01',
      'interestName': 'UI/UX Design',
      'level': 'BEGINNER',
      'classification': 'ACCREDITED_CERTIFICATION',
      'isVerifiedCredential': true,
      'issuingOrganization': 'Interaction Design Institute & W3C Chapter',
      'verificationBadgeUrl': 'https://assets.interest.app/badges/accredited_ui.png',
      'creatorId': 'inst_interaction_design',
      'creatorName': 'Interaction Design Institute',
      'creatorAvatarUrl': 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?w=150',
      'isCreatorCurated': false,
      'prerequisitePathIds': [],
      'estimatedDurationMinutes': 90,
      'lessonCount': 3,
      'lessons': [
        {
          'id': 'lesson-ui-01',
          'pathId': 'path-uiux-foundations',
          'orderIndex': 1,
          'title': 'Design Systems & Spatial Grids',
          'description': 'Master the 8pt spatial grid, fluid layouts, and baseline alignment.',
          'contentType': 'VIDEO',
          'contentUrl': 'https://cdn.interest.app/courses/ui/lesson_01.mp4',
          'durationSeconds': 420,
          'prerequisiteLessonIds': [],
        },
        {
          'id': 'lesson-ui-02',
          'pathId': 'path-uiux-foundations',
          'orderIndex': 2,
          'title': 'Color Tokens & Contrast Compliance (WCAG 2.2)',
          'description': 'Implementing semantic dark-mode design tokens and AA/AAA contrast standards.',
          'contentType': 'ARTICLE',
          'durationSeconds': 360,
          'prerequisiteLessonIds': ['lesson-ui-01'],
        },
        {
          'id': 'lesson-ui-03',
          'pathId': 'path-uiux-foundations',
          'orderIndex': 3,
          'title': 'Micro-Interactions & Gestural Feedback',
          'description': 'Spring physics, haptic feedback triggers, and transition states.',
          'contentType': 'QUIZ',
          'durationSeconds': 300,
          'prerequisiteLessonIds': ['lesson-ui-02'],
        },
      ],
      'difficultyStats': {
        'tooEasyVotes': 4,
        'justRightVotes': 38,
        'tooHardVotes': 3,
        'averageRating': 4.8,
        'totalFeedbackCount': 45,
      },
      'rating': 4.9,
      'ratingsCount': 120,
      'enrolledCount': 342,
      'completedCount': 189,
      'isPublished': true,
    },
    {
      'id': 'path-backend-scale',
      'title': 'High-Throughput Distributed Systems & Resiliency',
      'slug': 'distributed-systems-resiliency',
      'description':
          'Advanced credential evaluating circuit breaker design, Redis read-replicas, and backpressure.',
      'interestId': 'interest_engineering_02',
      'interestName': 'Software Engineering',
      'level': 'ADVANCED',
      'classification': 'VERIFIED_CREDENTIAL',
      'isVerifiedCredential': true,
      'issuingOrganization': 'Systems Engineering Consortium',
      'verificationBadgeUrl': 'https://assets.interest.app/badges/systems_master.png',
      'creatorId': 'inst_systems_guild',
      'creatorName': 'Systems Engineering Guild',
      'creatorAvatarUrl': 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=150',
      'isCreatorCurated': false,
      'prerequisitePathIds': ['path-uiux-foundations'],
      'estimatedDurationMinutes': 140,
      'lessonCount': 2,
      'lessons': [
        {
          'id': 'lesson-scale-01',
          'pathId': 'path-backend-scale',
          'orderIndex': 1,
          'title': 'Connection Pool Sizing & PostgreSQL Sharding',
          'description': 'Tuning max connections, pool starvation prevention, and partition strategies.',
          'contentType': 'VIDEO',
          'durationSeconds': 600,
          'prerequisiteLessonIds': [],
        },
        {
          'id': 'lesson-scale-02',
          'pathId': 'path-backend-scale',
          'orderIndex': 2,
          'title': 'Circuit Breaker Pattern & Fallback Isolation',
          'description': '3-state state machine implementation, probe intervals, and dead-letter queue routing.',
          'contentType': 'PROJECT_BRIEF',
          'durationSeconds': 720,
          'prerequisiteLessonIds': ['lesson-scale-01'],
        },
      ],
      'difficultyStats': {
        'tooEasyVotes': 1,
        'justRightVotes': 24,
        'tooHardVotes': 12,
        'averageRating': 4.6,
        'totalFeedbackCount': 37,
      },
      'rating': 4.7,
      'ratingsCount': 88,
      'enrolledCount': 154,
      'completedCount': 62,
      'isPublished': true,
    },
    {
      'id': 'path-creator-cinematic',
      'title': 'Cinematic Smartphone Video & Color Grading',
      'slug': 'cinematic-smartphone-video',
      'description': 'Informal community masterclass taught by independent filmmaker Marcus Vance.',
      'interestId': 'interest_filmmaking_03',
      'interestName': 'Filmmaking',
      'level': 'INTERMEDIATE',
      'classification': 'INFORMAL_CREATOR_TIP',
      'isVerifiedCredential': false,
      'creatorId': 'user_marcus_vance',
      'creatorName': 'Marcus Vance',
      'creatorAvatarUrl': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      'isCreatorCurated': true,
      'prerequisitePathIds': [],
      'estimatedDurationMinutes': 65,
      'lessonCount': 2,
      'lessons': [
        {
          'id': 'lesson-video-01',
          'pathId': 'path-creator-cinematic',
          'orderIndex': 1,
          'title': '3-Point Mobile Lighting on a Zero Budget',
          'description': 'Using practical lamps, diffusers, and bounce cards for cinematic depth.',
          'contentType': 'VIDEO',
          'durationSeconds': 380,
          'prerequisiteLessonIds': [],
        },
        {
          'id': 'lesson-video-02',
          'pathId': 'path-creator-cinematic',
          'orderIndex': 2,
          'title': 'LUT Color Grading & Dynamic Range Tuning',
          'description': 'Creator workflow for log profile conversion and vibrant skin tone protection.',
          'contentType': 'ARTICLE',
          'durationSeconds': 450,
          'prerequisiteLessonIds': ['lesson-video-01'],
        },
      ],
      'difficultyStats': {
        'tooEasyVotes': 2,
        'justRightVotes': 45,
        'tooHardVotes': 5,
        'averageRating': 4.8,
        'totalFeedbackCount': 52,
      },
      'rating': 4.9,
      'ratingsCount': 210,
      'enrolledCount': 450,
      'completedCount': 290,
      'isPublished': true,
    },
  ];

  Future<List<SkillPathModel>> getSkillPaths({
    String? level,
    bool? isVerifiedCredential,
    String? token,
  }) async {
    if (kIsWeb || EnvConfig.mockModeEnabled || _httpClient == null) {
      var filtered = List<Map<String, dynamic>>.from(_mockPathsJson);
      if (level != null && level != 'ALL') {
        filtered = filtered.where((p) => p['level'] == level).toList();
      }
      if (isVerifiedCredential != null) {
        filtered = filtered.where((p) => p['isVerifiedCredential'] == isVerifiedCredential).toList();
      }
      return filtered.map((json) => SkillPathModel.fromJson(json)).toList();
    }

    try {
      final query = <String, String>{};
      if (level != null && level != 'ALL') query['level'] = level;
      if (isVerifiedCredential != null) query['isVerifiedCredential'] = isVerifiedCredential.toString();

      final uri = Uri.parse('$baseUrl/api/v1/learn/paths').replace(queryParameters: query);
      final req = await _httpClient.getUrl(uri);
      req.headers.set('Accept', 'application/json');
      if (token != null) req.headers.set('Authorization', 'Bearer $token');

      final res = await req.close().timeout(const Duration(seconds: 10));
      if (res.statusCode == 200) {
        final body = await res.transform(utf8.decoder).join();
        final list = jsonDecode(body) as List<dynamic>;
        return list.map((e) => SkillPathModel.fromJson(e as Map<String, dynamic>)).toList();
      }
    } catch (_) {
      // Fallback
    }

    return _mockPathsJson.map((e) => SkillPathModel.fromJson(e)).toList();
  }

  Future<Map<String, dynamic>> getPathDetails(String pathId, {String? token}) async {
    if (kIsWeb || EnvConfig.mockModeEnabled || _httpClient == null) {
      final p = _mockPathsJson.firstWhere(
        (x) => x['id'] == pathId,
        orElse: () => _mockPathsJson.first,
      );
      return {
        'path': SkillPathModel.fromJson(p),
        'prerequisitesMet': true,
        'missingPrerequisites': <String>[],
      };
    }

    try {
      final uri = Uri.parse('$baseUrl/api/v1/learn/paths/$pathId');
      final req = await _httpClient.getUrl(uri);
      if (token != null) req.headers.set('Authorization', 'Bearer $token');

      final res = await req.close().timeout(const Duration(seconds: 10));
      if (res.statusCode == 200) {
        final body = await res.transform(utf8.decoder).join();
        final data = jsonDecode(body) as Map<String, dynamic>;
        return {
          'path': SkillPathModel.fromJson(data['path'] as Map<String, dynamic>),
          'userProgress': data['userProgress'] != null
              ? UserPathProgressModel.fromJson(data['userProgress'] as Map<String, dynamic>)
              : null,
          'prerequisitesMet': data['prerequisitesMet'] as bool? ?? true,
          'missingPrerequisites': (data['missingPrerequisites'] as List<dynamic>?)
                  ?.map((e) => e.toString())
                  .toList() ??
              <String>[],
        };
      }
    } catch (_) {}

    final p = _mockPathsJson.firstWhere((x) => x['id'] == pathId, orElse: () => _mockPathsJson.first);
    return {
      'path': SkillPathModel.fromJson(p),
      'prerequisitesMet': true,
      'missingPrerequisites': <String>[],
    };
  }

  Future<Map<String, dynamic>> getResumeProgress({String? token}) async {
    final defaultPath = SkillPathModel.fromJson(_mockPathsJson[0]);
    final defaultLesson = defaultPath.lessons.first;

    if (kIsWeb || EnvConfig.mockModeEnabled || _httpClient == null) {
      return {
        'activePath': defaultPath,
        'currentLesson': defaultLesson,
        'progress': UserPathProgressModel(
          userId: 'current_user',
          pathId: defaultPath.id,
          currentLessonId: defaultLesson.id,
          completedLessonIds: [],
          percentComplete: 0,
          lastAccessedAt: DateTime.now().toIso8601String(),
        ),
      };
    }

    try {
      final uri = Uri.parse('$baseUrl/api/v1/learn/progress/resume');
      final req = await _httpClient.getUrl(uri);
      if (token != null) req.headers.set('Authorization', 'Bearer $token');

      final res = await req.close().timeout(const Duration(seconds: 10));
      if (res.statusCode == 200) {
        final body = await res.transform(utf8.decoder).join();
        final data = jsonDecode(body) as Map<String, dynamic>;
        return {
          'activePath': data['activePath'] != null ? SkillPathModel.fromJson(data['activePath']) : defaultPath,
          'currentLesson': data['currentLesson'] != null ? LessonItemModel.fromJson(data['currentLesson']) : defaultLesson,
          'progress': data['progress'] != null ? UserPathProgressModel.fromJson(data['progress']) : null,
        };
      }
    } catch (_) {}

    return {
      'activePath': defaultPath,
      'currentLesson': defaultLesson,
      'progress': null,
    };
  }

  Future<UserPathProgressModel?> recordProgress({
    required String pathId,
    required String lessonId,
    required bool completed,
    int? timeSpentSeconds,
    String? token,
  }) async {
    if (kIsWeb || EnvConfig.mockModeEnabled || _httpClient == null) {
      return UserPathProgressModel(
        userId: 'local_user',
        pathId: pathId,
        currentLessonId: lessonId,
        completedLessonIds: completed ? [lessonId] : [],
        percentComplete: completed ? 50 : 0,
        isCompleted: false,
        lastAccessedAt: DateTime.now().toIso8601String(),
        timeSpentSeconds: timeSpentSeconds ?? 120,
      );
    }

    try {
      final uri = Uri.parse('$baseUrl/api/v1/learn/progress');
      final req = await _httpClient.postUrl(uri);
      req.headers.set('Content-Type', 'application/json');
      if (token != null) req.headers.set('Authorization', 'Bearer $token');

      final payload = jsonEncode({
        'pathId': pathId,
        'lessonId': lessonId,
        'completed': completed,
        'timeSpentSeconds': timeSpentSeconds,
      });
      req.write(payload);

      final res = await req.close().timeout(const Duration(seconds: 10));
      if (res.statusCode == 200) {
        final body = await res.transform(utf8.decoder).join();
        return UserPathProgressModel.fromJson(jsonDecode(body) as Map<String, dynamic>);
      }
    } catch (_) {}

    return null;
  }

  Future<bool> submitFeedback({
    required String pathId,
    String? lessonId,
    required String feedback,
    required int ratingScore,
    String? comments,
    String? token,
  }) async {
    if (kIsWeb || EnvConfig.mockModeEnabled || _httpClient == null) {
      return true;
    }

    try {
      final uri = Uri.parse('$baseUrl/api/v1/learn/feedback');
      final req = await _httpClient.postUrl(uri);
      req.headers.set('Content-Type', 'application/json');
      if (token != null) req.headers.set('Authorization', 'Bearer $token');

      final payload = jsonEncode({
        'pathId': pathId,
        'lessonId': lessonId,
        'feedback': feedback,
        'ratingScore': ratingScore,
        'comments': comments,
      });
      req.write(payload);

      final res = await req.close().timeout(const Duration(seconds: 10));
      return res.statusCode == 201;
    } catch (_) {
      return true;
    }
  }

  Future<UserLearnReminderModel> getReminderSettings({String? token}) async {
    const fallback = UserLearnReminderModel(
      userId: 'user',
      enabled: true,
      reminderTime: '19:30',
      daysOfWeek: [1, 2, 3, 4, 5],
      channel: 'IN_APP',
      targetSkillPathTitle: 'Mobile UI/UX Design System Foundations',
    );

    if (kIsWeb || EnvConfig.mockModeEnabled || _httpClient == null) {
      return fallback;
    }

    try {
      final uri = Uri.parse('$baseUrl/api/v1/learn/reminders');
      final req = await _httpClient.getUrl(uri);
      if (token != null) req.headers.set('Authorization', 'Bearer $token');

      final res = await req.close().timeout(const Duration(seconds: 10));
      if (res.statusCode == 200) {
        final body = await res.transform(utf8.decoder).join();
        return UserLearnReminderModel.fromJson(jsonDecode(body) as Map<String, dynamic>);
      }
    } catch (_) {}

    return fallback;
  }

  Future<UserLearnReminderModel> updateReminderSettings({
    required bool enabled,
    required String reminderTime,
    required List<int> daysOfWeek,
    required String channel,
    String? targetSkillPathId,
    String? token,
  }) async {
    final updated = UserLearnReminderModel(
      userId: 'user',
      enabled: enabled,
      reminderTime: reminderTime,
      daysOfWeek: daysOfWeek,
      channel: channel,
      targetSkillPathId: targetSkillPathId,
      targetSkillPathTitle: 'Mobile UI/UX Design System Foundations',
    );

    if (kIsWeb || EnvConfig.mockModeEnabled || _httpClient == null) {
      return updated;
    }

    try {
      final uri = Uri.parse('$baseUrl/api/v1/learn/reminders');
      final req = await _httpClient.putUrl(uri);
      req.headers.set('Content-Type', 'application/json');
      if (token != null) req.headers.set('Authorization', 'Bearer $token');

      final payload = jsonEncode({
        'enabled': enabled,
        'reminderTime': reminderTime,
        'daysOfWeek': daysOfWeek,
        'channel': channel,
        'targetSkillPathId': targetSkillPathId,
      });
      req.write(payload);

      final res = await req.close().timeout(const Duration(seconds: 10));
      if (res.statusCode == 200) {
        final body = await res.transform(utf8.decoder).join();
        return UserLearnReminderModel.fromJson(jsonDecode(body) as Map<String, dynamic>);
      }
    } catch (_) {}

    return updated;
  }
}
