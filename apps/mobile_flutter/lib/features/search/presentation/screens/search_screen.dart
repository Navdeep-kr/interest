import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/search/domain/models/search_models.dart';
import 'package:mobile/features/search/presentation/search_notifier.dart';
import 'package:mobile/features/search/presentation/search_state.dart';
import 'package:mobile/features/search/presentation/screens/topic_page_screen.dart';
import 'package:mobile/features/ai_assistant/presentation/ai_assistant_notifier.dart';
import 'package:mobile/features/ai_assistant/presentation/screens/ai_assistant_sheet.dart';

class SearchScreen extends StatefulWidget {
  final SearchNotifier notifier;
  final AiAssistantNotifier? aiNotifier;

  const SearchScreen({
    super.key,
    required this.notifier,
    this.aiNotifier,
  });

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();

  final List<Map<String, String>> _domainTabs = [
    {'id': 'all', 'label': 'All'},
    {'id': 'interests', 'label': 'Topics'},
    {'id': 'users', 'label': 'Creators'},
    {'id': 'reels', 'label': 'Videos'},
    {'id': 'hashtags', 'label': 'Hashtags'},
    {'id': 'communities', 'label': 'Communities'},
  ];

  String _selectedExploreCategory = 'All';

  final List<String> _exploreCategories = [
    'All',
    '🚀 AI & Tech',
    '🎨 Design',
    '🎵 Music',
    '🎮 Gaming',
    '🔬 Science',
    '💪 Fitness',
    '🎬 Cinema',
  ];

  final List<Map<String, dynamic>> _exploreMosaicTiles = [
    {
      'title': 'Autonomous Multi-Agent AI Architecture',
      'creator': 'alex_tech',
      'imageUrl': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
      'views': '142K',
      'likes': '8.4K',
      'category': '🚀 AI & Tech',
      'isVideo': true,
      'caption': 'Zero-location deterministic state machines for autonomous distributed agents.',
    },
    {
      'title': 'Minimalist Dark Theme Design System',
      'creator': 'sarah_flutter',
      'imageUrl': 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800',
      'views': '89K',
      'likes': '6.1K',
      'category': '🎨 Design',
      'isVideo': false,
      'caption': 'Glassmorphism and deep black high-contrast OLED mobile UI components.',
    },
    {
      'title': 'James Webb Space Telescope Spectra Calibration',
      'creator': 'cosmic_elena',
      'imageUrl': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800',
      'views': '310K',
      'likes': '24.9K',
      'category': '🔬 Science',
      'isVideo': true,
      'caption': 'Revealing early galaxy chemical signatures from redshift z=12.',
    },
    {
      'title': 'Modular Synthesizer Sound Design Session',
      'creator': 'synth_master',
      'imageUrl': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800',
      'views': '95K',
      'likes': '7.2K',
      'category': '🎵 Music',
      'isVideo': true,
      'caption': 'Analog patch cords and rhythmic frequency modulation live recording.',
    },
    {
      'title': 'Next-Gen Procedural World Generation',
      'creator': 'dev_sam',
      'imageUrl': 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800',
      'views': '182K',
      'likes': '14.3K',
      'category': '🎮 Gaming',
      'isVideo': true,
      'caption': 'Infinite voxel terrain with zero latency chunk streaming.',
    },
    {
      'title': 'Cinematic Cyberpunk Street Photography',
      'creator': 'neon_lens',
      'imageUrl': 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800',
      'views': '265K',
      'likes': '21.5K',
      'category': '🎬 Cinema',
      'isVideo': false,
      'caption': 'Rain-slicked neon avenues shot on 35mm anamorphic prime lens.',
    },
  ];

  @override
  void initState() {
    super.initState();
    widget.notifier.loadInitialData();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  void _onSearchSubmitted(String query) {
    if (query.trim().isEmpty) return;
    _searchFocusNode.unfocus();
    widget.notifier.executeSearch(query.trim());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: AnimatedBuilder(
          animation: widget.notifier,
          builder: (context, _) {
            final state = widget.notifier.state;

            return Column(
              children: [
                _buildSearchBar(),
                if (state is SearchLoadedState) _buildDomainTabs(state.activeTab),
                Expanded(child: _buildStateContent(state)),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surfaceElevated,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.glassBorder),
        ),
        child: TextField(
          controller: _searchController,
          focusNode: _searchFocusNode,
          style: const TextStyle(color: Colors.white, fontSize: 14),
          textInputAction: TextInputAction.search,
          onChanged: (val) => widget.notifier.onQueryChanged(val),
          onSubmitted: _onSearchSubmitted,
          decoration: InputDecoration(
            hintText: 'Search topics, creators, videos, communities...',
            hintStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
            prefixIcon: const Icon(Icons.search, color: AppColors.textSecondary, size: 20),
            suffixIcon: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_searchController.text.isNotEmpty)
                  IconButton(
                    icon: const Icon(Icons.close, color: AppColors.textSecondary, size: 18),
                    onPressed: () {
                      _searchController.clear();
                      widget.notifier.onQueryChanged('');
                    },
                  ),
                if (widget.aiNotifier != null)
                  IconButton(
                    icon: const Icon(Icons.auto_awesome, color: AppColors.primary, size: 20),
                    tooltip: 'AI Interest Assistant',
                    onPressed: () {
                      AiAssistantSheet.show(context, widget.aiNotifier!);
                    },
                  ),
              ],
            ),
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          ),
        ),
      ),
    );
  }

  Widget _buildDomainTabs(String activeTab) {
    return Container(
      height: 40,
      margin: const EdgeInsets.only(bottom: 8),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _domainTabs.length,
        itemBuilder: (context, index) {
          final tab = _domainTabs[index];
          final isSelected = tab['id'] == activeTab;

          return Padding(
            padding: const EdgeInsets.only(right: 8.0),
            child: ChoiceChip(
              label: Text(tab['label']!),
              selected: isSelected,
              selectedColor: AppColors.primary,
              backgroundColor: AppColors.surface,
              labelStyle: TextStyle(
                color: isSelected ? Colors.white : AppColors.textSecondary,
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
              side: BorderSide(
                color: isSelected ? AppColors.primary : AppColors.glassBorder,
              ),
              onSelected: (_) {
                widget.notifier.switchDomainTab(tab['id']!);
              },
            ),
          );
        },
      ),
    );
  }

  Widget _buildStateContent(SearchState state) {
    if (state is SearchLoadingState) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    if (state is SearchAutocompleteState) {
      return _buildAutocompleteList(state);
    }

    if (state is SearchLoadedState) {
      return _buildSearchResults(state);
    }

    if (state is SearchErrorState) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: AppColors.accentPink, size: 48),
              const SizedBox(height: 12),
              Text(
                state.message,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    // Default: SearchInitialState (Explore Mode: Mosaic Grid + Category Pills + Transparent Trending)
    final initial = state as SearchInitialState;
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      children: [
        _buildExploreCategoryPills(),
        if (initial.recentSearches.isNotEmpty) ...[
          const SizedBox(height: 12),
          _buildRecentSearchesSection(initial.recentSearches),
        ],
        const SizedBox(height: 14),
        _buildExploreMosaicGrid(),
        const SizedBox(height: 24),
        _buildTransparentTrendingSection(initial),
      ],
    );
  }

  Widget _buildExploreCategoryPills() {
    return SizedBox(
      height: 38,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: _exploreCategories.length,
        itemBuilder: (context, index) {
          final cat = _exploreCategories[index];
          final isSelected = cat == _selectedExploreCategory;
          return Padding(
            padding: const EdgeInsets.only(right: 8.0),
            child: ChoiceChip(
              label: Text(cat),
              selected: isSelected,
              selectedColor: AppColors.primary,
              backgroundColor: AppColors.surface,
              labelStyle: TextStyle(
                color: isSelected ? Colors.white : AppColors.textSecondary,
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
              side: BorderSide(color: isSelected ? AppColors.primary : AppColors.glassBorder),
              onSelected: (val) {
                if (val) {
                  setState(() => _selectedExploreCategory = cat);
                }
              },
            ),
          );
        },
      ),
    );
  }

  Widget _buildExploreMosaicGrid() {
    final filteredTiles = _selectedExploreCategory == 'All'
        ? _exploreMosaicTiles
        : _exploreMosaicTiles.where((t) => t['category'] == _selectedExploreCategory).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Icon(Icons.explore, color: AppColors.primary, size: 18),
            SizedBox(width: 6),
            Text(
              'Explore Discoveries',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
            ),
          ],
        ),
        const SizedBox(height: 10),
        GridView.builder(
          physics: const NeverScrollableScrollPhysics(),
          shrinkWrap: true,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            crossAxisSpacing: 4,
            mainAxisSpacing: 4,
            childAspectRatio: 0.75,
          ),
          itemCount: filteredTiles.length,
          itemBuilder: (context, index) {
            final tile = filteredTiles[index];
            return GestureDetector(
              onTap: () => _showMediaDetailModal(tile),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    OptimizedNetworkImage(
                      imageUrl: tile['imageUrl']!,
                      fit: BoxFit.cover,
                      targetCacheWidth: 400,
                      targetCacheHeight: 530,
                    ),
                    Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [Colors.transparent, Colors.black.withOpacity(0.75)],
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                        ),
                      ),
                    ),
                    if (tile['isVideo'] == true)
                      const Positioned(
                        top: 6,
                        right: 6,
                        child: Icon(Icons.play_circle_fill, size: 18, color: Colors.white),
                      ),
                    Positioned(
                      bottom: 6,
                      left: 6,
                      right: 6,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            tile['title']!,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              const Icon(Icons.favorite, size: 10, color: AppColors.accentRed),
                              const SizedBox(width: 2),
                              Text(
                                tile['likes']!,
                                style: const TextStyle(color: Colors.white70, fontSize: 9),
                              ),
                              const Spacer(),
                              Text(
                                '@${tile['creator']}',
                                style: const TextStyle(color: AppColors.accentCyan, fontSize: 9),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  void _showMediaDetailModal(Map<String, dynamic> item) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 14),
                  decoration: BoxDecoration(
                    color: AppColors.textMuted.withOpacity(0.4),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: OptimizedNetworkImage(
                  imageUrl: item['imageUrl']!,
                  height: 240,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  targetCacheWidth: 720,
                  targetCacheHeight: 480,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  CircleAvatar(
                    radius: 16,
                    backgroundColor: AppColors.primary,
                    child: Text(
                      item['creator'][0].toUpperCase(),
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '@${item['creator']}',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceElevated,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      item['category'] ?? 'Explore',
                      style: const TextStyle(color: AppColors.accentCyan, fontSize: 11),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                item['title']!,
                style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              if (item['caption'] != null) ...[
                const SizedBox(height: 4),
                Text(
                  item['caption']!,
                  style: const TextStyle(color: Colors.white70, fontSize: 13),
                ),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                      icon: const Icon(Icons.play_arrow, color: Colors.white),
                      label: Text(item['isVideo'] == true ? 'Watch Reel' : 'View Post', style: const TextStyle(color: Colors.white)),
                      onPressed: () {
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Viewing ${item['title']}')),
                        );
                      },
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: const Icon(Icons.share, color: Colors.white),
                    onPressed: () {
                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Post link copied!')),
                      );
                    },
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAutocompleteList(SearchAutocompleteState state) {
    if (state.suggestions.isEmpty) {
      return const Center(
        child: Text('No suggestions found.', style: TextStyle(color: AppColors.textSecondary)),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: state.suggestions.length,
      separatorBuilder: (_, __) => const Divider(color: AppColors.glassBorder, height: 1),
      itemBuilder: (context, index) {
        final suggestion = state.suggestions[index];
        IconData iconData;
        Color iconColor = AppColors.textSecondary;

        switch (suggestion.type) {
          case 'topic':
            iconData = Icons.interests;
            iconColor = AppColors.primary;
            break;
          case 'creator':
            iconData = Icons.person;
            iconColor = AppColors.accentCyan;
            break;
          case 'hashtag':
            iconData = Icons.tag;
            iconColor = AppColors.accentPink;
            break;
          case 'community':
            iconData = Icons.groups;
            iconColor = AppColors.secondary;
            break;
          default:
            iconData = Icons.search;
        }

        return ListTile(
          dense: true,
          leading: Icon(iconData, color: iconColor, size: 20),
          title: Text(
            suggestion.text,
            style: const TextStyle(color: Colors.white, fontSize: 14),
          ),
          subtitle: suggestion.subtitle != null
              ? Text(
                  suggestion.subtitle!,
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                )
              : null,
          trailing: const Icon(Icons.north_west, color: AppColors.textSecondary, size: 16),
          onTap: () {
            _searchController.text = suggestion.text;
            _onSearchSubmitted(suggestion.text);
          },
        );
      },
    );
  }

  Widget _buildRecentSearchesSection(List<RecentSearchItemModel> recents) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Recent Searches',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
            ),
            GestureDetector(
              onTap: () => widget.notifier.clearAllRecents(),
              child: const Text(
                'Clear All',
                style: TextStyle(color: AppColors.primary, fontSize: 12),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: recents.map((item) {
            return InputChip(
              backgroundColor: AppColors.surfaceElevated,
              side: const BorderSide(color: AppColors.glassBorder),
              label: Text(
                item.queryText,
                style: const TextStyle(color: Colors.white, fontSize: 12),
              ),
              deleteIcon: const Icon(Icons.close, size: 14, color: AppColors.textSecondary),
              onDeleted: () => widget.notifier.deleteRecent(item.id),
              onPressed: () {
                _searchController.text = item.queryText;
                _onSearchSubmitted(item.queryText);
              },
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildTransparentTrendingSection(SearchInitialState state) {
    final activeWindow = widget.notifier.activeTrendingWindow;
    final trending = state.trending;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Row(
              children: [
                Icon(Icons.trending_up, color: AppColors.accentPink, size: 18),
                SizedBox(width: 6),
                Text(
                  'Transparent Trending',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                ),
              ],
            ),
            Row(
              children: ['24h', '72h', '7d'].map((w) {
                final isSelected = w == activeWindow;
                return GestureDetector(
                  onTap: () => widget.notifier.switchTrendingWindow(w),
                  child: Container(
                    margin: const EdgeInsets.only(left: 6),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: isSelected ? AppColors.accentPink : AppColors.surfaceElevated,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      w,
                      style: TextStyle(
                        color: isSelected ? Colors.white : AppColors.textSecondary,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (state.isLoadingTrending)
          const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator(color: AppColors.primary)))
        else if (trending != null && trending.topics.isNotEmpty)
          ...trending.topics.map((t) {
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.glassBorder),
              ),
              child: Row(
                children: [
                  Container(
                    width: 24,
                    alignment: Alignment.center,
                    child: Text(
                      '#${t.rank}',
                      style: const TextStyle(
                        color: AppColors.accentPink,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(t.icon ?? '🔥', style: const TextStyle(fontSize: 18)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          t.title,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                        Text(
                          '${t.categoryTitle} • ${t.postCount} posts in $activeWindow',
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.arrow_forward_ios, color: AppColors.textSecondary, size: 12),
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => TopicPageScreen(
                            idOrSlug: t.slug,
                            repository: widget.notifier.repository,
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            );
          })
        else
          const Text('No trending topics for this window.', style: TextStyle(color: AppColors.textSecondary)),
      ],
    );
  }

  Widget _buildSearchResults(SearchLoadedState state) {
    final results = state.results;

    // Moderation Warning Banner
    if (results.isProhibited) {
      return Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.accentPink.withOpacity(0.15),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.accentPink.withOpacity(0.4)),
              ),
              child: Column(
                children: [
                  const Icon(Icons.shield_outlined, color: AppColors.accentPink, size: 36),
                  const SizedBox(height: 8),
                  const Text(
                    'Search Query Prohibited',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    results.moderationMessage ??
                        'This query violates community safety policies and cannot be searched.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            if (results.emptySuggestions != null) _buildEmptySuggestions(results.emptySuggestions!),
          ],
        ),
      );
    }

    if (results.totalCount == 0) {
      return Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            const Icon(Icons.search_off, color: AppColors.textSecondary, size: 48),
            const SizedBox(height: 12),
            Text(
              'No results found for "${results.query}"',
              style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Try searching for other topics, creators, or hashtags.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            if (results.emptySuggestions != null) _buildEmptySuggestions(results.emptySuggestions!),
          ],
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Topics Results
        if (results.interests.isNotEmpty) ...[
          const Text(
            'Topics',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
          ),
          const SizedBox(height: 8),
          ...results.interests.map((topic) {
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.glassBorder),
              ),
              child: ListTile(
                leading: Text(topic.icon ?? '💡', style: const TextStyle(fontSize: 22)),
                title: Text(topic.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                subtitle: Text(
                  '${topic.categoryTitle ?? "Topic"} • ${topic.reelsCount} videos',
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
                trailing: const Icon(Icons.chevron_right, color: AppColors.textSecondary),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => TopicPageScreen(
                        idOrSlug: topic.slug,
                        repository: widget.notifier.repository,
                      ),
                    ),
                  );
                },
              ),
            );
          }),
          const SizedBox(height: 16),
        ],

        // Creators Results
        if (results.users.isNotEmpty) ...[
          const Text(
            'Creators',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
          ),
          const SizedBox(height: 8),
          ...results.users.map((user) {
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.glassBorder),
              ),
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: AppColors.surfaceElevated,
                  backgroundImage: appAvatarProvider(user.avatarUrl),
                  child: user.avatarUrl == null
                      ? Text(
                          user.displayName.isNotEmpty ? user.displayName[0].toUpperCase() : 'U',
                          style: const TextStyle(color: Colors.white),
                        )
                      : null,
                ),
                title: Row(
                  children: [
                    Text(user.displayName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    if (user.isVerified) ...[
                      const SizedBox(width: 4),
                      const Icon(Icons.verified, color: AppColors.accentCyan, size: 14),
                    ],
                  ],
                ),
                subtitle: Text(
                  '@${user.username} • ${user.followersCount} followers • ${user.sharedInterestsCount} shared interests',
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                ),
              ),
            );
          }),
          const SizedBox(height: 16),
        ],

        // Communities Results
        if (results.communities.isNotEmpty) ...[
          const Text(
            'Communities',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
          ),
          const SizedBox(height: 8),
          ...results.communities.map((comm) {
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.glassBorder),
              ),
              child: ListTile(
                leading: const Icon(Icons.groups, color: AppColors.secondary, size: 28),
                title: Text(comm.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                subtitle: Text(
                  '${comm.interestTitle ?? "Community"} • ${comm.membersCount} members • ${comm.pricingType == "free" ? "Free" : "\$${(comm.priceCents / 100).toStringAsFixed(2)}"}',
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                ),
              ),
            );
          }),
          const SizedBox(height: 16),
        ],

        // Videos Results
        if (results.reels.isNotEmpty) ...[
          const Text(
            'Videos',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
          ),
          const SizedBox(height: 8),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              childAspectRatio: 0.7,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
            ),
            itemCount: results.reels.length,
            itemBuilder: (context, index) {
              final reel = results.reels[index];
              return ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  color: AppColors.surfaceElevated,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      OptimizedNetworkImage(
                        imageUrl: reel.thumbnailUrl,
                        fit: BoxFit.cover,
                        targetCacheWidth: 400,
                        targetCacheHeight: 650,
                      ),
                      Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [Colors.transparent, Colors.black.withOpacity(0.8)],
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                          ),
                        ),
                      ),
                      Positioned(
                        bottom: 8,
                        left: 8,
                        right: 8,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              reel.title,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            if (reel.matchSnippet != null)
                              Text(
                                reel.matchSnippet!,
                                style: const TextStyle(color: AppColors.accentCyan, fontSize: 9),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            const SizedBox(height: 4),
                            Text(
                              '@${reel.creatorUsername}',
                              style: const TextStyle(color: AppColors.textSecondary, fontSize: 10),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ],
    );
  }

  Widget _buildEmptySuggestions(Map<String, List<String>> suggestions) {
    final topics = suggestions['trendingTopics'] ?? [];
    final hashtags = suggestions['popularHashtags'] ?? [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (topics.isNotEmpty) ...[
          const Text(
            'Explore Popular Topics:',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: topics.map((t) {
              return ActionChip(
                backgroundColor: AppColors.surfaceElevated,
                side: const BorderSide(color: AppColors.glassBorder),
                label: Text(t, style: const TextStyle(color: Colors.white, fontSize: 12)),
                onPressed: () {
                  _searchController.text = t;
                  _onSearchSubmitted(t);
                },
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
        ],
        if (hashtags.isNotEmpty) ...[
          const Text(
            'Trending Hashtags:',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: hashtags.map((h) {
              return ActionChip(
                backgroundColor: AppColors.surfaceElevated,
                side: const BorderSide(color: AppColors.glassBorder),
                label: Text(h, style: const TextStyle(color: AppColors.accentPink, fontSize: 12)),
                onPressed: () {
                  _searchController.text = h;
                  _onSearchSubmitted(h);
                },
              );
            }).toList(),
          ),
        ],
      ],
    );
  }
}
