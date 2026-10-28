import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/reels/data/reels_repository.dart';
import 'package:mobile/features/reels/domain/models/reel_item_model.dart';
import 'package:mobile/features/reels/domain/models/comment_item_model.dart';
import 'package:mobile/features/reels/presentation/reels_state.dart';

class ReelsNotifier extends ChangeNotifier {
  final ReelsRepository repository;

  ReelsFeedState _feedState = const ReelsFeedInitialState();
  ReelsFeedState get feedState => _feedState;

  ReelDetailState _detailState = const ReelDetailLoadingState();
  ReelDetailState get detailState => _detailState;

  String? _currentInterestId;
  String _currentFeedMode = 'FOR_YOU';
  String get currentFeedMode => _currentFeedMode;
  final Set<String> _pendingActions = {};

  ReelsNotifier({required this.repository});

  void _setFeedState(ReelsFeedState state) {
    _feedState = state;
    notifyListeners();
  }

  void _setDetailState(ReelDetailState state) {
    _detailState = state;
    notifyListeners();
  }

  void clearBanner() {
    if (_feedState is ReelsFeedLoadedState) {
      _setFeedState((_feedState as ReelsFeedLoadedState).copyWith(clearBanner: true));
    }
    if (_detailState is ReelDetailLoadedState) {
      _setDetailState((_detailState as ReelDetailLoadedState).copyWith(clearBanner: true));
    }
  }

  // ==========================================================================
  // FEED OPERATIONS
  // ==========================================================================

  Future<void> loadFeed({String? interestId, String? mode, bool refresh = false}) async {
    if (mode != null) _currentFeedMode = mode;
    _currentInterestId = interestId;
    if (!refresh) {
      _setFeedState(const ReelsFeedLoadingState());
    }

    try {
      final items = await repository.getFeed(
        limit: 10,
        interestId: interestId,
        mode: _currentFeedMode,
      );

      if (items.isEmpty) {
        final emptyMsg = _currentFeedMode == 'FOLLOWING'
            ? 'No posts from creators you follow yet. Follow creators to see their content here!'
            : 'No reels found for your interests. Explore topics to build your feed.';
        _setFeedState(ReelsFeedEmptyState(message: emptyMsg));
      } else {
        final nextCursor = items.length >= 10 ? items.last.createdAt : null;
        _setFeedState(ReelsFeedLoadedState(
          items: items,
          hasMore: items.length >= 10,
          nextCursor: nextCursor,
        ));
      }
    } on Failure catch (e) {
      _setFeedState(ReelsFeedErrorState(message: e.message));
    } catch (e) {
      _setFeedState(ReelsFeedErrorState(message: 'Failed to load feed: $e'));
    }
  }

  Future<void> switchFeedMode(String mode) async {
    if (_currentFeedMode == mode && _feedState is! ReelsFeedErrorState) return;
    _currentFeedMode = mode;
    await loadFeed(interestId: _currentInterestId, mode: mode, refresh: true);
  }

  Future<void> loadMoreFeed() async {
    final current = _feedState;
    if (current is! ReelsFeedLoadedState || current.isLoadingMore || !current.hasMore) {
      return;
    }

    _setFeedState(current.copyWith(isLoadingMore: true));

    try {
      final nextItems = await repository.getFeed(
        limit: 10,
        cursor: current.nextCursor,
        interestId: _currentInterestId,
        mode: _currentFeedMode,
      );

      final combined = List<ReelItemModel>.from(current.items)..addAll(nextItems);
      final nextCursor = nextItems.length >= 10 ? nextItems.last.createdAt : null;

      _setFeedState(current.copyWith(
        items: combined,
        isLoadingMore: false,
        hasMore: nextItems.length >= 10,
        nextCursor: nextCursor,
      ));
    } catch (_) {
      _setFeedState(current.copyWith(isLoadingMore: false));
    }
  }

  /// Submits negative feedback ('NOT_INTERESTED') to tune recommendations and removes post from feed.
  Future<void> markNotInterested(String reelId, {String? interestId}) async {
    final currentFeed = _feedState;
    if (currentFeed is! ReelsFeedLoadedState) return;

    final index = currentFeed.items.indexWhere((r) => r.id == reelId);
    if (index == -1) return;

    final originalReel = currentFeed.items[index];
    final updatedList = List<ReelItemModel>.from(currentFeed.items)..removeAt(index);

    if (updatedList.isEmpty) {
      _setFeedState(const ReelsFeedEmptyState(message: 'No reels remaining in feed.'));
    } else {
      _setFeedState(currentFeed.copyWith(
        items: updatedList,
        bannerMessage: 'Recommendation updated: showing fewer posts like this.',
        isBannerError: false,
      ));
    }

    try {
      await repository.applyFeedControl(
        reelId: reelId,
        action: 'NOT_INTERESTED',
        interestId: interestId ?? originalReel.primaryInterestId,
      );
    } catch (e) {
      // Rollback on failure
      if (_feedState is ReelsFeedLoadedState) {
        final feed = _feedState as ReelsFeedLoadedState;
        final rollback = List<ReelItemModel>.from(feed.items)..insert(index, originalReel);
        _setFeedState(feed.copyWith(
          items: rollback,
          bannerMessage: 'Failed to update preferences: $e',
          isBannerError: true,
        ));
      } else if (_feedState is ReelsFeedEmptyState) {
        _setFeedState(ReelsFeedLoadedState(
          items: [originalReel],
          bannerMessage: 'Failed to update preferences: $e',
          isBannerError: true,
        ));
      }
    }
  }

  /// Resets user recommendation preferences and refreshes feed
  Future<void> resetPreferences() async {
    try {
      await repository.resetFeedPreferences();
      await loadFeed(interestId: _currentInterestId, refresh: true);
      if (_feedState is ReelsFeedLoadedState) {
        final current = _feedState as ReelsFeedLoadedState;
        _setFeedState(current.copyWith(
          bannerMessage: 'Feed recommendations and preferences have been reset.',
          isBannerError: false,
        ));
      }
    } catch (e) {
      if (_feedState is ReelsFeedLoadedState) {
        final current = _feedState as ReelsFeedLoadedState;
        _setFeedState(current.copyWith(
          bannerMessage: 'Failed to reset preferences: $e',
          isBannerError: true,
        ));
      }
    }
  }

  // ==========================================================================
  // OPTIMISTIC ENGAGEMENT WITH SERVER ROLLBACK
  // ==========================================================================

  /// Toggles like status optimistically.
  /// If the server call fails, rolls back to original state with an error banner.
  Future<void> toggleLike(String reelId) async {
    final actionKey = 'like_$reelId';
    if (_pendingActions.contains(actionKey)) return; // Prevent duplicate rapid taps
    _pendingActions.add(actionKey);

    final currentFeed = _feedState;
    ReelItemModel? originalReel;
    int reelIndex = -1;

    if (currentFeed is ReelsFeedLoadedState) {
      reelIndex = currentFeed.items.indexWhere((r) => r.id == reelId);
      if (reelIndex != -1) {
        originalReel = currentFeed.items[reelIndex];
        final nextIsLiked = !originalReel.isLiked;
        final nextLikeCount = nextIsLiked
            ? originalReel.likeCount + 1
            : max(0, originalReel.likeCount - 1);

        final updatedList = List<ReelItemModel>.from(currentFeed.items);
        updatedList[reelIndex] = originalReel.copyWith(
          isLiked: nextIsLiked,
          likeCount: nextLikeCount,
        );

        _setFeedState(currentFeed.copyWith(items: updatedList, clearBanner: true));
      }
    }

    // Also update detail state if active
    final currentDetail = _detailState;
    ReelItemModel? originalDetailReel;
    if (currentDetail is ReelDetailLoadedState && currentDetail.reel.id == reelId) {
      originalDetailReel = currentDetail.reel;
      final nextIsLiked = !originalDetailReel.isLiked;
      final nextLikeCount = nextIsLiked
          ? originalDetailReel.likeCount + 1
          : max(0, originalDetailReel.likeCount - 1);

      _setDetailState(currentDetail.copyWith(
        reel: originalDetailReel.copyWith(
          isLiked: nextIsLiked,
          likeCount: nextLikeCount,
        ),
        clearBanner: true,
      ));
    }

    try {
      final isCurrentlyLiked = originalReel?.isLiked ?? originalDetailReel?.isLiked ?? false;
      if (isCurrentlyLiked) {
        await repository.unlikeReel(reelId);
      } else {
        await repository.likeReel(reelId);
      }
    } catch (e) {
      // Rollback on failure!
      if (originalReel != null && _feedState is ReelsFeedLoadedState) {
        final feed = _feedState as ReelsFeedLoadedState;
        final rollbackList = List<ReelItemModel>.from(feed.items);
        if (reelIndex >= 0 && reelIndex < rollbackList.length) {
          rollbackList[reelIndex] = originalReel;
          _setFeedState(feed.copyWith(
            items: rollbackList,
            bannerMessage: 'Failed to update like. Please try again.',
            isBannerError: true,
          ));
        }
      }
      if (originalDetailReel != null && _detailState is ReelDetailLoadedState) {
        final detail = _detailState as ReelDetailLoadedState;
        _setDetailState(detail.copyWith(
          reel: originalDetailReel,
          bannerMessage: 'Failed to update like. Please try again.',
          isBannerError: true,
        ));
      }
    } finally {
      _pendingActions.remove(actionKey);
    }
  }

  /// Toggles save/bookmark status optimistically.
  /// If the server call fails, rolls back to original state with an error banner.
  Future<void> toggleSave(String reelId, {String? collectionId}) async {
    final actionKey = 'save_$reelId';
    if (_pendingActions.contains(actionKey)) return;
    _pendingActions.add(actionKey);

    final currentFeed = _feedState;
    ReelItemModel? originalReel;
    int reelIndex = -1;

    if (currentFeed is ReelsFeedLoadedState) {
      reelIndex = currentFeed.items.indexWhere((r) => r.id == reelId);
      if (reelIndex != -1) {
        originalReel = currentFeed.items[reelIndex];
        final nextIsSaved = !originalReel.isSaved;
        final nextSaveCount = nextIsSaved
            ? originalReel.saveCount + 1
            : max(0, originalReel.saveCount - 1);

        final updatedList = List<ReelItemModel>.from(currentFeed.items);
        updatedList[reelIndex] = originalReel.copyWith(
          isSaved: nextIsSaved,
          saveCount: nextSaveCount,
        );

        _setFeedState(currentFeed.copyWith(items: updatedList, clearBanner: true));
      }
    }

    final currentDetail = _detailState;
    ReelItemModel? originalDetailReel;
    if (currentDetail is ReelDetailLoadedState && currentDetail.reel.id == reelId) {
      originalDetailReel = currentDetail.reel;
      final nextIsSaved = !originalDetailReel.isSaved;
      final nextSaveCount = nextIsSaved
          ? originalDetailReel.saveCount + 1
          : max(0, originalDetailReel.saveCount - 1);

      _setDetailState(currentDetail.copyWith(
        reel: originalDetailReel.copyWith(
          isSaved: nextIsSaved,
          saveCount: nextSaveCount,
        ),
        clearBanner: true,
      ));
    }

    try {
      final isCurrentlySaved = originalReel?.isSaved ?? originalDetailReel?.isSaved ?? false;
      if (isCurrentlySaved) {
        await repository.unsaveReel(reelId);
      } else {
        await repository.saveReel(reelId, collectionId: collectionId);
      }
    } catch (e) {
      // Rollback on failure!
      if (originalReel != null && _feedState is ReelsFeedLoadedState) {
        final feed = _feedState as ReelsFeedLoadedState;
        final rollbackList = List<ReelItemModel>.from(feed.items);
        if (reelIndex >= 0 && reelIndex < rollbackList.length) {
          rollbackList[reelIndex] = originalReel;
          _setFeedState(feed.copyWith(
            items: rollbackList,
            bannerMessage: 'Failed to update save. Please try again.',
            isBannerError: true,
          ));
        }
      }
      if (originalDetailReel != null && _detailState is ReelDetailLoadedState) {
        final detail = _detailState as ReelDetailLoadedState;
        _setDetailState(detail.copyWith(
          reel: originalDetailReel,
          bannerMessage: 'Failed to update save. Please try again.',
          isBannerError: true,
        ));
      }
    } finally {
      _pendingActions.remove(actionKey);
    }
  }

  /// Records share and optimistically updates shareCount
  Future<void> shareReel(String reelId, {String? platform}) async {
    final currentFeed = _feedState;
    if (currentFeed is ReelsFeedLoadedState) {
      final reelIndex = currentFeed.items.indexWhere((r) => r.id == reelId);
      if (reelIndex != -1) {
        final item = currentFeed.items[reelIndex];
        final updatedList = List<ReelItemModel>.from(currentFeed.items);
        updatedList[reelIndex] = item.copyWith(shareCount: item.shareCount + 1);
        _setFeedState(currentFeed.copyWith(items: updatedList));
      }
    }

    try {
      await repository.shareReel(reelId, platform: platform);
    } catch (_) {}
  }

  /// Hides a reel immediately from the user feed with rollback on server failure.
  Future<void> hideReel(String reelId) async {
    final currentFeed = _feedState;
    if (currentFeed is! ReelsFeedLoadedState) return;

    final index = currentFeed.items.indexWhere((r) => r.id == reelId);
    if (index == -1) return;

    final originalReel = currentFeed.items[index];
    final updatedList = List<ReelItemModel>.from(currentFeed.items)..removeAt(index);

    if (updatedList.isEmpty) {
      _setFeedState(const ReelsFeedEmptyState());
    } else {
      _setFeedState(currentFeed.copyWith(
        items: updatedList,
        bannerMessage: 'Post hidden from your feed.',
        isBannerError: false,
      ));
    }

    try {
      await repository.hideReel(reelId);
    } catch (e) {
      // Rollback: re-insert post
      if (_feedState is ReelsFeedLoadedState) {
        final feed = _feedState as ReelsFeedLoadedState;
        final rollback = List<ReelItemModel>.from(feed.items)..insert(index, originalReel);
        _setFeedState(feed.copyWith(
          items: rollback,
          bannerMessage: 'Failed to hide post: $e',
          isBannerError: true,
        ));
      } else if (_feedState is ReelsFeedEmptyState) {
        _setFeedState(ReelsFeedLoadedState(
          items: [originalReel],
          bannerMessage: 'Failed to hide post: $e',
          isBannerError: true,
        ));
      }
    }
  }

  /// Pins/unpins a reel with max-3 rule validation and rollback on error
  Future<void> togglePin(String reelId) async {
    final currentFeed = _feedState;
    if (currentFeed is! ReelsFeedLoadedState) return;

    final index = currentFeed.items.indexWhere((r) => r.id == reelId);
    if (index == -1) return;

    final original = currentFeed.items[index];
    final nextIsPinned = !original.isPinned;

    if (nextIsPinned) {
      final pinnedCount = currentFeed.items.where((r) => r.isPinned).length;
      if (pinnedCount >= 3) {
        _setFeedState(currentFeed.copyWith(
          bannerMessage: 'You can pin up to 3 posts on your profile.',
          isBannerError: true,
        ));
        return;
      }
    }

    final updated = List<ReelItemModel>.from(currentFeed.items);
    updated[index] = original.copyWith(isPinned: nextIsPinned);
    _setFeedState(currentFeed.copyWith(items: updated, clearBanner: true));

    try {
      if (nextIsPinned) {
        await repository.pinReel(reelId);
      } else {
        await repository.unpinReel(reelId);
      }
    } catch (e) {
      final feed = _feedState as ReelsFeedLoadedState;
      final rollback = List<ReelItemModel>.from(feed.items);
      rollback[index] = original;
      _setFeedState(feed.copyWith(
        items: rollback,
        bannerMessage: 'Failed to update pinned status: $e',
        isBannerError: true,
      ));
    }
  }

  /// Deletes a reel and removes it from feed or marks detail as removed
  Future<void> deleteReel(String reelId) async {
    try {
      await repository.deleteReel(reelId);
      if (_feedState is ReelsFeedLoadedState) {
        final feed = _feedState as ReelsFeedLoadedState;
        final updated = List<ReelItemModel>.from(feed.items)..removeWhere((r) => r.id == reelId);
        if (updated.isEmpty) {
          _setFeedState(const ReelsFeedEmptyState());
        } else {
          _setFeedState(feed.copyWith(items: updated));
        }
      }
      if (_detailState is ReelDetailLoadedState && (_detailState as ReelDetailLoadedState).reel.id == reelId) {
        _setDetailState(const ReelDetailRemovedState());
      }
    } catch (e) {
      if (_feedState is ReelsFeedLoadedState) {
        _setFeedState((_feedState as ReelsFeedLoadedState).copyWith(
          bannerMessage: 'Failed to delete post: $e',
          isBannerError: true,
        ));
      }
    }
  }

  // ==========================================================================
  // DETAIL & COMMENTS
  // ==========================================================================

  Future<void> loadReelDetail(String reelId) async {
    _setDetailState(const ReelDetailLoadingState());

    try {
      final reel = await repository.getReelById(reelId);
      _setDetailState(ReelDetailLoadedState(reel: reel));
      loadComments(reelId);
    } on NotFoundFailure {
      _setDetailState(const ReelDetailRemovedState());
    } on Failure catch (e) {
      _setDetailState(ReelDetailErrorState(message: e.message));
    } catch (e) {
      _setDetailState(ReelDetailErrorState(message: 'Failed to load post: $e'));
    }
  }

  Future<void> loadComments(String reelId) async {
    final current = _detailState;
    if (current is! ReelDetailLoadedState) return;

    _setDetailState(current.copyWith(isLoadingComments: true));

    try {
      final comments = await repository.getComments(reelId);
      _setDetailState(current.copyWith(
        comments: comments,
        isLoadingComments: false,
      ));
    } catch (_) {
      _setDetailState(current.copyWith(isLoadingComments: false));
    }
  }

  Future<void> postComment(String reelId, String text, {String? parentId}) async {
    final current = _detailState;
    if (current is! ReelDetailLoadedState) return;

    try {
      final newComment = await repository.addComment(reelId, text: text, parentId: parentId);

      final updatedComments = List<CommentItemModel>.from(current.comments);
      if (parentId != null) {
        final pIdx = updatedComments.indexWhere((c) => c.id == parentId);
        if (pIdx != -1) {
          final parent = updatedComments[pIdx];
          final updatedReplies = List<CommentItemModel>.from(parent.replies)..add(newComment);
          updatedComments[pIdx] = parent.copyWith(
            replies: updatedReplies,
            repliesCount: parent.repliesCount + 1,
          );
        }
      } else {
        updatedComments.insert(0, newComment);
      }

      final updatedReel = current.reel.copyWith(commentCount: current.reel.commentCount + 1);

      _setDetailState(current.copyWith(
        reel: updatedReel,
        comments: updatedComments,
        bannerMessage: 'Comment posted.',
        isBannerError: false,
      ));
    } on Failure catch (e) {
      _setDetailState(current.copyWith(
        bannerMessage: 'Failed to post comment: ${e.message}',
        isBannerError: true,
      ));
    } catch (e) {
      _setDetailState(current.copyWith(
        bannerMessage: 'Failed to post comment: $e',
        isBannerError: true,
      ));
    }
  }

  Future<void> deleteComment(String reelId, String commentId) async {
    final current = _detailState;
    if (current is! ReelDetailLoadedState) return;

    try {
      await repository.deleteComment(commentId);
      final updated = List<CommentItemModel>.from(current.comments)..removeWhere((c) => c.id == commentId);
      final updatedReel = current.reel.copyWith(commentCount: max(0, current.reel.commentCount - 1));

      _setDetailState(current.copyWith(
        reel: updatedReel,
        comments: updated,
        bannerMessage: 'Comment deleted.',
        isBannerError: false,
      ));
    } catch (e) {
      _setDetailState(current.copyWith(
        bannerMessage: 'Failed to delete comment: $e',
        isBannerError: true,
      ));
    }
  }
}
