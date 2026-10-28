import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/features/communities/data/communities_repository.dart';
import 'package:mobile/features/communities/domain/models/community_models.dart';
import 'package:mobile/features/communities/presentation/communities_notifier.dart';
import 'package:mobile/features/communities/presentation/screens/community_detail_screen.dart';

class CommunitiesListScreen extends StatefulWidget {
  final CommunitiesRepository repository;
  final String? authToken;
  final String? currentUserId;

  const CommunitiesListScreen({
    super.key,
    required this.repository,
    this.authToken,
    this.currentUserId,
  });

  @override
  State<CommunitiesListScreen> createState() => _CommunitiesListScreenState();
}

class _CommunitiesListScreenState extends State<CommunitiesListScreen> {
  late CommunitiesNotifier _notifier;
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _notifier = CommunitiesNotifier(
      repository: widget.repository,
      authToken: widget.authToken,
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    _notifier.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _notifier,
      builder: (context, _) {
        final state = _notifier.state;

        return Scaffold(
          appBar: AppBar(
            title: const Text('Topic Communities'),
          ),
          body: Column(
            children: [
              // Search & Filter Bar
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _searchController,
                        decoration: InputDecoration(
                          hintText: 'Search communities...',
                          prefixIcon: const Icon(Icons.search),
                          isDense: true,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        onChanged: (val) => _notifier.setSearchQuery(val.trim()),
                      ),
                    ),
                    const SizedBox(width: 8),
                    FilterChip(
                      label: const Text('Joined'),
                      selected: state.joinedOnly,
                      onSelected: (val) => _notifier.setJoinedOnly(val),
                    ),
                  ],
                ),
              ),

              // Content List
              Expanded(
                child: state.isLoading && state.communities.isEmpty
                    ? const Center(child: CircularProgressIndicator())
                    : state.communities.isEmpty
                        ? const Center(child: Text('No communities found.'))
                        : ListView.separated(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            itemCount: state.communities.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 8),
                            itemBuilder: (context, index) {
                              final comm = state.communities[index];
                              return _buildCommunityCard(comm);
                            },
                          ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildCommunityCard(CommunityModel comm) {
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: Colors.blueAccent.shade700,
          backgroundImage: appAvatarProvider(comm.avatarUrl),
          child: comm.avatarUrl == null
              ? Text(
                  comm.name.isNotEmpty ? comm.name[0].toUpperCase() : 'C',
                  style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                )
              : null,
        ),
        title: Row(
          children: [
            Flexible(
              child: Text(
                comm.name,
                style: const TextStyle(fontWeight: FontWeight.bold),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 6),
            _buildVisibilityBadge(comm.visibility),
          ],
        ),
        subtitle: Text(
          '${comm.membersCount} members • ${comm.description}',
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: const Icon(Icons.chevron_right),
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (ctx) => CommunityDetailScreen(
                identifier: comm.id,
                repository: widget.repository,
                authToken: widget.authToken,
                currentUserId: widget.currentUserId,
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildVisibilityBadge(CommunityVisibility visibility) {
    Color color = Colors.green;
    String label = 'Public';
    if (visibility == CommunityVisibility.restricted) {
      color = Colors.orange;
      label = 'Restricted';
    } else if (visibility == CommunityVisibility.private) {
      color = Colors.redAccent;
      label = 'Private';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.bold),
      ),
    );
  }
}
