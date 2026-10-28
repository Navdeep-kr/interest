import 'package:flutter/material.dart';
import '../data/ai_assistant_repository.dart';
import '../domain/models/ai_assistant_models.dart';

class AiAssistantNotifier extends ChangeNotifier {
  final AiAssistantRepository _repository;

  bool _isLoading = false;
  String? _error;
  AiRateLimitAndCostStatusModel? _status;
  final List<AiAssistantMessageModel> _messages = [];
  String? _currentConversationId;

  AiAssistantNotifier({required AiAssistantRepository repository})
      : _repository = repository;

  bool get isLoading => _isLoading;
  String? get error => _error;
  AiRateLimitAndCostStatusModel? get status => _status;
  List<AiAssistantMessageModel> get messages => List.unmodifiable(_messages);
  String? get currentConversationId => _currentConversationId;

  Future<void> loadInitialStatus() async {
    try {
      _status = await _repository.fetchStatus();
      notifyListeners();
    } catch (_) {}
  }

  Future<void> sendQuery(String userQueryText) async {
    final cleanText = userQueryText.trim();
    if (cleanText.isEmpty) return;

    // Append local user message
    final userMsg = AiAssistantMessageModel(
      id: 'usr_${DateTime.now().millisecondsSinceEpoch}',
      conversationId: _currentConversationId ?? '',
      role: 'user',
      content: cleanText,
      timestamp: DateTime.now().toIso8601String(),
    );
    _messages.add(userMsg);

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _repository.sendQuery(
        cleanText,
        conversationId: _currentConversationId,
        includeSummaries: true,
      );

      _currentConversationId = response.conversationId;
      _messages.add(response);

      // Refresh rate limit / cost status
      _status = await _repository.fetchStatus();
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> submitFeedback(
    String messageId,
    bool isHelpful, {
    String? category,
    String? comments,
  }) async {
    final idx = _messages.indexWhere((m) => m.id == messageId);
    if (idx != -1) {
      _messages[idx].userHelpfulFeedback = isHelpful;
      notifyListeners();
    }

    try {
      await _repository.submitFeedback(
        messageId: messageId,
        isHelpful: isHelpful,
        category: category,
        comments: comments,
      );
    } catch (_) {}
  }

  Future<void> toggleBeta(bool enrolled) async {
    try {
      final success = await _repository.enrollBeta(enrolled);
      if (success) {
        _status = await _repository.fetchStatus();
        notifyListeners();
      }
    } catch (_) {}
  }

  void clearConversation() {
    _messages.clear();
    _currentConversationId = null;
    notifyListeners();
  }
}
