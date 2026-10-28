import '../domain/models/user_profile.dart';
import '../domain/models/profile_reel_item.dart';

abstract class ProfileState {
  const ProfileState();
}

class ProfileInitialState extends ProfileState {
  const ProfileInitialState();
}

class ProfileLoadingState extends ProfileState {
  final String message;
  const ProfileLoadingState({this.message = 'Loading profile...'});
}

class ProfileLoadedState extends ProfileState {
  final UserProfile profile;
  final List<ProfileReelItem> reels;
  final List<ProfileReelItem> likedReels;
  final bool isLoadingReels;
  final String selectedTab; // 'reels', 'saved', 'liked'
  final bool isFollowActionInProgress;

  const ProfileLoadedState({
    required this.profile,
    this.reels = const [],
    this.likedReels = const [],
    this.isLoadingReels = false,
    this.selectedTab = 'reels',
    this.isFollowActionInProgress = false,
  });

  ProfileLoadedState copyWith({
    UserProfile? profile,
    List<ProfileReelItem>? reels,
    List<ProfileReelItem>? likedReels,
    bool? isLoadingReels,
    String? selectedTab,
    bool? isFollowActionInProgress,
  }) {
    return ProfileLoadedState(
      profile: profile ?? this.profile,
      reels: reels ?? this.reels,
      likedReels: likedReels ?? this.likedReels,
      isLoadingReels: isLoadingReels ?? this.isLoadingReels,
      selectedTab: selectedTab ?? this.selectedTab,
      isFollowActionInProgress: isFollowActionInProgress ?? this.isFollowActionInProgress,
    );
  }
}

class ProfileErrorState extends ProfileState {
  final String message;
  final bool isPrivateGated;
  final bool isNotFound;

  const ProfileErrorState({
    required this.message,
    this.isPrivateGated = false,
    this.isNotFound = false,
  });
}
