import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import 'package:mobile/core/sanitizer/geo_sanitizer.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/reels/data/reels_repository.dart';

class CreatePostScreen extends StatefulWidget {
  final ReelsRepository repository;

  const CreatePostScreen({
    super.key,
    required this.repository,
  });

  @override
  State<CreatePostScreen> createState() => _CreatePostScreenState();
}

class _CreatePostScreenState extends State<CreatePostScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _captionController = TextEditingController();
  final _imageUrlController = TextEditingController();
  final _interestTagController = TextEditingController();
  final _hashtagsController = TextEditingController();

  final List<String> _imageUrls = [];
  String _visibility = 'PUBLIC';
  bool _isSubmitting = false;
  String? _errorMessage;
  bool _hasGeoWarning = false;

  @override
  void initState() {
    super.initState();
    _captionController.addListener(_checkGeoCompliance);
  }

  @override
  void dispose() {
    _captionController.removeListener(_checkGeoCompliance);
    _titleController.dispose();
    _captionController.dispose();
    _imageUrlController.dispose();
    _interestTagController.dispose();
    _hashtagsController.dispose();
    super.dispose();
  }

  void _checkGeoCompliance() {
    final hasGeo = GeoSanitizer.containsLocationCoordinates(_captionController.text);
    if (hasGeo != _hasGeoWarning) {
      setState(() {
        _hasGeoWarning = hasGeo;
      });
    }
  }

  void _addImageUrl() {
    final url = _imageUrlController.text.trim();
    if (url.isEmpty) return;
    if (_imageUrls.length >= 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('A maximum of 10 images is allowed.')),
      );
      return;
    }

    setState(() {
      _imageUrls.add(url);
      _imageUrlController.clear();
    });
  }

  void _removeImageUrl(int index) {
    setState(() {
      _imageUrls.removeAt(index);
    });
  }

  Future<void> _submitPost() async {
    if (!_formKey.currentState!.validate()) return;
    if (_imageUrls.isEmpty) {
      setState(() {
        _errorMessage = 'Please add at least 1 image URL.';
      });
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final sanitizedCaption = GeoSanitizer.sanitizeText(_captionController.text.trim());
      final primaryInterest = _interestTagController.text.trim().toLowerCase();
      final hashtags = _hashtagsController.text
          .split(',')
          .map((e) => e.trim().replaceAll('#', ''))
          .where((e) => e.isNotEmpty)
          .toList();

      await widget.repository.createImagePost(
        title: _titleController.text.trim(),
        caption: sanitizedCaption.isNotEmpty ? sanitizedCaption : null,
        imageUrls: _imageUrls,
        primaryInterestId: primaryInterest,
        interestTags: [primaryInterest],
        hashtags: hashtags,
        visibility: _visibility,
      );

      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } on Failure catch (e) {
      setState(() {
        _errorMessage = e.message;
        _isSubmitting = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to publish post: $e';
        _isSubmitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        title: const Text('Create Post', style: TextStyle(color: AppColors.textPrimary)),
        backgroundColor: AppColors.backgroundSecondary,
        elevation: 0,
        actions: [
          TextButton(
            key: const Key('publish_post_button'),
            onPressed: _isSubmitting ? null : _submitPost,
            child: _isSubmitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brandPrimary),
                  )
                : const Text(
                    'Publish',
                    style: TextStyle(
                      color: AppColors.brandPrimary,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_errorMessage != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.accentRed.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.accentRed),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: AppColors.accentRed, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: const TextStyle(color: AppColors.accentRed, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),

              // Zero-Location compliance indicator
              if (_hasGeoWarning)
                Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.accentGold.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.accentGold),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.shield_outlined, color: AppColors.accentGold, size: 20),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Zero-Location Policy: GPS coordinates detected in caption will be automatically stripped before publishing.',
                          style: TextStyle(color: AppColors.accentGold, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ),

              // Title
              TextFormField(
                key: const Key('post_title_field'),
                controller: _titleController,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: const InputDecoration(
                  labelText: 'Title *',
                  labelStyle: TextStyle(color: AppColors.textSecondary),
                  hintText: 'What is this post about?',
                  hintStyle: TextStyle(color: AppColors.textTertiary),
                  border: OutlineInputBorder(),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Title is required';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Caption
              TextFormField(
                key: const Key('post_caption_field'),
                controller: _captionController,
                maxLines: 3,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: const InputDecoration(
                  labelText: 'Caption (Optional)',
                  labelStyle: TextStyle(color: AppColors.textSecondary),
                  hintText: 'Share context, code snippets, or thoughts...',
                  hintStyle: TextStyle(color: AppColors.textTertiary),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),

              // Primary Interest Tag
              TextFormField(
                key: const Key('post_interest_field'),
                controller: _interestTagController,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: const InputDecoration(
                  labelText: 'Primary Interest Tag *',
                  labelStyle: TextStyle(color: AppColors.textSecondary),
                  hintText: 'e.g. distributed-systems, ai-agents, flutter',
                  hintStyle: TextStyle(color: AppColors.textTertiary),
                  border: OutlineInputBorder(),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Primary interest tag is required';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Hashtags
              TextFormField(
                key: const Key('post_hashtags_field'),
                controller: _hashtagsController,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: const InputDecoration(
                  labelText: 'Hashtags (Comma-separated)',
                  labelStyle: TextStyle(color: AppColors.textSecondary),
                  hintText: 'e.g. dev, architecture, backend',
                  hintStyle: TextStyle(color: AppColors.textTertiary),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),

              // Visibility Dropdown
              DropdownButtonFormField<String>(
                value: _visibility,
                dropdownColor: AppColors.backgroundSecondary,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: const InputDecoration(
                  labelText: 'Visibility',
                  labelStyle: TextStyle(color: AppColors.textSecondary),
                  border: OutlineInputBorder(),
                ),
                items: const [
                  DropdownMenuItem(value: 'PUBLIC', child: Text('Public (Everyone)')),
                  DropdownMenuItem(value: 'FOLLOWERS_ONLY', child: Text('Followers Only')),
                  DropdownMenuItem(value: 'PRIVATE', child: Text('Private (Only Me)')),
                ],
                onChanged: (val) {
                  if (val != null) setState(() => _visibility = val);
                },
              ),
              const SizedBox(height: 20),

              // Images Section
              const Text(
                'Images (1 - 10)',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 8),

              Row(
                children: [
                  Expanded(
                    child: TextField(
                      key: const Key('post_image_url_field'),
                      controller: _imageUrlController,
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                      decoration: const InputDecoration(
                        hintText: 'https://example.com/photo.jpg',
                        hintStyle: TextStyle(color: AppColors.textTertiary),
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    key: const Key('add_image_button'),
                    onPressed: _addImageUrl,
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.brandPrimary),
                    child: const Text('Add'),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Image previews list
              if (_imageUrls.isNotEmpty)
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _imageUrls.asMap().entries.map((entry) {
                    final idx = entry.key;
                    final url = entry.value;
                    return Stack(
                      children: [
                        Container(
                          width: 80,
                          height: 80,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(8),
                            color: AppColors.backgroundCard,
                            image: DecorationImage(
                              image: appAvatarProvider(url, targetWidth: 160, targetHeight: 160)!,
                              fit: BoxFit.cover,
                            ),
                          ),
                        ),
                        Positioned(
                          top: 2,
                          right: 2,
                          child: GestureDetector(
                            onTap: () => _removeImageUrl(idx),
                            child: Container(
                              padding: const EdgeInsets.all(2),
                              decoration: const BoxDecoration(
                                shape: BoxShape.circle,
                                color: Colors.black87,
                              ),
                              child: const Icon(Icons.close, size: 14, color: Colors.white),
                            ),
                          ),
                        ),
                      ],
                    );
                  }).toList(),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
