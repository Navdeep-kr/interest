import 'dart:async';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/stories/data/stories_api_client.dart';
import 'package:mobile/features/stories/domain/models/story_models.dart';

class QueuedStoryView {
  final String storyId;
  final double progressPercent;
  final bool completed;
  final DateTime timestamp;

  QueuedStoryView({
    required this.storyId,
    required this.progressPercent,
    required this.completed,
    required this.timestamp,
  });
}

class StoriesRepository {
  final StoriesApiClient _apiClient;
  
  // In-memory cache of stories tray
  List<CreatorStoryTrayModel> _cachedTray = [];
  final List<QueuedStoryView> _offlineViewQueue = [];

  StoriesRepository({
    StoriesApiClient? apiClient,
  }) : _apiClient = apiClient ?? StoriesApiClient();

  List<CreatorStoryTrayModel> get cachedTray => _cachedTray;
  List<QueuedStoryView> get offlineViewQueue => List.unmodifiable(_offlineViewQueue);

  /// Fetches stories tray, updates local cache, and purges expired stories.
  Future<List<CreatorStoryTrayModel>> getStoriesTray({String? token}) async {
    try {
      final tray = await _apiClient.getStoriesTray(token: token);
      
      // Filter out locally expired stories as a defensive safety measure
      final sanitizedTray = tray.map((creatorTray) {
        final activeStories = creatorTray.stories.where((s) => !s.isLocallyExpired).toList();
        final hasUnviewed = activeStories.any((s) => !s.isViewed);
        return creatorTray.copyWith(
          stories: activeStories,
          hasUnviewedStories: hasUnviewed,
        );
      }).where((ct) => ct.stories.isNotEmpty).toList();

      _cachedTray = sanitizedTray;

      // Sync any queued offline views if online
      if (_offlineViewQueue.isNotEmpty && token != null) {
        unawaited(flushOfflineViews(token: token));
      }

      return sanitizedTray;
    } on NetworkFailure {
      // Offline fallback: return cached tray with expired stories removed
      return _cachedTray.map((creatorTray) {
        final activeStories = creatorTray.stories.where((s) => !s.isLocallyExpired).toList();
        return creatorTray.copyWith(stories: activeStories);
      }).where((ct) => ct.stories.isNotEmpty).toList();
    }
  }

  /// Fetches stories for a specific creator.
  Future<List<StoryModel>> getCreatorStories(String creatorId, {String? token}) async {
    try {
      final stories = await _apiClient.getCreatorStories(creatorId, token: token);
      return stories.where((s) => !s.isLocallyExpired).toList();
    } on NetworkFailure {
      final cachedCreator = _cachedTray.firstWhere(
        (t) => t.creatorId == creatorId,
        orElse: () => CreatorStoryTrayModel(
          creatorId: creatorId,
          username: '',
          displayName: '',
          hasUnviewedStories: false,
          latestStoryAt: DateTime.now(),
          stories: [],
        ),
      );
      return cachedCreator.stories.where((s) => !s.isLocallyExpired).toList();
    }
  }

  /// Creates a new story.
  Future<StoryModel> createStory(CreateStoryRequest request, {String? token}) async {
    final newStory = await _apiClient.createStory(request, token: token);
    
    // Optimistically update local cache
    final existingIndex = _cachedTray.indexWhere((t) => t.creatorId == newStory.creatorId);
    if (existingIndex >= 0) {
      final current = _cachedTray[existingIndex];
      final updatedStories = [newStory, ...current.stories];
      _cachedTray[existingIndex] = current.copyWith(
        stories: updatedStories,
        hasUnviewedStories: true,
      );
    }
    
    return newStory;
  }

  /// Records viewing progress. If offline, queues the view event for sync.
  Future<void> recordView(
    String storyId, {
    required double progressPercent,
    bool? completed,
    String? token,
  }) async {
    final isDone = completed ?? (progressPercent >= 0.9);

    // Optimistically update in cache
    _updateStoryInCache(storyId, (story) {
      return story.copyWith(
        isViewed: story.isViewed || isDone,
        viewProgressPercent: progressPercent > story.viewProgressPercent ? progressPercent : story.viewProgressPercent,
      );
    });

    try {
      await _apiClient.recordView(
        storyId,
        RecordStoryViewRequest(progressPercent: progressPercent, completed: isDone),
        token: token,
      );
    } catch (_) {
      // Queue offline view
      _offlineViewQueue.add(QueuedStoryView(
        storyId: storyId,
        progressPercent: progressPercent,
        completed: isDone,
        timestamp: DateTime.now(),
      ));
    }
  }

  /// Flushes queued offline views when back online.
  Future<void> flushOfflineViews({required String token}) async {
    final queueCopy = List<QueuedStoryView>.from(_offlineViewQueue);
    for (final queued in queueCopy) {
      try {
        await _apiClient.recordView(
          queued.storyId,
          RecordStoryViewRequest(
            progressPercent: queued.progressPercent,
            completed: queued.completed,
          ),
          token: token,
        );
        _offlineViewQueue.remove(queued);
      } catch (_) {
        // Keep in queue to retry later
      }
    }
  }

  /// Reacts to a story.
  Future<void> reactToStory(String storyId, String reaction, {String? token}) async {
    _updateStoryInCache(storyId, (story) {
      return story.copyWith(reactionsCount: story.reactionsCount + 1);
    });

    await _apiClient.reactToStory(storyId, reaction, token: token);
  }

  /// Replies to a story.
  Future<void> replyToStory(String storyId, String text, {String? token}) async {
    await _apiClient.replyToStory(storyId, text, token: token);
  }

  /// Reports a story and immediately hides it from local cache.
  Future<void> reportStory(String storyId, String reason, String? details, {String? token}) async {
    _removeStoryFromCache(storyId);
    await _apiClient.reportStory(storyId, reason, details, token: token);
  }

  /// Soft-deletes a story and removes from local cache.
  Future<void> deleteStory(String storyId, {String? token}) async {
    _removeStoryFromCache(storyId);
    await _apiClient.deleteStory(storyId, token: token);
  }

  void _updateStoryInCache(String storyId, StoryModel Function(StoryModel) updater) {
    for (int i = 0; i < _cachedTray.length; i++) {
      final trayItem = _cachedTray[i];
      final storyIdx = trayItem.stories.indexWhere((s) => s.id == storyId);
      if (storyIdx >= 0) {
        final updatedList = List<StoryModel>.from(trayItem.stories);
        updatedList[storyIdx] = updater(updatedList[storyIdx]);
        final hasUnviewed = updatedList.any((s) => !s.isViewed);
        _cachedTray[i] = trayItem.copyWith(stories: updatedList, hasUnviewedStories: hasUnviewed);
        break;
      }
    }
  }

  void _removeStoryFromCache(String storyId) {
    for (int i = 0; i < _cachedTray.length; i++) {
      final trayItem = _cachedTray[i];
      final filteredStories = trayItem.stories.where((s) => s.id != storyId).toList();
      if (filteredStories.length != trayItem.stories.length) {
        if (filteredStories.isEmpty) {
          _cachedTray.removeAt(i);
        } else {
          final hasUnviewed = filteredStories.any((s) => !s.isViewed);
          _cachedTray[i] = trayItem.copyWith(stories: filteredStories, hasUnviewedStories: hasUnviewed);
        }
        break;
      }
    }
  }
}
