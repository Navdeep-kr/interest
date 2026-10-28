import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:mobile/core/config/env_config.dart';
import '../domain/models/live_models.dart';

class LiveApiClient {
  final String baseUrl;
  final dynamic _httpClient;

  LiveApiClient({
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
  final List<Map<String, dynamic>> _mockEventsJson = [
    {
      'id': 'live-event-scale-systems-01',
      'hostId': 'user_alex_dev',
      'hostUsername': 'alex_architect',
      'hostAvatarUrl': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      'title': 'Real-Time Distributed Architecture & Live Code Review',
      'description':
          'Interactive live session breaking down circuit breakers, PostgreSQL read replicas, and backpressure.',
      'coverImageUrl': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
      'interestId': 'interest_engineering_02',
      'interestName': 'Software Engineering',
      'scheduledStartTime': '2026-10-19T10:00:00Z',
      'actualStartTime': '2026-10-19T10:02:00Z',
      'status': 'LIVE',
      'is18Plus': false,
      'recordSession': true,
      'recordingRetentionDays': 30,
      'playbackUrl': 'https://live.interest.app/hls/live-event-scale-systems-01/master.m3u8',
      'viewerCount': 1420,
      'peakViewers': 1580,
      'health': {
        'status': 'HEALTHY',
        'bitrateKbps': 4500,
        'fps': 60,
        'droppedFramePercent': 0.2,
        'jitterMs': 12,
        'lastHeartbeatAt': '2026-10-19T10:20:00Z',
      },
      'remindersCount': 380,
      'createdAt': '2026-10-18T10:00:00Z',
      'updatedAt': '2026-10-18T10:00:00Z',
    },
    {
      'id': 'live-event-sound-masterclass-02',
      'hostId': 'user_elena_sound',
      'hostUsername': 'elena_sound',
      'hostAvatarUrl': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
      'title': 'Analog Modular Synthesizer Sound Design Workshop',
      'description':
          'Hands-on patching, FM frequency modulation, and live performance improvisation.',
      'coverImageUrl': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800',
      'interestId': 'interest_audio_04',
      'interestName': 'Audio Production',
      'scheduledStartTime': '2026-10-19T18:00:00Z',
      'status': 'SCHEDULED',
      'is18Plus': true,
      'recordSession': true,
      'recordingRetentionDays': 30,
      'playbackUrl': 'https://live.interest.app/hls/live-event-sound-masterclass-02/master.m3u8',
      'viewerCount': 0,
      'peakViewers': 0,
      'health': {
        'status': 'HEALTHY',
        'bitrateKbps': 0,
        'fps': 0,
        'droppedFramePercent': 0.0,
        'jitterMs': 0,
        'lastHeartbeatAt': '',
      },
      'remindersCount': 89,
      'createdAt': '2026-10-18T14:00:00Z',
      'updatedAt': '2026-10-18T14:00:00Z',
    },
  ];

  final Map<String, List<Map<String, dynamic>>> _mockQuestionsMap = {
    'live-event-scale-systems-01': [
      {
        'id': 'q_01',
        'eventId': 'live-event-scale-systems-01',
        'userId': 'user_dev_sam',
        'username': 'sam_coder',
        'question': 'How do you prevent pool starvation during sudden traffic spikes?',
        'isApproved': true,
        'isAnswered': false,
        'isPinned': true,
        'upvotesCount': 42,
        'createdAt': '2026-10-19T10:10:00Z',
      },
      {
        'id': 'q_02',
        'eventId': 'live-event-scale-systems-01',
        'userId': 'user_dev_maria',
        'username': 'maria_sys',
        'question': 'Can circuit breakers automatically reset without manual intervention?',
        'isApproved': true,
        'isAnswered': true,
        'isPinned': false,
        'upvotesCount': 28,
        'createdAt': '2026-10-19T10:12:00Z',
      },
    ],
  };

  Future<List<LiveEventItemModel>> getEvents({String? status, String? interestId}) async {
    try {
      if (!kIsWeb && _httpClient is HttpClient) {
        final queryParams = <String, String>{};
        if (status != null) queryParams['status'] = status;
        if (interestId != null) queryParams['interestId'] = interestId;
        final uri = Uri.parse('$baseUrl/live/events').replace(queryParameters: queryParams.isEmpty ? null : queryParams);

        final request = await _httpClient.getUrl(uri);
        request.headers.set('Content-Type', 'application/json');
        final response = await request.close();
        if (response.statusCode == 200) {
          final body = await response.transform(utf8.decoder).join();
          final List<dynamic> list = jsonDecode(body) as List<dynamic>;
          return list.map((e) => LiveEventItemModel.fromJson(e as Map<String, dynamic>)).toList();
        }
      }
    } catch (_) {}

    // Mock fallback
    var list = _mockEventsJson.map((e) => LiveEventItemModel.fromJson(e)).toList();
    if (status != null) list = list.filter((e) => e.status == status).toList();
    if (interestId != null) list = list.filter((e) => e.interestId == interestId).toList();
    return list;
  }

  Future<LiveEventItemModel> getEventById(String eventId, {String? userId}) async {
    try {
      if (!kIsWeb && _httpClient is HttpClient) {
        final uri = Uri.parse('$baseUrl/live/events/$eventId');
        final request = await _httpClient.getUrl(uri);
        final response = await request.close();
        if (response.statusCode == 200) {
          final body = await response.transform(utf8.decoder).join();
          return LiveEventItemModel.fromJson(jsonDecode(body) as Map<String, dynamic>);
        }
      }
    } catch (_) {}

    final found = _mockEventsJson.firstWhere(
      (e) => e['id'] == eventId,
      orElse: () => _mockEventsJson.first,
    );
    return LiveEventItemModel.fromJson(found);
  }

  Future<Map<String, dynamic>> createEvent({
    required String title,
    required String description,
    required String interestId,
    required String interestName,
    required String scheduledStartTime,
    String? coverImageUrl,
    bool is18Plus = false,
    bool recordSession = true,
  }) async {
    try {
      if (!kIsWeb && _httpClient is HttpClient) {
        final uri = Uri.parse('$baseUrl/live/events');
        final request = await _httpClient.postUrl(uri);
        request.headers.set('Content-Type', 'application/json');
        request.write(jsonEncode({
          'title': title,
          'description': description,
          'interestId': interestId,
          'interestName': interestName,
          'scheduledStartTime': scheduledStartTime,
          'coverImageUrl': coverImageUrl,
          'is18Plus': is18Plus,
          'recordSession': recordSession,
        }));
        final response = await request.close();
        if (response.statusCode == 201) {
          final body = await response.transform(utf8.decoder).join();
          return jsonDecode(body) as Map<String, dynamic>;
        }
      }
    } catch (_) {}

    final id = 'live_${DateTime.now().millisecondsSinceEpoch}';
    final mockCreated = {
      'event': {
        'id': id,
        'hostId': 'current_user',
        'hostUsername': 'you',
        'title': title,
        'description': description,
        'interestId': interestId,
        'interestName': interestName,
        'scheduledStartTime': scheduledStartTime,
        'status': 'SCHEDULED',
        'is18Plus': is18Plus,
        'recordSession': recordSession,
        'recordingRetentionDays': 30,
        'health': {
          'status': 'HEALTHY',
          'bitrateKbps': 0,
          'fps': 0,
          'droppedFramePercent': 0.0,
          'jitterMs': 0,
          'lastHeartbeatAt': '',
        },
        'remindersCount': 0,
        'createdAt': DateTime.now().toIso8601String(),
        'updatedAt': DateTime.now().toIso8601String(),
      },
      'streamKey': 'interest_sk_demo_${DateTime.now().millisecondsSinceEpoch}',
    };
    _mockEventsJson.add(mockCreated['event'] as Map<String, dynamic>);
    return mockCreated;
  }

  Future<Map<String, dynamic>> toggleReminder(String eventId) async {
    try {
      if (!kIsWeb && _httpClient is HttpClient) {
        final uri = Uri.parse('$baseUrl/live/events/$eventId/reminder');
        final request = await _httpClient.postUrl(uri);
        final response = await request.close();
        if (response.statusCode == 200 || response.statusCode == 201) {
          final body = await response.transform(utf8.decoder).join();
          return jsonDecode(body) as Map<String, dynamic>;
        }
      }
    } catch (_) {}

    return {'isReminderSet': true, 'remindersCount': 90};
  }

  Future<List<LiveQuestionModel>> getQuestions(String eventId) async {
    try {
      if (!kIsWeb && _httpClient is HttpClient) {
        final uri = Uri.parse('$baseUrl/live/events/$eventId/questions');
        final request = await _httpClient.getUrl(uri);
        final response = await request.close();
        if (response.statusCode == 200) {
          final body = await response.transform(utf8.decoder).join();
          final List<dynamic> list = jsonDecode(body) as List<dynamic>;
          return list.map((e) => LiveQuestionModel.fromJson(e as Map<String, dynamic>)).toList();
        }
      }
    } catch (_) {}

    final list = _mockQuestionsMap[eventId] ?? [];
    return list.map((e) => LiveQuestionModel.fromJson(e)).toList();
  }

  Future<LiveQuestionModel> submitQuestion(String eventId, String question) async {
    try {
      if (!kIsWeb && _httpClient is HttpClient) {
        final uri = Uri.parse('$baseUrl/live/events/$eventId/questions');
        final request = await _httpClient.postUrl(uri);
        request.headers.set('Content-Type', 'application/json');
        request.write(jsonEncode({'question': question}));
        final response = await request.close();
        if (response.statusCode == 201) {
          final body = await response.transform(utf8.decoder).join();
          return LiveQuestionModel.fromJson(jsonDecode(body) as Map<String, dynamic>);
        }
      }
    } catch (_) {}

    final q = LiveQuestionModel(
      id: 'q_${DateTime.now().millisecondsSinceEpoch}',
      eventId: eventId,
      userId: 'current_user',
      username: 'you',
      question: question,
      isApproved: false,
      isAnswered: false,
      isPinned: false,
      upvotesCount: 1,
      hasUpvoted: true,
      createdAt: DateTime.now().toIso8601String(),
    );

    if (!_mockQuestionsMap.containsKey(eventId)) {
      _mockQuestionsMap[eventId] = [];
    }
    _mockQuestionsMap[eventId]!.add(q.toJson());
    return q;
  }

  Future<Map<String, dynamic>> upvoteQuestion(String eventId, String questionId) async {
    try {
      if (!kIsWeb && _httpClient is HttpClient) {
        final uri = Uri.parse('$baseUrl/live/events/$eventId/questions/$questionId/upvote');
        final request = await _httpClient.postUrl(uri);
        final response = await request.close();
        if (response.statusCode == 200 || response.statusCode == 201) {
          final body = await response.transform(utf8.decoder).join();
          return jsonDecode(body) as Map<String, dynamic>;
        }
      }
    } catch (_) {}

    return {'upvotesCount': 43, 'hasUpvoted': true};
  }

  Future<Map<String, dynamic>> sendReaction(String eventId, String reactionType) async {
    try {
      if (!kIsWeb && _httpClient is HttpClient) {
        final uri = Uri.parse('$baseUrl/live/events/$eventId/reaction');
        final request = await _httpClient.postUrl(uri);
        request.headers.set('Content-Type', 'application/json');
        request.write(jsonEncode({'reaction': reactionType}));
        final response = await request.close();
        if (response.statusCode == 200 || response.statusCode == 201) {
          final body = await response.transform(utf8.decoder).join();
          return jsonDecode(body) as Map<String, dynamic>;
        }
      }
    } catch (_) {}

    return {'success': true, 'throttled': false};
  }
}

extension _IterableFilter<T> on Iterable<T> {
  Iterable<T> filter(bool Function(T) test) sync* {
    for (final element in this) {
      if (test(element)) yield element;
    }
  }
}
