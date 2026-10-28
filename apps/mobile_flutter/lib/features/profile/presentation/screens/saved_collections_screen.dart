import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/reels/domain/models/collection_item_model.dart';

/// Screen displaying all organized Saved Collections & Bookmarks.
class SavedCollectionsScreen extends StatelessWidget {
  const SavedCollectionsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final collections = [
      const CollectionItemModel(
        id: 'col_all',
        userId: 'usr_me',
        name: 'All Posts',
        isPrivate: true,
        itemCount: 42,
        coverUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
        createdAt: '2026-01-01',
      ),
      const CollectionItemModel(
        id: 'col_arch',
        userId: 'usr_me',
        name: 'Modern Architecture',
        isPrivate: true,
        itemCount: 16,
        coverUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400',
        createdAt: '2026-01-05',
      ),
      const CollectionItemModel(
        id: 'col_code',
        userId: 'usr_me',
        name: 'Flutter & AI Mastery',
        isPrivate: false,
        itemCount: 28,
        coverUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400',
        createdAt: '2026-01-10',
      ),
      const CollectionItemModel(
        id: 'col_vibes',
        userId: 'usr_me',
        name: 'Creative Vibes & Audio',
        isPrivate: true,
        itemCount: 9,
        coverUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
        createdAt: '2026-02-01',
      ),
    ];

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: const Text('Saved Collections', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.add, color: Colors.white),
            tooltip: 'Create Collection',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Tap bookmark on any post to add to a new collection!')),
              );
            },
          ),
        ],
      ),
      body: GridView.builder(
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 16,
          childAspectRatio: 0.85,
        ),
        itemCount: collections.length,
        itemBuilder: (ctx, index) {
          final col = collections[index];
          return GestureDetector(
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Opened collection "${col.name}" with ${col.itemCount} posts.')),
              );
            },
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        if (col.coverUrl != null)
                          OptimizedNetworkImage(imageUrl: col.coverUrl!, fit: BoxFit.cover)
                        else
                          Container(color: AppColors.surfaceElevated),
                        if (col.isPrivate)
                          Positioned(
                            top: 8,
                            right: 8,
                            child: Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                color: Colors.black.withOpacity(0.6),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.lock, color: Colors.white, size: 12),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  col.name,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  '${col.itemCount} posts',
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
