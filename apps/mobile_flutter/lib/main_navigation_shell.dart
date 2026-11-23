import 'package:flutter/material.dart';
import 'core/theme/app_colors.dart';
import 'core/storage/secure_storage_service.dart';
import 'core/config/simple_mode_manager.dart';
import 'core/localization/language_picker_sheet.dart';
import 'core/performance/data_saver_manager.dart';
import 'core/widgets/offline_banner_pill.dart';
import 'core/utils/haptic_service.dart';
import 'features/media/presentation/controllers/floating_pip_controller.dart';
import 'features/media/presentation/widgets/floating_pip_player_overlay.dart';
import 'features/media/presentation/screens/offline_vault_screen.dart';
import 'features/profile/presentation/screens/saved_collections_screen.dart';
import 'features/monetization/presentation/screens/superfans_dashboard_screen.dart';
import 'features/chat/presentation/screens/snap_camera_screen.dart';
import 'features/auth/presentation/auth_notifier.dart';
import 'features/reels/data/reels_api_client.dart';
import 'features/reels/data/reels_repository.dart';
import 'features/reels/presentation/reels_notifier.dart';
import 'features/reels/presentation/screens/feed_screen.dart';
import 'features/reels/presentation/screens/create_post_screen.dart';
import 'features/media/presentation/screens/upload_video_screen.dart';
import 'features/stories/data/stories_api_client.dart';
import 'features/stories/data/stories_repository.dart';
import 'features/stories/presentation/screens/story_composer_screen.dart';
import 'features/search/data/search_api_client.dart';
import 'features/search/data/search_repository.dart';
import 'features/search/presentation/search_notifier.dart';
import 'features/search/presentation/screens/search_screen.dart';
import 'features/communities/data/communities_api_client.dart';
import 'features/communities/data/communities_repository.dart';
import 'features/communities/presentation/screens/communities_list_screen.dart';
import 'features/chat/data/chat_api_client.dart';
import 'features/chat/data/chat_repository.dart';
import 'features/chat/presentation/chat_notifier.dart';
import 'features/chat/presentation/screens/conversations_list_screen.dart';
import 'features/profile/data/profile_api_client.dart';
import 'features/profile/data/profile_repository.dart';
import 'features/profile/presentation/profile_notifier.dart';
import 'features/profile/presentation/screens/profile_screen.dart';
import 'features/creator/presentation/screens/creator_studio_screen.dart';
import 'features/privacy/presentation/screens/privacy_and_data_settings_screen.dart';
import 'features/safety/presentation/screens/safety_center_screen.dart';
import 'features/learn/data/learn_api_client.dart';
import 'features/learn/data/learn_repository.dart';
import 'features/learn/presentation/learn_notifier.dart';
import 'features/learn/presentation/screens/learn_hub_screen.dart';
import 'features/ai_assistant/data/ai_assistant_api_client.dart';
import 'features/ai_assistant/data/ai_assistant_repository.dart';
import 'features/ai_assistant/presentation/ai_assistant_notifier.dart';
import 'features/ai_assistant/presentation/screens/ai_assistant_sheet.dart';
import 'features/live/data/live_api_client.dart';
import 'features/live/data/live_repository.dart';
import 'features/live/presentation/live_notifier.dart';
import 'features/live/presentation/screens/live_events_hub_screen.dart';
import 'features/marketplace/data/marketplace_api_client.dart';
import 'features/marketplace/data/marketplace_repository.dart';
import 'features/marketplace/presentation/marketplace_notifier.dart';
import 'features/marketplace/presentation/screens/creator_marketplace_hub_screen.dart';
import 'app.dart';

/// Central Main Navigation Shell hosting the 5 primary tabs of the Interest platform.
class MainNavigationShell extends StatefulWidget {
  final AuthNotifier authNotifier;

  const MainNavigationShell({super.key, required this.authNotifier});

  @override
  State<MainNavigationShell> createState() => _MainNavigationShellState();
}

class _MainNavigationShellState extends State<MainNavigationShell> {
  int _currentIndex = 0;

  late final SecureStorageService _storage;
  late final ReelsRepository _reelsRepository;
  late final ReelsNotifier _reelsNotifier;

  late final SearchRepository _searchRepository;
  late final SearchNotifier _searchNotifier;

  late final CommunitiesRepository _communitiesRepository;

  late final ChatRepository _chatRepository;
  late final ChatNotifier _chatNotifier;

  late final ProfileRepository _profileRepository;
  late final ProfileNotifier _profileNotifier;

  late final StoriesRepository _storiesRepository;

  late final LearnRepository _learnRepository;
  late final LearnNotifier _learnNotifier;

  late final AiAssistantRepository _aiAssistantRepository;
  late final AiAssistantNotifier _aiAssistantNotifier;

  late final LiveRepository _liveRepository;
  late final LiveNotifier _liveNotifier;

  late final MarketplaceRepository _marketplaceRepository;
  late final MarketplaceNotifier _marketplaceNotifier;

  @override
  void initState() {
    super.initState();
    _storage = PlatformSecureStorageService();

    _reelsRepository = ReelsRepository(
      apiClient: ReelsApiClient(),
      secureStorage: _storage,
    );
    _reelsNotifier = ReelsNotifier(repository: _reelsRepository);

    _searchRepository = SearchRepository(
      apiClient: SearchApiClient(),
      secureStorage: _storage,
    );
    _searchNotifier = SearchNotifier(repository: _searchRepository);

    _communitiesRepository = CommunitiesRepository(
      apiClient: CommunitiesApiClient(),
    );

    _chatRepository = ChatRepository(
      apiClient: ChatApiClient(),
      secureStorage: _storage,
    );
    _chatNotifier = ChatNotifier(repository: _chatRepository);

    _profileRepository = ProfileRepository(
      apiClient: ProfileApiClient(),
      secureStorage: _storage,
    );
    _profileNotifier = ProfileNotifier(repository: _profileRepository);

    _storiesRepository = StoriesRepository(
      apiClient: StoriesApiClient(),
    );

    _learnRepository = LearnRepository(
      apiClient: LearnApiClient(),
      storage: _storage,
    );
    _learnNotifier = LearnNotifier(repository: _learnRepository);

    _aiAssistantRepository = AiAssistantRepository(
      apiClient: AiAssistantApiClient(),
      storage: _storage,
    );
    _aiAssistantNotifier = AiAssistantNotifier(repository: _aiAssistantRepository);

    _liveRepository = LiveRepository(
      apiClient: LiveApiClient(),
      storage: _storage,
    );
    _liveNotifier = LiveNotifier(repository: _liveRepository);

    _marketplaceRepository = MarketplaceRepository(
      apiClient: MarketplaceApiClient(),
      storage: _storage,
    );
    _marketplaceNotifier = MarketplaceNotifier(repository: _marketplaceRepository);
  }

  @override
  void dispose() {
    _reelsNotifier.dispose();
    _searchNotifier.dispose();
    _chatNotifier.dispose();
    _profileNotifier.dispose();
    _learnNotifier.dispose();
    _aiAssistantNotifier.dispose();
    _liveNotifier.dispose();
    _marketplaceNotifier.dispose();
    super.dispose();
  }

  void _showCreateActionSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color: AppColors.glassBorder,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const Text(
                  'Create on Interest',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.2),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.video_call_outlined, color: AppColors.primary),
                  ),
                  title: const Text('Upload Video Reel', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                  subtitle: const Text('Resumable chunked upload with privacy sanitization', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                  onTap: () {
                    Navigator.pop(ctx);
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => UploadVideoScreen(repository: _reelsRepository),
                      ),
                    );
                  },
                ),
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.accentPink.withOpacity(0.2),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.photo_library_outlined, color: AppColors.accentPink),
                  ),
                  title: const Text('Create Photo Post', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                  subtitle: const Text('Share up to 10 photos with interest taxonomy tagging', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                  onTap: () {
                    Navigator.pop(ctx);
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => CreatePostScreen(repository: _reelsRepository),
                      ),
                    );
                  },
                ),
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.accentCyan.withOpacity(0.2),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.bolt_outlined, color: AppColors.accentCyan),
                  ),
                  title: const Text('Post 24h Story', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                  subtitle: const Text('Temporary post with server-authoritative expiry', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                  onTap: () {
                    Navigator.pop(ctx);
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => StoryComposerScreen(repository: _storiesRepository),
                      ),
                    );
                  },
                ),
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.amber.withOpacity(0.2),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.camera_alt_outlined, color: Colors.amber),
                  ),
                  title: const Text('Send Quick Snap', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                  subtitle: const Text('Snapchat-style view-once camera with creative AR lenses', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                  onTap: () {
                    Navigator.pop(ctx);
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const SnapCameraScreen(),
                      ),
                    );
                  },
                ),
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.accentRed.withOpacity(0.2),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.sensors, color: AppColors.accentRed),
                  ),
                  title: const Text('Go Live & Broadcasts', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                  subtitle: const Text('Interactive WebRTC streaming, moderated Q&A & co-hosting', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                  onTap: () {
                    Navigator.pop(ctx);
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => LiveEventsHubScreen(notifier: _liveNotifier),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      // 0: Feed / Reels
      FeedScreen(
        notifier: _reelsNotifier,
        storiesRepository: _storiesRepository,
        currentUserId: widget.authNotifier.currentUser?.id,
      ),
      // 1: Explore / Search
      SearchScreen(
        notifier: _searchNotifier,
        aiNotifier: _aiAssistantNotifier,
      ),
      // 2: Placeholder for Create (handled via onTap)
      const SizedBox.shrink(),
      // 3: Communities & Direct Chat
      CommunitiesChatHubScreen(
        communitiesRepository: _communitiesRepository,
        chatNotifier: _chatNotifier,
      ),
      // 4: Profile & Creator Tools
      ProfileHubScreen(
        profileNotifier: _profileNotifier,
        authNotifier: widget.authNotifier,
        learnNotifier: _learnNotifier,
        aiAssistantNotifier: _aiAssistantNotifier,
        liveNotifier: _liveNotifier,
        marketplaceNotifier: _marketplaceNotifier,
      ),
    ];

    return Stack(
      children: [
        Scaffold(
          backgroundColor: AppColors.background,
          body: IndexedStack(
            index: _currentIndex == 2 ? 0 : _currentIndex,
            children: screens,
          ),
          bottomNavigationBar: Container(
            decoration: const BoxDecoration(
              color: AppColors.surface,
              border: Border(top: BorderSide(color: AppColors.glassBorder, width: 0.8)),
            ),
            child: BottomNavigationBar(
              currentIndex: _currentIndex,
              backgroundColor: Colors.transparent,
              elevation: 0,
              type: BottomNavigationBarType.fixed,
              selectedItemColor: AppColors.primary,
              unselectedItemColor: AppColors.textMuted,
              selectedFontSize: 11,
              unselectedFontSize: 11,
              onTap: (index) {
                HapticService.light();
                if (index == 2) {
                  _showCreateActionSheet();
                } else {
                  setState(() => _currentIndex = index);
                }
              },
              items: [
                const BottomNavigationBarItem(
                  icon: Icon(Icons.movie_outlined),
                  activeIcon: Icon(Icons.movie),
                  label: 'Feed',
                ),
                const BottomNavigationBarItem(
                  icon: Icon(Icons.explore_outlined),
                  activeIcon: Icon(Icons.explore),
                  label: 'Explore',
                ),
                BottomNavigationBarItem(
                  icon: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      gradient: AppColors.primaryGradient,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.add, color: Colors.white, size: 20),
                  ),
                  label: 'Create',
                ),
                const BottomNavigationBarItem(
                  icon: Icon(Icons.groups_outlined),
                  activeIcon: Icon(Icons.groups),
                  label: 'Community',
                ),
                const BottomNavigationBarItem(
                  icon: Icon(Icons.person_outline),
                  activeIcon: Icon(Icons.person),
                  label: 'Profile',
                ),
              ],
            ),
          ),
        ),
        // Snaptube-grade Draggable Floating Picture-in-Picture & Audio Player Overlay (Pro Mode)
        AnimatedBuilder(
          animation: SimpleModeManager(),
          builder: (ctx, _) {
            final simple = SimpleModeManager();
            if (!simple.showFloatingPiP) return const SizedBox.shrink();
            return FloatingPiPPlayerOverlay(controller: FloatingPiPController());
          },
        ),
        // Offline & Data Saver Floating Status Indicator (Pro / Explicit Mode)
        AnimatedBuilder(
          animation: SimpleModeManager(),
          builder: (ctx, _) {
            final simple = SimpleModeManager();
            if (!simple.showAdvancedOverlays) return const SizedBox.shrink();
            return const OfflineBannerPill();
          },
        ),
      ],
    );
  }
}

/// Combined Hub for Topic Communities & Direct Conversations.
class CommunitiesChatHubScreen extends StatefulWidget {
  final CommunitiesRepository communitiesRepository;
  final ChatNotifier chatNotifier;

  const CommunitiesChatHubScreen({
    super.key,
    required this.communitiesRepository,
    required this.chatNotifier,
  });

  @override
  State<CommunitiesChatHubScreen> createState() => _CommunitiesChatHubScreenState();
}

class _CommunitiesChatHubScreenState extends State<CommunitiesChatHubScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          labelColor: Colors.white,
          unselectedLabelColor: AppColors.textMuted,
          labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
          tabs: const [
            Tab(text: 'Topic Communities'),
            Tab(text: 'Direct Messages'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          CommunitiesListScreen(repository: widget.communitiesRepository),
          ConversationsListScreen(notifier: widget.chatNotifier),
        ],
      ),
    );
  }
}

/// Profile Hub wrapping user profile, stats, and settings drawer.
class ProfileHubScreen extends StatelessWidget {
  final ProfileNotifier profileNotifier;
  final AuthNotifier authNotifier;
  final LearnNotifier? learnNotifier;
  final AiAssistantNotifier? aiAssistantNotifier;
  final LiveNotifier? liveNotifier;
  final MarketplaceNotifier? marketplaceNotifier;

  const ProfileHubScreen({
    super.key,
    required this.profileNotifier,
    required this.authNotifier,
    this.learnNotifier,
    this.aiAssistantNotifier,
    this.liveNotifier,
    this.marketplaceNotifier,
  });

  void _showSettingsMenu(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        final simpleManager = SimpleModeManager();
        return SafeArea(
          child: AnimatedBuilder(
            animation: simpleManager,
            builder: (ctx, _) {
              return SizedBox(
                height: MediaQuery.of(context).size.height * 0.75,
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 36,
                        height: 4,
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: AppColors.glassBorder,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),

                      // Dual Experience Mode Hero Card (Simple Lite vs Standard Pro)
                      Container(
                        margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: simpleManager.isSimpleMode
                              ? Colors.tealAccent.withOpacity(0.12)
                              : Colors.purpleAccent.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: simpleManager.isSimpleMode
                                ? Colors.tealAccent.withOpacity(0.6)
                                : Colors.purpleAccent.withOpacity(0.6),
                            width: 1.5,
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: simpleManager.isSimpleMode ? Colors.tealAccent : Colors.purpleAccent,
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                simpleManager.isSimpleMode ? Icons.bolt : Icons.auto_awesome,
                                color: Colors.black,
                                size: 18,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Text(
                                        simpleManager.currentModeName,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 15,
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: Colors.white12,
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          simpleManager.isSimpleMode ? 'LITE' : 'PRO',
                                          style: TextStyle(
                                            color: simpleManager.isSimpleMode ? Colors.tealAccent : Colors.purpleAccent,
                                            fontSize: 10,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    simpleManager.currentModeDescription,
                                    style: const TextStyle(color: Colors.white60, fontSize: 11),
                                  ),
                                ],
                              ),
                            ),
                            Switch(
                              value: simpleManager.isSimpleMode,
                              activeColor: Colors.tealAccent,
                              onChanged: (val) => simpleManager.setSimpleMode(val),
                            ),
                          ],
                        ),
                      ),

                      ListTile(
                        leading: const Icon(Icons.language, color: Colors.cyanAccent),
                        title: const Text('Language & Regional Formats', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        subtitle: const Text('12+ languages, RTL layout mirroring & currency conversion', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                        onTap: () {
                          Navigator.pop(ctx);
                          LanguagePickerSheet.show(context);
                        },
                      ),
                      AnimatedBuilder(
                        animation: DataSaverManager(),
                        builder: (ctx, _) {
                          final dataSaver = DataSaverManager();
                          return SwitchListTile(
                            secondary: const Icon(Icons.data_saver_on, color: Colors.tealAccent),
                            title: const Text('Data Saver (Low Bandwidth)', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                            subtitle: const Text('Downscales image/video quality to save up to 75% mobile data', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                            value: dataSaver.isDataSaverEnabled,
                            activeColor: Colors.cyanAccent,
                            onChanged: (val) => dataSaver.toggleDataSaver(val),
                          );
                        },
                      ),
                      ListTile(
                        leading: const Icon(Icons.camera_alt_outlined, color: Colors.amber),
                        title: const Text('Quick Snap Camera & Lenses', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        subtitle: const Text('Snapchat-style view-once snaps, streaks & creative AR lenses', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                        onTap: () {
                          Navigator.pop(ctx);
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const SnapCameraScreen()),
                          );
                        },
                      ),
                      ListTile(
                        leading: const Icon(Icons.bookmark_outline, color: AppColors.brandPrimary),
                        title: const Text('Saved Collections & Boards', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        subtitle: const Text('Instagram-style organized collections and saved posts', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                        onTap: () {
                          Navigator.pop(ctx);
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const SavedCollectionsScreen()),
                          );
                        },
                      ),
                      ListTile(
                        leading: const Icon(Icons.lock_person_outlined, color: AppColors.primary),
                        title: const Text('Privacy & Data Governance', style: TextStyle(color: Colors.white)),
                        subtitle: const Text('Export user data & manage account deletion', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                        onTap: () {
                          Navigator.pop(ctx);
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const PrivacyAndDataSettingsScreen(token: 'ey_web_mock_access_token_12345'),
                            ),
                          );
                        },
                      ),
                      ListTile(
                        leading: const Icon(Icons.shield_outlined, color: AppColors.success),
                        title: const Text('Safety & Moderation Center', style: TextStyle(color: Colors.white)),
                        subtitle: const Text('Content guidelines, reporting, and blocking', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                        onTap: () {
                          Navigator.pop(ctx);
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => const SafetyCenterScreen(token: 'ey_web_mock_access_token_12345'),
                            ),
                          );
                        },
                      ),

                      // PRO / ADVANCED TOOLS (Organized & hidden when in Simple Lite Mode)
                      if (simpleManager.isProMode) ...[
                        const Padding(
                          padding: EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 6),
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: Text(
                              'PRO CREATOR & ADVANCED TOOLS',
                              style: TextStyle(
                                color: Colors.purpleAccent,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1,
                              ),
                            ),
                          ),
                        ),
                        ListTile(
                          leading: const Icon(Icons.workspace_premium, color: Color(0xFFC084FC)),
                          title: const Text('Superfans Creator Studio', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          subtitle: const Text('Manage subscribers, set monthly tiers & view recurring revenue', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                          onTap: () {
                            Navigator.pop(ctx);
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => const SuperfansDashboardScreen()),
                            );
                          },
                        ),
                        ListTile(
                          leading: const Icon(Icons.download_done, color: AppColors.accentPink),
                          title: const Text('Offline Media & Secret Vault', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          subtitle: const Text('Snaptube-grade downloads, background MP3s & PIN vault', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                          onTap: () {
                            Navigator.pop(ctx);
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => const OfflineVaultScreen()),
                            );
                          },
                        ),
                        ListTile(
                          leading: const Icon(Icons.sensors, color: AppColors.accentRed),
                          title: const Text('Live Broadcasts & Events', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          subtitle: const Text('Host live sessions, manage Q&A & scheduled events', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                          onTap: () {
                            Navigator.pop(ctx);
                            if (liveNotifier != null) {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => LiveEventsHubScreen(notifier: liveNotifier!),
                                ),
                              );
                            }
                          },
                        ),
                        ListTile(
                          leading: const Icon(Icons.auto_awesome, color: AppColors.primary),
                          title: const Text('AI Interest Assistant', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          subtitle: const Text('Grounded discovery, related topics & public summaries', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                          onTap: () {
                            Navigator.pop(ctx);
                            if (aiAssistantNotifier != null) {
                              AiAssistantSheet.show(context, aiAssistantNotifier!);
                            }
                          },
                        ),
                        ListTile(
                          leading: const Icon(Icons.school_outlined, color: AppColors.accentGold),
                          title: const Text('Learn Mode & Skill Paths', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          subtitle: const Text('Accredited credentials, study tracks & creator playlists', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                          onTap: () {
                            Navigator.pop(ctx);
                            if (learnNotifier != null) {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => LearnHubScreen(notifier: learnNotifier!),
                                ),
                              );
                            }
                          },
                        ),
                        ListTile(
                          leading: const Icon(Icons.settings_system_daydream_outlined, color: AppColors.accentCyan),
                          title: const Text('Foundation & System Status', style: TextStyle(color: Colors.white)),
                          subtitle: const Text('Inspect zero-location policy & environment config', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                          onTap: () {
                            Navigator.pop(ctx);
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => FoundationHomeScreen(authNotifier: authNotifier),
                              ),
                            );
                          },
                        ),
                        ListTile(
                          leading: const Icon(Icons.analytics_outlined, color: AppColors.accentPink),
                          title: const Text('Creator Studio & Analytics', style: TextStyle(color: Colors.white)),
                          subtitle: const Text('Track verified views, watch time, and earnings', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                          onTap: () {
                            Navigator.pop(ctx);
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => const CreatorStudioScreen(),
                              ),
                            );
                          },
                        ),
                        ListTile(
                          leading: const Icon(Icons.storefront_outlined, color: AppColors.primary),
                          title: const Text('Creator Marketplace & Briefs', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          subtitle: const Text('Browse verified brand campaigns, pitch rates & deliverables', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                          onTap: () {
                            Navigator.pop(ctx);
                            if (marketplaceNotifier != null) {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => CreatorMarketplaceHubScreen(notifier: marketplaceNotifier!),
                                ),
                              );
                            }
                          },
                        ),
                      ],

                      const Divider(color: AppColors.glassBorder),
                      ListTile(
                        leading: const Icon(Icons.logout, color: AppColors.error),
                        title: const Text('Sign Out', style: TextStyle(color: AppColors.error, fontWeight: FontWeight.bold)),
                        onTap: () {
                          Navigator.pop(ctx);
                          authNotifier.logout();
                        },
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final username = authNotifier.currentUser?.username ?? 'interest_creator';
    final simpleManager = SimpleModeManager();

    return AnimatedBuilder(
      animation: simpleManager,
      builder: (context, _) {
        return Scaffold(
          backgroundColor: AppColors.background,
          appBar: AppBar(
            backgroundColor: AppColors.surface,
            elevation: 0,
            title: Text(
              '@$username',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17, color: Colors.white),
            ),
            actions: [
              // 1-Tap Experience Mode Toggle Pill
              Center(
                child: Padding(
                  padding: const EdgeInsets.only(right: 6.0),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(20),
                    onTap: () {
                      simpleManager.toggleSimpleMode();
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('Switched to ${simpleManager.currentModeName} (${simpleManager.isSimpleMode ? "Minimalist" : "Pro"})'),
                          duration: const Duration(seconds: 2),
                        ),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: simpleManager.isSimpleMode
                            ? Colors.tealAccent.withOpacity(0.15)
                            : Colors.purpleAccent.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: simpleManager.isSimpleMode ? Colors.tealAccent : Colors.purpleAccent,
                          width: 1.2,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            simpleManager.isSimpleMode ? Icons.bolt : Icons.auto_awesome,
                            color: simpleManager.isSimpleMode ? Colors.tealAccent : Colors.purpleAccent,
                            size: 14,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            simpleManager.isSimpleMode ? 'Lite' : 'Pro',
                            style: TextStyle(
                              color: simpleManager.isSimpleMode ? Colors.tealAccent : Colors.purpleAccent,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              if (simpleManager.isProMode) ...[
                if (liveNotifier != null)
                  IconButton(
                    icon: const Icon(Icons.sensors, color: AppColors.accentRed),
                    tooltip: 'Live & Events',
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => LiveEventsHubScreen(notifier: liveNotifier!),
                        ),
                      );
                    },
                  ),
                if (learnNotifier != null)
                  IconButton(
                    icon: const Icon(Icons.school, color: AppColors.accentGold),
                    tooltip: 'Learn Mode',
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => LearnHubScreen(notifier: learnNotifier!),
                        ),
                      );
                    },
                  ),
                IconButton(
                  icon: const Icon(Icons.download_done, color: AppColors.accentPink),
                  tooltip: 'Offline Media & Vault',
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const OfflineVaultScreen()),
                    );
                  },
                ),
              ],
              IconButton(
                icon: const Icon(Icons.menu, color: Colors.white),
                tooltip: 'Settings & Tools',
                onPressed: () => _showSettingsMenu(context),
              ),
            ],
          ),
          body: ProfileScreen(
            notifier: profileNotifier,
            identifier: username,
            isMe: true,
          ),
        );
      },
    );
  }
}
