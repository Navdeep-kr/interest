import 'package:flutter/foundation.dart';
import '../domain/models/live_models.dart';
import '../data/live_repository.dart';

class FloatingReaction {
  final String id;
  final String type;
  final double xOffset; // 0.0 to 1.0
  final DateTime createdAt;

  FloatingReaction({
    required this.id,
    required this.type,
    required this.xOffset,
    required this.createdAt,
  });
}

class LiveState {
  final bool isLoading;
  final String? errorMessage;
  final List<LiveEventItemModel> liveNowEvents;
  final List<LiveEventItemModel> scheduledEvents;
  final LiveEventItemModel? selectedEvent;
  final List<LiveQuestionModel> questions;
  final List<FloatingReaction> floatingReactions;
  final String? createdStreamKey;

  const LiveState({
    this.isLoading = false,
    this.errorMessage,
    this.liveNowEvents = const [],
    this.scheduledEvents = const [],
    this.selectedEvent,
    this.questions = const [],
    this.floatingReactions = const [],
    this.createdStreamKey,
  });

  LiveState copyWith({
    bool? isLoading,
    String? errorMessage,
    List<LiveEventItemModel>? liveNowEvents,
    List<LiveEventItemModel>? scheduledEvents,
    LiveEventItemModel? selectedEvent,
    List<LiveQuestionModel>? questions,
    List<FloatingReaction>? floatingReactions,
    String? createdStreamKey,
  }) {
    return LiveState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      liveNowEvents: liveNowEvents ?? this.liveNowEvents,
      scheduledEvents: scheduledEvents ?? this.scheduledEvents,
      selectedEvent: selectedEvent ?? this.selectedEvent,
      questions: questions ?? this.questions,
      floatingReactions: floatingReactions ?? this.floatingReactions,
      createdStreamKey: createdStreamKey ?? this.createdStreamKey,
    );
  }
}

class LiveNotifier extends ChangeNotifier {
  final LiveRepository _repository;
  LiveState _state = const LiveState();

  LiveNotifier({LiveRepository? repository})
      : _repository = repository ?? LiveRepository();

  LiveState get state => _state;

  Future<void> loadEvents() async {
    _state = _state.copyWith(isLoading: true, errorMessage: null);
    notifyListeners();

    try {
      final allEvents = await _repository.fetchEvents();
      final liveNow = allEvents.where((e) => e.status == 'LIVE').toList();
      final scheduled = allEvents.where((e) => e.status == 'SCHEDULED').toList();

      _state = _state.copyWith(
        isLoading: false,
        liveNowEvents: liveNow,
        scheduledEvents: scheduled,
      );
    } catch (e) {
      _state = _state.copyWith(
        isLoading: false,
        errorMessage: 'Unable to load live events. Please try again.',
      );
    }
    notifyListeners();
  }

  Future<void> selectEvent(String eventId) async {
    _state = _state.copyWith(isLoading: true);
    notifyListeners();

    try {
      final event = await _repository.fetchEventById(eventId);
      final questions = await _repository.fetchQuestions(eventId);

      _state = _state.copyWith(
        isLoading: false,
        selectedEvent: event,
        questions: questions,
      );
    } catch (e) {
      _state = _state.copyWith(
        isLoading: false,
        errorMessage: 'Failed to load event details.',
      );
    }
    notifyListeners();
  }

  Future<void> toggleReminder(String eventId) async {
    // Optimistic toggle
    final scheduled = _state.scheduledEvents.map((e) {
      if (e.id == eventId) {
        final newIsReminderSet = !e.isReminderSet;
        final newCount = newIsReminderSet ? e.remindersCount + 1 : (e.remindersCount > 0 ? e.remindersCount - 1 : 0);
        return e.copyWith(isReminderSet: newIsReminderSet, remindersCount: newCount);
      }
      return e;
    }).toList();

    LiveEventItemModel? sel = _state.selectedEvent;
    if (sel != null && sel.id == eventId) {
      final newIsReminderSet = !sel.isReminderSet;
      final newCount = newIsReminderSet ? sel.remindersCount + 1 : (sel.remindersCount > 0 ? sel.remindersCount - 1 : 0);
      sel = sel.copyWith(isReminderSet: newIsReminderSet, remindersCount: newCount);
    }

    _state = _state.copyWith(scheduledEvents: scheduled, selectedEvent: sel);
    notifyListeners();

    try {
      await _repository.toggleReminder(eventId);
    } catch (_) {}
  }

  Future<void> submitQuestion(String eventId, String questionText) async {
    try {
      final q = await _repository.submitQuestion(eventId, questionText);
      _state = _state.copyWith(questions: [..._state.questions, q]);
      notifyListeners();
    } catch (e) {
      _state = _state.copyWith(errorMessage: 'Unable to submit question.');
      notifyListeners();
    }
  }

  Future<void> upvoteQuestion(String eventId, String questionId) async {
    final updatedList = _state.questions.map((q) {
      if (q.id == questionId) {
        final newHasUpvoted = !q.hasUpvoted;
        final newCount = newHasUpvoted ? q.upvotesCount + 1 : (q.upvotesCount > 0 ? q.upvotesCount - 1 : 0);
        return q.copyWith(hasUpvoted: newHasUpvoted, upvotesCount: newCount);
      }
      return q;
    }).toList();

    _state = _state.copyWith(questions: updatedList);
    notifyListeners();

    try {
      await _repository.upvoteQuestion(eventId, questionId);
    } catch (_) {}
  }

  Future<void> sendReaction(String eventId, String reactionType) async {
    // Add floating reaction with pseudo-random offset
    final reaction = FloatingReaction(
      id: 'reaction_${DateTime.now().millisecondsSinceEpoch}_${_state.floatingReactions.length}',
      type: reactionType,
      xOffset: (DateTime.now().millisecond % 80) / 100.0,
      createdAt: DateTime.now(),
    );

    final currentReactions = [..._state.floatingReactions, reaction];
    // Keep max 20 reactions in floating queue
    if (currentReactions.length > 20) {
      currentReactions.removeAt(0);
    }

    _state = _state.copyWith(floatingReactions: currentReactions);
    notifyListeners();

    try {
      await _repository.sendReaction(eventId, reactionType);
    } catch (_) {}
  }

  Future<bool> createEvent({
    required String title,
    required String description,
    required String interestId,
    required String interestName,
    required String scheduledStartTime,
    String? coverImageUrl,
    bool is18Plus = false,
    bool recordSession = true,
  }) async {
    _state = _state.copyWith(isLoading: true, errorMessage: null);
    notifyListeners();

    try {
      final result = await _repository.createEvent(
        title: title,
        description: description,
        interestId: interestId,
        interestName: interestName,
        scheduledStartTime: scheduledStartTime,
        coverImageUrl: coverImageUrl,
        is18Plus: is18Plus,
        recordSession: recordSession,
      );

      final event = LiveEventItemModel.fromJson(result['event'] as Map<String, dynamic>);
      final streamKey = result['streamKey'] as String?;

      _state = _state.copyWith(
        isLoading: false,
        scheduledEvents: [event, ..._state.scheduledEvents],
        createdStreamKey: streamKey,
      );
      notifyListeners();
      return true;
    } catch (e) {
      _state = _state.copyWith(
        isLoading: false,
        errorMessage: 'Failed to schedule live event: ${e.toString()}',
      );
      notifyListeners();
      return false;
    }
  }

  void clearCreatedStreamKey() {
    _state = _state.copyWith(createdStreamKey: null);
    notifyListeners();
  }
}
