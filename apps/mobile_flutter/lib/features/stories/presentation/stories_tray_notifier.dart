import 'package:flutter/foundation.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/stories/data/stories_repository.dart';
import 'package:mobile/features/stories/domain/models/story_models.dart';

class StoriesTrayState {
  final bool isLoading;
  final String? errorMessage;
  final List<CreatorStoryTrayModel> tray;

  const StoriesTrayState({
    this.isLoading = false,
    this.errorMessage,
    this.tray = const [],
  });

  StoriesTrayState copyWith({
    bool? isLoading,
    String? errorMessage,
    List<CreatorStoryTrayModel>? tray,
  }) {
    return StoriesTrayState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      tray: tray ?? this.tray,
    );
  }
}

class StoriesTrayNotifier extends ChangeNotifier {
  final StoriesRepository repository;

  StoriesTrayState _state = const StoriesTrayState();
  StoriesTrayState get state => _state;

  StoriesTrayNotifier({
    required this.repository,
  });

  Future<void> loadTray({String? token}) async {
    _state = _state.copyWith(isLoading: true, errorMessage: null);
    notifyListeners();

    try {
      final tray = await repository.getStoriesTray(token: token);
      _state = _state.copyWith(isLoading: false, tray: tray);
    } on Failure catch (e) {
      _state = _state.copyWith(isLoading: false, errorMessage: e.message);
    } catch (e) {
      _state = _state.copyWith(isLoading: false, errorMessage: 'Failed to load stories: $e');
    }
    notifyListeners();
  }

  Future<void> refresh({String? token}) async {
    await loadTray(token: token);
  }

  void markStoryViewed(String storyId) {
    final updatedTray = _state.tray.map((creatorTray) {
      final updatedStories = creatorTray.stories.map((s) {
        if (s.id == storyId) {
          return s.copyWith(isViewed: true, viewProgressPercent: 1.0);
        }
        return s;
      }).toList();

      final hasUnviewed = updatedStories.any((s) => !s.isViewed);
      return creatorTray.copyWith(
        stories: updatedStories,
        hasUnviewedStories: hasUnviewed,
      );
    }).toList();

    _state = _state.copyWith(tray: updatedTray);
    notifyListeners();
  }

  void removeStory(String storyId) {
    final updatedTray = _state.tray.map((creatorTray) {
      final updatedStories = creatorTray.stories.where((s) => s.id != storyId).toList();
      final hasUnviewed = updatedStories.any((s) => !s.isViewed);
      return creatorTray.copyWith(
        stories: updatedStories,
        hasUnviewedStories: hasUnviewed,
      );
    }).where((ct) => ct.stories.isNotEmpty).toList();

    _state = _state.copyWith(tray: updatedTray);
    notifyListeners();
  }
}
