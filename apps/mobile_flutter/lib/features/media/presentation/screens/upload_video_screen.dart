import 'dart:io';
import 'package:flutter/material.dart';
import 'package:mobile/core/sanitizer/geo_sanitizer.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/error/failures.dart';
import 'package:mobile/features/reels/data/reels_repository.dart';
import '../../domain/services/resumable_video_uploader.dart';
import '../../domain/models/upload_session_model.dart';

class UploadVideoScreen extends StatefulWidget {
  final ReelsRepository repository;
  final String? initialVideoPath;

  const UploadVideoScreen({
    super.key,
    required this.repository,
    this.initialVideoPath,
  });

  @override
  State<UploadVideoScreen> createState() => _UploadVideoScreenState();
}

class _UploadVideoScreenState extends State<UploadVideoScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _captionController = TextEditingController();
  final _interestController = TextEditingController();
  final _hashtagsController = TextEditingController();
  final _filePathController = TextEditingController();

  late ResumableVideoUploader _uploader;
  String _visibility = 'PUBLIC';
  bool _isUploading = false;
  double _uploadProgress = 0.0;
  String _statusText = '';
  String? _errorMessage;
  bool _hasGeoWarning = false;

  @override
  void initState() {
    super.initState();
    _uploader = ResumableVideoUploader(repository: widget.repository);
    if (widget.initialVideoPath != null) {
      _filePathController.text = widget.initialVideoPath!;
    }
    _captionController.addListener(_checkGeoCompliance);
  }

  @override
  void dispose() {
    _captionController.removeListener(_checkGeoCompliance);
    _titleController.dispose();
    _captionController.dispose();
    _interestController.dispose();
    _hashtagsController.dispose();
    _filePathController.dispose();
    super.dispose();
  }

  void _checkGeoCompliance() {
    final hasGeo = GeoSanitizer.containsLocationCoordinates(_captionController.text);
    if (hasGeo != _hasGeoWarning) {
      setState(() => _hasGeoWarning = hasGeo);
    }
  }

  Future<void> _startUpload() async {
    if (!_formKey.currentState!.validate()) return;

    final filePath = _filePathController.text.trim();
    final file = File(filePath);

    try {
      _uploader.validateVideoFile(file);
    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
      });
      return;
    }

    setState(() {
      _isUploading = true;
      _errorMessage = null;
      _statusText = 'Initiating multipart upload session...';
      _uploadProgress = 0.0;
    });

    try {
      final sanitizedCaption = GeoSanitizer.sanitizeText(_captionController.text.trim());
      final primaryInterest = _interestController.text.trim().toLowerCase();
      final hashtags = _hashtagsController.text
          .split(',')
          .map((e) => e.trim().replaceAll('#', ''))
          .where((e) => e.isNotEmpty)
          .toList();

      final session = await _uploader.uploadVideo(
        file: file,
        title: _titleController.text.trim(),
        caption: sanitizedCaption.isNotEmpty ? sanitizedCaption : null,
        hashtags: hashtags,
        primaryInterestId: primaryInterest,
        interestTagIds: [primaryInterest],
        visibility: _visibility,
        onProgress: (uploaded, total, percent) {
          if (mounted) {
            setState(() {
              _uploadProgress = percent / 100.0;
              final mbUploaded = (uploaded / (1024 * 1024)).toStringAsFixed(1);
              final mbTotal = (total / (1024 * 1024)).toStringAsFixed(1);
              _statusText = 'Uploading video chunks: $mbUploaded MB / $mbTotal MB (${percent.toStringAsFixed(1)}%)';
            });
          }
        },
      );


      if (session.status == UploadSessionStatus.aborted) {
        setState(() {
          _isUploading = false;
          _statusText = 'Upload cancelled.';
        });
        return;
      }

      setState(() {
        _statusText = 'Video queued for HLS transcoding & content safety scan...';
      });

      // Poll until transcoding finishes
      final completedSession = await _uploader.waitForProcessing(
        session,
        pollInterval: const Duration(seconds: 2),
      );

      if (completedSession.status == UploadSessionStatus.completed) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Video successfully published!')),
          );
          Navigator.of(context).pop(true);
        }
      } else {
        setState(() {
          _isUploading = false;
          _errorMessage = completedSession.errorReason ?? 'Transcoding failed';
        });
      }
    } on Failure catch (e) {
      setState(() {
        _isUploading = false;
        _errorMessage = e.message;
      });
    } catch (e) {
      setState(() {
        _isUploading = false;
        _errorMessage = 'Upload failed: $e';
      });
    }
  }

  void _cancelUpload() {
    _uploader.cancel();
    setState(() {
      _isUploading = false;
      _statusText = 'Cancelling transfer...';
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundPrimary,
      appBar: AppBar(
        title: const Text('Upload Video Reel', style: TextStyle(color: AppColors.textPrimary)),
        backgroundColor: AppColors.backgroundSecondary,
        elevation: 0,
        actions: [
          if (!_isUploading)
            TextButton(
              key: const Key('submit_video_button'),
              onPressed: _startUpload,
              child: const Text(
                'Upload',
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
              // Error feedback
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

              // Zero-Location compliance warning banner
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

              // Uploading progress indicators
              if (_isUploading) ...[
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.backgroundSecondary,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.divider),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      LinearProgressIndicator(
                        key: const Key('upload_progress_bar'),
                        value: _uploadProgress > 0 ? _uploadProgress : null,
                        backgroundColor: AppColors.backgroundCard,
                        valueColor: const AlwaysStoppedAnimation<Color>(AppColors.brandPrimary),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        _statusText,
                        style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          OutlinedButton(
                            key: const Key('cancel_upload_button'),
                            onPressed: _cancelUpload,
                            style: OutlinedButton.styleFrom(foregroundColor: AppColors.accentRed),
                            child: const Text('Cancel Upload'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
              ],

              // File path
              TextFormField(
                key: const Key('video_file_path_field'),
                controller: _filePathController,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: const InputDecoration(
                  labelText: 'Video File Path *',
                  hintText: '/path/to/video.mp4',
                  border: OutlineInputBorder(),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Video file path is required';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Title
              TextFormField(
                key: const Key('video_title_field'),
                controller: _titleController,
                maxLength: 150,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: const InputDecoration(
                  labelText: 'Title *',
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
                key: const Key('video_caption_field'),
                controller: _captionController,
                maxLines: 3,
                maxLength: 1000,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: const InputDecoration(
                  labelText: 'Caption (Optional)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),

              // Primary Interest Tag
              TextFormField(
                key: const Key('video_interest_field'),
                controller: _interestController,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: const InputDecoration(
                  labelText: 'Primary Interest Tag *',
                  hintText: 'e.g. distributed-systems, ai-agents',
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
                key: const Key('video_hashtags_field'),
                controller: _hashtagsController,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: const InputDecoration(
                  labelText: 'Hashtags (Comma-separated)',
                  hintText: 'e.g. flutter, architecture, dev',
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
            ],
          ),
        ),
      ),
    );
  }
}
