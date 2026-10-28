import 'package:flutter/foundation.dart';
import '../../../core/error/failures.dart';
import '../data/profile_repository.dart';
import '../domain/models/user_profile.dart';
import '../domain/models/profile_reel_item.dart';
import 'profile_state.dart';

class ProfileNotifier extends ChangeNotifier {
  final ProfileRepository repository;

  ProfileState _state = const ProfileInitialState();
  ProfileState get state => _state;

  String? _currentIdentifier;
  bool _isMe = false;

  ProfileNotifier({required this.repository});

  void _setState(ProfileState newState) {
    _state = newState;
    notifyListeners();
  }

  /// Loads profile and its reels tab content
  Future<void> loadProfile(String identifier, {bool isMe = false}) async {
    _currentIdentifier = identifier;
    _isMe = isMe;
    _setState(const ProfileLoadingState());

    try {
      final UserProfile profile;
      if (isMe) {
        profile = await repository.getMyProfile();
      } else {
        profile = await repository.getProfile(identifier);
      }

      List<ProfileReelItem> reels = [];
      // If account is public or viewer is owner or viewer is approved follower, fetch reels
      if (!profile.isPrivate || isMe || profile.isFollowing) {
        try {
          reels = await repository.getProfileReels(profile.id);
        } catch (_) {
          // Soft failure on reels tab content
        }
      }

      _setState(ProfileLoadedState(
        profile: profile,
        reels: reels,
        selectedTab: 'reels',
      ));
    } on NotFoundFailure catch (e) {
      _setState(ProfileErrorState(
        message: e.message,
        isNotFound: true,
      ));
    } on AuthorizationFailure catch (e) {
      _setState(ProfileErrorState(
        message: e.message,
        isPrivateGated: true,
      ));
    } on Failure catch (e) {
      _setState(ProfileErrorState(message: e.message));
    } catch (e) {
      _setState(ProfileErrorState(message: 'Failed to load profile: $e'));
    }
  }

  /// Refreshes current profile view
  Future<void> refresh() async {
    if (_currentIdentifier != null) {
      await loadProfile(_currentIdentifier!, isMe: _isMe);
    }
  }

  /// Updates profile information (bio, display name, privacy settings, links)
  Future<bool> updateProfile(Map<String, dynamic> data) async {
    if (_state is! ProfileLoadedState) return false;
    final currentState = _state as ProfileLoadedState;

    try {
      final updated = await repository.updateProfile(data);
      _setState(currentState.copyWith(profile: updated));
      return true;
    } on Failure {
      // Revert with error notification
      notifyListeners();
      rethrow;
    } catch (e) {
      throw ServerFailure(message: 'Failed to update profile: $e');
    }
  }

  /// Toggles follow relationship or follow request
  Future<void> toggleFollow() async {
    if (_state is! ProfileLoadedState) return;
    final currentState = _state as ProfileLoadedState;
    final profile = currentState.profile;

    if (currentState.isFollowActionInProgress) return;
    _setState(currentState.copyWith(isFollowActionInProgress: true));

    try {
      if (profile.isFollowing) {
        // Unfollow
        await repository.unfollowUser(profile.id);
        final newFollowerCount = profile.followersCount > 0 ? profile.followersCount - 1 : 0;
        final updatedProfile = profile.copyWith(
          isFollowing: false,
          isMutual: false,
          followersCount: newFollowerCount,
        );
        _setState(currentState.copyWith(
          profile: updatedProfile,
          isFollowActionInProgress: false,
        ));
      } else if (profile.hasPendingRequest) {
        // Cancel pending follow request
        await repository.cancelFollowRequest(profile.id);
        final updatedProfile = profile.copyWith(
          hasPendingRequest: false,
        );
        _setState(currentState.copyWith(
          profile: updatedProfile,
          isFollowActionInProgress: false,
        ));
      } else {
        // Follow / Request
        final res = await repository.followUser(profile.id);
        final isRequested = res['requested'] == true;
        final isNowFollowing = res['following'] == true;
        final isMutual = res['isMutual'] == true;

        final newFollowerCount = isNowFollowing
            ? profile.followersCount + 1
            : profile.followersCount;

        final updatedProfile = profile.copyWith(
          isFollowing: isNowFollowing,
          hasPendingRequest: isRequested,
          isMutual: isMutual,
          followersCount: newFollowerCount,
        );

        // If newly followed and account was private, load reels
        List<ProfileReelItem> reels = currentState.reels;
        if (isNowFollowing && reels.isEmpty) {
          try {
            reels = await repository.getProfileReels(profile.id);
          } catch (_) {}
        }

        _setState(currentState.copyWith(
          profile: updatedProfile,
          reels: reels,
          isFollowActionInProgress: false,
        ));
      }
    } catch (e) {
      _setState(currentState.copyWith(isFollowActionInProgress: false));
      rethrow;
    }
  }

  /// Toggles safety restriction on the target user
  Future<void> toggleRestrict() async {
    if (_state is! ProfileLoadedState) return;
    final currentState = _state as ProfileLoadedState;
    final profile = currentState.profile;

    try {
      if (profile.isRestricted) {
        await repository.unrestrictUser(profile.id);
        _setState(currentState.copyWith(
          profile: profile.copyWith(isRestricted: false),
        ));
      } else {
        await repository.restrictUser(profile.id);
        _setState(currentState.copyWith(
          profile: profile.copyWith(isRestricted: true),
        ));
      }
    } catch (_) {
      rethrow;
    }
  }

  /// Switches content tab (reels, saved, liked)
  Future<void> switchTab(String tab) async {
    if (_state is! ProfileLoadedState) return;
    final currentState = _state as ProfileLoadedState;
    if (currentState.selectedTab == tab) return;

    _setState(currentState.copyWith(selectedTab: tab));

    if (tab == 'liked' && currentState.likedReels.isEmpty && _isMe) {
      _setState(currentState.copyWith(isLoadingReels: true));
      try {
        final liked = await repository.getProfileLikedReels(currentState.profile.id);
        _setState(currentState.copyWith(
          likedReels: liked,
          isLoadingReels: false,
        ));
      } catch (_) {
        _setState(currentState.copyWith(isLoadingReels: false));
      }
    }
  }
}
