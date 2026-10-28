import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/reels/domain/models/reel_item_model.dart';
import 'package:mobile/features/reels/domain/models/collection_item_model.dart';

/// Instagram-style Saved Collections Selector & Creator Sheet.
class SaveToCollectionSheet extends StatefulWidget {
  final ReelItemModel reel;
  final Function(String collectionName) onCollectionSelected;

  const SaveToCollectionSheet({
    super.key,
    required this.reel,
    required this.onCollectionSelected,
  });

  static void show(
    BuildContext context, {
    required ReelItemModel reel,
    required Function(String collectionName) onCollectionSelected,
  }) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => SaveToCollectionSheet(
        reel: reel,
        onCollectionSelected: onCollectionSelected,
      ),
    );
  }

  @override
  State<SaveToCollectionSheet> createState() => _SaveToCollectionSheetState();
}

class _SaveToCollectionSheetState extends State<SaveToCollectionSheet> {
  final List<CollectionItemModel> _collections = [
    const CollectionItemModel(
      id: 'col_all',
      userId: 'usr_me',
      name: 'All Posts (Default)',
      isPrivate: true,
      itemCount: 42,
      coverUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      createdAt: '2026-01-01',
    ),
    const CollectionItemModel(
      id: 'col_arch',
      userId: 'usr_me',
      name: 'Modern Architecture',
      isPrivate: true,
      itemCount: 16,
      coverUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=200',
      createdAt: '2026-01-05',
    ),
    const CollectionItemModel(
      id: 'col_code',
      userId: 'usr_me',
      name: 'Flutter & AI Mastery',
      isPrivate: false,
      itemCount: 28,
      coverUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=200',
      createdAt: '2026-01-10',
    ),
    const CollectionItemModel(
      id: 'col_vibes',
      userId: 'usr_me',
      name: 'Creative Vibes & Audio',
      isPrivate: true,
      itemCount: 9,
      coverUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
      createdAt: '2026-02-01',
    ),
  ];

  void _showCreateCollectionDialog() {
    final titleController = TextEditingController();
    bool isPrivate = true;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (dialogCtx, setDialogState) => AlertDialog(
          backgroundColor: AppColors.surface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('New Saved Collection', style: TextStyle(color: Colors.white, fontSize: 16)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: titleController,
                autofocus: true,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  hintText: 'Collection name (e.g. Dream Homes)',
                  hintStyle: TextStyle(color: AppColors.textMuted),
                  filled: true,
                  fillColor: AppColors.surfaceElevated,
                  border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(10))),
                ),
              ),
              const SizedBox(height: 12),
              SwitchListTile(
                value: isPrivate,
                activeColor: AppColors.primary,
                contentPadding: EdgeInsets.zero,
                title: const Text('Keep Private', style: TextStyle(color: Colors.white, fontSize: 13)),
                subtitle: const Text('Only you can view this collection', style: TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                onChanged: (val) => setDialogState(() => isPrivate = val),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: AppColors.textMuted)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
              onPressed: () {
                final name = titleController.text.trim();
                if (name.isNotEmpty) {
                  setState(() {
                    _collections.add(
                      CollectionItemModel(
                        id: 'col_${DateTime.now().millisecondsSinceEpoch}',
                        userId: 'usr_me',
                        name: name,
                        isPrivate: isPrivate,
                        itemCount: 1,
                        coverUrl: widget.reel.thumbnailUrl,
                        createdAt: DateTime.now().toIso8601String(),
                      ),
                    );
                  });
                  Navigator.pop(ctx);
                  widget.onCollectionSelected(name);
                  Navigator.pop(context);
                }
              },
              child: const Text('Create & Save', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 38,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.glassBorder,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.bookmark, color: AppColors.primary, size: 22),
                    SizedBox(width: 8),
                    Text(
                      'Save to Collection',
                      style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                TextButton.icon(
                  onPressed: _showCreateCollectionDialog,
                  icon: const Icon(Icons.add, color: AppColors.primary, size: 18),
                  label: const Text('New', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Divider(color: AppColors.glassBorder),

            // List of Collections
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _collections.length,
              itemBuilder: (ctx, i) {
                final col = _collections[i];
                return ListTile(
                  contentPadding: const EdgeInsets.symmetric(vertical: 4, horizontal: 0),
                  leading: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: SizedBox(
                      width: 48,
                      height: 48,
                      child: col.coverUrl != null
                          ? OptimizedNetworkImage(imageUrl: col.coverUrl!, fit: BoxFit.cover)
                          : Container(color: AppColors.surfaceElevated, child: const Icon(Icons.folder, color: Colors.white)),
                    ),
                  ),
                  title: Row(
                    children: [
                      Text(col.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                      if (col.isPrivate) ...[
                        const SizedBox(width: 4),
                        const Icon(Icons.lock, color: AppColors.textMuted, size: 12),
                      ],
                    ],
                  ),
                  subtitle: Text('${col.itemCount} saved posts', style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                  trailing: const Icon(Icons.arrow_forward_ios, color: AppColors.textMuted, size: 12),
                  onTap: () {
                    Navigator.pop(context);
                    widget.onCollectionSelected(col.name);
                  },
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
