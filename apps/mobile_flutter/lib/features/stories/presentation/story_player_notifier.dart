import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:mobile/features/stories/data/stories_repository.dart';
import 'package:mobile/features/stories/domain/models/story_models.dart';

class StoryPlayerState {
  final List<StoryModel> stories;
  final int currentIndex;
  final double currentProgress; // 0.0 to 1.0
  final bool isPaused;
  final bool isFinished;
  final String? errorMessage;
  final bool isReplying;

  const StoryPlayerState({
    required this.stories,
    this.currentIndex = 0,
    this.currentProgress = 0.0,
    this.isPaused = false,
    this.isFinished = false,
    this.errorMessage,
    this.isReplying = false,
  });

  StoryModel? get currentStory {
    if (stories.isEmpty || currentIndex < 0 || currentIndex >= stories.length) {
      return null;
    }
    return stories[currentIndex];
  }

  StoryPlayerState copyWith({
    List<StoryModel>? stories,
    int? currentIndex,
    double? currentProgress,
    bool? isPaused,
    bool? isFinished,
    String? errorMessage,
    bool? isReplying,
  }) {
    return StoryPlayerState(
      stories: stories ?? this.stories,
      currentIndex: currentIndex ?? this.currentIndex,
      currentProgress: currentProgress ?? this.currentProgress,
      isPaused: isPaused ?? this.isPaused,
      isFinished: isFinished ?? this.isFinished,
      errorMessage: errorMessage,
      isReplying: isReplying ?? this.isReplying,
    );
  }
}

class StoryPlayerNotifier extends ChangeNotifier {
  final StoriesRepository repository;
  final String? authToken;
  final VoidCallback? onCompletedAllStories;

  late StoryPlayerState _state;
  StoryPlayerState get state => _state;

  Timer? _progressTimer;
  static const int _timerIntervalMs = 50;

  StoryPlayerNotifier({
    required this.repository,
    required List<StoryModel> stories,
    int initialIndex = 0,
    this.authToken,
    this.onCompletedAllStories,
  }) {
    final validIndex = (initialIndex >= 0 && initialIndex < stories.length) ? initialIndex : 0;
    _state = StoryPlayerState(
      stories: stories,
      currentIndex: validIndex,
    );

    if (_state.stories.isNotEmpty) {
      _startPlayback();
    }
  }

  void _startPlayback() {
    _progressTimer?.cancel();
    final current = _state.currentStory;
    if (current == null) return;

    final durationSec = current.durationSeconds > 0 ? current.durationSeconds : 5.0;
    final totalSteps = (durationSec * 1000) / _timerIntervalMs;
    final stepIncrement = 1.0 / totalSteps;

    _progressTimer = Timer.periodic(const Duration(milliseconds: _timerIntervalMs), (timer) {
      if (_state.isPaused) return;

      final nextProgress = _state.currentProgress + stepIncrement;
      if (nextProgress >= 1.0) {
        _onStoryFinished();
      } else {
        _state = _state.copyWith(currentProgress: nextProgress);
        notifyListeners();
      }
    });
  }

  void pause() {
    if (!_state.isPaused) {
      _state = _state.copyWith(isPaused: true);
      notifyListeners();
    }
  }

  void resume() {
    if (_state.isPaused) {
      _state = _state.copyWith(isPaused: false);
      notifyListeners();
    }
  }

  void advance() {
    _onStoryFinished();
  }

  void rewind() {
    if (_state.currentProgress > 0.2 || _state.currentIndex == 0) {
      // Restart current story
      _state = _state.copyWith(currentProgress: 0.0);
      notifyListeners();
      _startPlayback();
    } else {
      // Go to previous story
      final prevIndex = _state.currentIndex - 1;
      _state = _state.copyWith(
        currentIndex: prevIndex,
        currentProgress: 0.0,
      );
      notifyListeners();
      _startPlayback();
    }
  }

  void _onStoryFinished() {
    _progressTimer?.cancel();

    final current = _state.currentStory;
    if (current != null) {
      // Record completed view
      repository.recordView(
        current.id,
        progressPercent: 1.0,
        completed: true,
        token: authToken,
      );
    }

    if (_state.currentIndex + 1 < _state.stories.length) {
      // Next story
      _state = _state.copyWith(
        currentIndex: _state.currentIndex + 1,
        currentProgress: 0.0,
      );
      notifyListeners();
      _startPlayback();
    } else {
      // Finished all stories
      _state = _state.copyWith(
        currentProgress: 1.0,
        isFinished: true,
      );
      notifyListeners();
      onCompletedAllStories?.call();
    }
  }

  Future<void> sendReaction(String emoji) async {
    final current = _state.currentStory;
    if (current == null) return;

    // Optimistic count increment
    final updatedStory = current.copyWith(reactionsCount: current.reactionsCount + 1);
    final updatedList = List<StoryModel>.from(_state.stories);
    updatedList[_state.currentIndex] = updatedStory;

    _state = _state.copyWith(stories: updatedList);
    notifyListeners();

    try {
      await repository.reactToStory(current.id, emoji, token: authToken);
    } catch (_) {
      // Non-blocking failure
    }
  }

  Future<bool> sendReply(String text) async {
    final current = _state.currentStory;
    if (current == null || current.allowReplies == StoryReplySetting.off) {
      return false;
    }

    try {
      await repository.replyToStory(current.id, text, token: authToken);
      return true;
    } catch (e) {
      _state = _state.copyWith(errorMessage: 'Could not send reply: $e');
      notifyListeners();
      return false;
    }
  }

  Future<void> reportCurrentStory(String reason, String? details) async {
    final current = _state.currentStory;
    if (current == null) return;

    await repository.reportStory(current.id, reason, details, token: authToken);

    // Remove from active list
    final remainingStories = _state.stories.where((s) => s.id != current.id).toList();
    if (remainingStories.isEmpty) {
      _state = _state.copyWith(stories: [], isFinished: true);
      notifyListeners();
      onCompletedAllStories?.call();
    } else {
      final nextIdx = _state.currentIndex >= remainingStories.length
          ? remainingStories.length - 1
          : _state.currentIndex;
      _state = _state.copyWith(
        stories: remainingStories,
        currentIndex: nextIdx,
        currentProgress: 0.0,
      );
      notifyListeners();
      _startPlayback();
    }
  }

  Future<void> deleteCurrentStory() async {
    final current = _state.currentStory;
    if (current == null) return;

    await repository.deleteStory(current.id, token: authToken);

    final remainingStories = _state.stories.where((s) => s.id != current.id).toList();
    if (remainingStories.isEmpty) {
      _state = _state.copyWith(stories: [], isFinished: true);
      notifyListeners();
      onCompletedAllStories?.call();
    } else {
      final nextIdx = _state.currentIndex >= remainingStories.length
          ? remainingStories.length - 1
          : _state.currentIndex;
      _state = _state.copyWith(
        stories: remainingStories,
        currentIndex: nextIdx,
        currentProgress: 0.0,
      );
      notifyListeners();
      _startPlayback();
    }
  }

  @override
  void dispose() {
    _progressTimer?.cancel();
    super.dispose();
  }
}
