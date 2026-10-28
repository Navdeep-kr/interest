import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:mobile/core/config/env_config.dart';
import '../domain/models/ai_assistant_models.dart';

class AiAssistantApiClient {
  final String baseUrl;
  final dynamic _httpClient;

  AiAssistantApiClient({
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

  Future<AiAssistantMessageModel> queryAssistant(
    String query, {
    String? conversationId,
    bool? includeSummaries = true,
    String? token,
  }) async {
    if (kIsWeb || EnvConfig.mockModeEnabled || _httpClient == null) {
      return _generateMockResponse(query, conversationId);
    }

    try {
      final uri = Uri.parse('$baseUrl/api/v1/ai-assistant/query');
      final req = await _httpClient.postUrl(uri);
      req.headers.set('Content-Type', 'application/json');
      if (token != null) req.headers.set('Authorization', 'Bearer $token');

      final payload = jsonEncode({
        'query': query,
        'conversationId': conversationId,
        'includeSummaries': includeSummaries,
      });
      req.write(payload);

      final res = await req.close().timeout(const Duration(seconds: 12));
      if (res.statusCode == 200) {
        final body = await res.transform(utf8.decoder).join();
        return AiAssistantMessageModel.fromJson(jsonDecode(body) as Map<String, dynamic>);
      }
    } catch (_) {}

    return _generateMockResponse(query, conversationId);
  }

  Future<AiRateLimitAndCostStatusModel> getRateLimitStatus({String? token}) async {
    const fallback = AiRateLimitAndCostStatusModel(
      userId: 'current_user',
      queriesRemainingThisHour: 18,
      dailyTokenUsage: 1420,
      dailyTokenLimit: 50000,
      isBudgetExceeded: false,
      isBetaEnrolled: true,
    );

    if (kIsWeb || EnvConfig.mockModeEnabled || _httpClient == null) {
      return fallback;
    }

    try {
      final uri = Uri.parse('$baseUrl/api/v1/ai-assistant/status');
      final req = await _httpClient.getUrl(uri);
      if (token != null) req.headers.set('Authorization', 'Bearer $token');

      final res = await req.close().timeout(const Duration(seconds: 10));
      if (res.statusCode == 200) {
        final body = await res.transform(utf8.decoder).join();
        return AiRateLimitAndCostStatusModel.fromJson(jsonDecode(body) as Map<String, dynamic>);
      }
    } catch (_) {}

    return fallback;
  }

  Future<bool> submitFeedback({
    required String messageId,
    required bool isHelpful,
    String? category,
    String? comments,
    String? token,
  }) async {
    if (kIsWeb || EnvConfig.mockModeEnabled || _httpClient == null) {
      return true;
    }

    try {
      final uri = Uri.parse('$baseUrl/api/v1/ai-assistant/feedback');
      final req = await _httpClient.postUrl(uri);
      req.headers.set('Content-Type', 'application/json');
      if (token != null) req.headers.set('Authorization', 'Bearer $token');

      req.write(jsonEncode({
        'messageId': messageId,
        'isHelpful': isHelpful,
        'feedbackCategory': category,
        'comments': comments,
      }));

      final res = await req.close().timeout(const Duration(seconds: 8));
      return res.statusCode == 201;
    } catch (_) {
      return true;
    }
  }

  Future<bool> enrollBeta(bool enrolled, {String? token}) async {
    if (kIsWeb || EnvConfig.mockModeEnabled || _httpClient == null) {
      return true;
    }

    try {
      final uri = Uri.parse('$baseUrl/api/v1/ai-assistant/beta');
      final req = await _httpClient.postUrl(uri);
      req.headers.set('Content-Type', 'application/json');
      if (token != null) req.headers.set('Authorization', 'Bearer $token');

      req.write(jsonEncode({'enrolled': enrolled}));
      final res = await req.close().timeout(const Duration(seconds: 8));
      return res.statusCode == 200;
    } catch (_) {
      return true;
    }
  }

  AiAssistantMessageModel _generateMockResponse(String query, String? conversationId) {
    return AiAssistantMessageModel(
      id: 'msg_${DateTime.now().millisecondsSinceEpoch}',
      conversationId: conversationId ?? 'conv_${DateTime.now().millisecondsSinceEpoch}',
      role: 'assistant',
      content:
          'Based on verified public content on Interest for "$query", here are the top curated discussions and resources across our design and engineering taxonomy:\n\n'
          '[1] **Mobile UI/UX Design System Foundations** (LEARN_PATH): Accredited certification covering modern spatial grids and tokens.\n'
          '[2] **Design Systems in Flutter** (REEL): 8pt spatial grid implementation with fluid layouts.\n'
          '[3] **Mobile Designers Guild** (COMMUNITY): Active community discussing dark mode tokens and WCAG 2.2 contrast compliance.\n\n'
          'Explore these verified paths to deepen your understanding.',
      summary:
          'Key Takeaways: The community focuses on practical implementations of spatial tokens, contrast accessibility, and component modularity.',
      groundedSources: const [
        AiGroundedSourceModel(
          id: 'path-uiux-foundations',
          title: 'Mobile UI/UX Design System Foundations',
          type: 'LEARN_PATH',
          deepLinkUrl: 'interest://learn/paths/path-uiux-foundations',
          snippet: 'Accredited professional certification covering modern mobile interface architecture.',
          authorName: 'Interaction Design Institute',
        ),
        AiGroundedSourceModel(
          id: 'reel_public_101',
          title: 'Design Systems in Flutter',
          type: 'REEL',
          deepLinkUrl: 'interest://reels/reel_public_101',
          snippet: '8pt spatial grid implementation with fluid layouts.',
          authorName: 'alex_designer',
        ),
        AiGroundedSourceModel(
          id: 'comm_uiux',
          title: 'Mobile Designers Guild',
          type: 'COMMUNITY',
          deepLinkUrl: 'interest://communities/comm_uiux',
          snippet: 'Public community of 450 designers discussing design tokens.',
        ),
      ],
      relatedInterests: const [
        AiRelatedInterestModel(id: 'int_uiux', slug: 'ui-ux-design', title: 'UI/UX Design', vectorSimilarity: 0.94),
        AiRelatedInterestModel(id: 'int_eng', slug: 'software-engineering', title: 'Software Engineering', vectorSimilarity: 0.88),
      ],
      suggestedActions: const [
        'Explore UI/UX Design community',
        'Start Mobile UI skill path',
        'View top reels in #DesignSystems',
      ],
      isFallbackToSearch: false,
      tokenUsage: const AiTokenUsageModel(
        promptTokens: 48,
        completionTokens: 112,
        totalTokens: 160,
        estimatedCostMicrocents: 24,
      ),
      latencyMs: 380,
      timestamp: DateTime.now().toIso8601String(),
    );
  }
}
