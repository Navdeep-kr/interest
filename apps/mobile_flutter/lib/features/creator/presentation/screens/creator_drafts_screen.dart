import 'package:flutter/material.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/creator/data/creator_api_client.dart';
import 'package:mobile/features/creator/data/creator_repository.dart';
import 'package:mobile/features/creator/domain/models/creator_models.dart';
import 'package:mobile/features/creator/presentation/screens/creator_studio_screen.dart';

class CreatorDraftsScreen extends StatefulWidget {
  final CreatorRepository? repository;

  const CreatorDraftsScreen({super.key, this.repository});

  @override
  State<CreatorDraftsScreen> createState() => _CreatorDraftsScreenState();
}

class _CreatorDraftsScreenState extends State<CreatorDraftsScreen> {
  late final CreatorRepository _repository;
  List<CreatorDraftModel> _drafts = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ??
        CreatorRepository(
          apiClient: CreatorApiClient(),
          secureStorage: PlatformSecureStorageService(),
        );

    _loadDrafts();
  }

  Future<void> _loadDrafts() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final drafts = await _repository.getDrafts();
      setState(() {
        _drafts = drafts;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Failed to load drafts: $e';
      });
    }
  }

  void _onDeleteDraft(String draftId) async {
    await _repository.deleteDraft(draftId);
    setState(() {
      _drafts.removeWhere((d) => d.id == draftId);
    });
  }

  void _onResumeDraft(CreatorDraftModel draft) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CreatorStudioScreen(initialDraft: draft),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        title: const Text(
          'Saved Drafts',
          style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _errorMessage != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.error_outline, color: AppColors.error, size: 48),
                      const SizedBox(height: 12),
                      Text(_errorMessage!, style: const TextStyle(color: AppColors.textSecondary)),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadDrafts,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _drafts.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.drafts_outlined, size: 64, color: AppColors.textMuted),
                          const SizedBox(height: 16),
                          const Text(
                            'No Saved Drafts',
                            style: TextStyle(color: AppColors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Your unfinished reels and recipes will be preserved here safely.',
                            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                          ),
                          const SizedBox(height: 20),
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                            onPressed: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => const CreatorStudioScreen(),
                                ),
                              );
                            },
                            icon: const Icon(Icons.add, size: 18),
                            label: const Text('Create New Reel'),
                          ),
                        ],
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _drafts.length,
                      separatorBuilder: (ctx, i) => const Divider(color: AppColors.glassBorder),
                      itemBuilder: (ctx, index) {
                        final draft = _drafts[index];

                        return ListTile(
                          tileColor: AppColors.surface,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: const BorderSide(color: AppColors.glassBorder),
                          ),
                          leading: Container(
                            width: 48,
                            height: 64,
                            decoration: BoxDecoration(
                              color: AppColors.surfaceElevated,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Center(
                              child: Icon(Icons.movie_outlined, color: AppColors.primary),
                            ),
                          ),
                          title: Text(
                            draft.title.isEmpty ? 'Untitled Draft' : draft.title,
                            style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold),
                          ),
                          subtitle: Text(
                            'Ratio: ${draft.aspectRatio.value} • ${(draft.trimEndMs ?? 15000) ~/ 1000}s',
                            style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                          ),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                icon: const Icon(Icons.edit, color: AppColors.accentCyan),
                                onPressed: () => _onResumeDraft(draft),
                              ),
                              IconButton(
                                icon: const Icon(Icons.delete_outline, color: AppColors.error),
                                onPressed: () => _onDeleteDraft(draft.id),
                              ),
                            ],
                          ),
                          onTap: () => _onResumeDraft(draft),
                        );
                      },
                    ),
    );
  }
}
