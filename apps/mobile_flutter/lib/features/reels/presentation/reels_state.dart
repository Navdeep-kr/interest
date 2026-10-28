import 'package:mobile/features/reels/domain/models/reel_item_model.dart';
import 'package:mobile/features/reels/domain/models/comment_item_model.dart';

abstract class ReelsFeedState {
  const ReelsFeedState();
}

class ReelsFeedInitialState extends ReelsFeedState {
  const ReelsFeedInitialState();
}

class ReelsFeedLoadingState extends ReelsFeedState {
  const ReelsFeedLoadingState();
}

class ReelsFeedEmptyState extends ReelsFeedState {
  final String message;
  const ReelsFeedEmptyState({this.message = 'No reels found for this interest tag.'});
}

class ReelsFeedLoadedState extends ReelsFeedState {
  final List<ReelItemModel> items;
  final bool isLoadingMore;
  final bool hasMore;
  final String? nextCursor;
  final String? bannerMessage;
  final bool isBannerError;

  const ReelsFeedLoadedState({
    required this.items,
    this.isLoadingMore = false,
    this.hasMore = true,
    this.nextCursor,
    this.bannerMessage,
    this.isBannerError = false,
  });

  ReelsFeedLoadedState copyWith({
    List<ReelItemModel>? items,
    bool? isLoadingMore,
    bool? hasMore,
    String? nextCursor,
    String? bannerMessage,
    bool? isBannerError,
    bool clearBanner = false,
  }) {
    return ReelsFeedLoadedState(
      items: items ?? this.items,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      hasMore: hasMore ?? this.hasMore,
      nextCursor: nextCursor ?? this.nextCursor,
      bannerMessage: clearBanner ? null : (bannerMessage ?? this.bannerMessage),
      isBannerError: clearBanner ? false : (isBannerError ?? this.isBannerError),
    );
  }
}

class ReelsFeedErrorState extends ReelsFeedState {
  final String message;
  const ReelsFeedErrorState({required this.message});
}

// ---------------------------------------------------------------------------
// Reel Detail State
// ---------------------------------------------------------------------------

abstract class ReelDetailState {
  const ReelDetailState();
}

class ReelDetailLoadingState extends ReelDetailState {
  const ReelDetailLoadingState();
}

class ReelDetailLoadedState extends ReelDetailState {
  final ReelItemModel reel;
  final List<CommentItemModel> comments;
  final bool isLoadingComments;
  final String? bannerMessage;
  final bool isBannerError;

  const ReelDetailLoadedState({
    required this.reel,
    this.comments = const [],
    this.isLoadingComments = false,
    this.bannerMessage,
    this.isBannerError = false,
  });

  ReelDetailLoadedState copyWith({
    ReelItemModel? reel,
    List<CommentItemModel>? comments,
    bool? isLoadingComments,
    String? bannerMessage,
    bool? isBannerError,
    bool clearBanner = false,
  }) {
    return ReelDetailLoadedState(
      reel: reel ?? this.reel,
      comments: comments ?? this.comments,
      isLoadingComments: isLoadingComments ?? this.isLoadingComments,
      bannerMessage: clearBanner ? null : (bannerMessage ?? this.bannerMessage),
      isBannerError: clearBanner ? false : (isBannerError ?? this.isBannerError),
    );
  }
}

class ReelDetailRemovedState extends ReelDetailState {
  final String message;
  const ReelDetailRemovedState({this.message = 'This post has been removed or is unavailable.'});
}

class ReelDetailErrorState extends ReelDetailState {
  final String message;
  const ReelDetailErrorState({required this.message});
}
