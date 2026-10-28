import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/models/user_profile.dart';
import '../profile_notifier.dart';

class EditProfileScreen extends StatefulWidget {
  final UserProfile profile;
  final ProfileNotifier notifier;

  const EditProfileScreen({
    super.key,
    required this.profile,
    required this.notifier,
  });

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _displayNameController;
  late TextEditingController _usernameController;
  late TextEditingController _bioController;

  late bool _isPrivate;
  late bool _hideFollowerCount;
  late bool _hideFollowingCount;
  late String _allowTagging;
  late String _allowMentions;
  late List<SocialLink> _links;

  bool _isSaving = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final p = widget.profile;
    _displayNameController = TextEditingController(text: p.displayName);
    _usernameController = TextEditingController(text: p.username);
    _bioController = TextEditingController(text: p.bio ?? '');
    _isPrivate = p.isPrivate;
    _hideFollowerCount = p.hideFollowerCount;
    _hideFollowingCount = p.hideFollowingCount;
    _allowTagging = p.allowTagging;
    _allowMentions = p.allowMentions;
    _links = List.from(p.links);
  }

  @override
  void dispose() {
    _displayNameController.dispose();
    _usernameController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  void _addSocialLink() {
    if (_links.length >= 5) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Maximum 5 social links allowed.'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    String title = '';
    String url = '';

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: AppColors.surface,
          title: const Text('Add Link', style: TextStyle(color: AppColors.textPrimary)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                decoration: const InputDecoration(
                  labelText: 'Title (e.g. GitHub, Website)',
                  labelStyle: TextStyle(color: AppColors.textSecondary),
                ),
                style: const TextStyle(color: AppColors.textPrimary),
                onChanged: (val) => title = val,
              ),
              const SizedBox(height: 12),
              TextField(
                decoration: const InputDecoration(
                  labelText: 'URL (https://...)',
                  labelStyle: TextStyle(color: AppColors.textSecondary),
                ),
                style: const TextStyle(color: AppColors.textPrimary),
                onChanged: (val) => url = val,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
            ),
            ElevatedButton(
              onPressed: () {
                if (title.trim().isNotEmpty && url.trim().isNotEmpty) {
                  setState(() {
                    _links.add(SocialLink(title: title.trim(), url: url.trim()));
                  });
                  Navigator.pop(ctx);
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
              child: const Text('Add'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isSaving = true;
      _errorMessage = null;
    });

    final payload = <String, dynamic>{
      'displayName': _displayNameController.text.trim(),
      'username': _usernameController.text.trim(),
      'bio': _bioController.text.trim(),
      'isPrivate': _isPrivate,
      'hideFollowerCount': _hideFollowerCount,
      'hideFollowingCount': _hideFollowingCount,
      'allowTagging': _allowTagging,
      'allowMentions': _allowMentions,
      'links': _links.map((l) => l.toJson()).toList(),
    };

    try {
      await widget.notifier.updateProfile(payload);
      if (mounted) {
        Navigator.pop(context, true);
      }
    } catch (e) {
      setState(() {
        _isSaving = false;
        _errorMessage = e.toString().replaceFirst(RegExp(r'^Exception: '), '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        title: const Text(
          'Edit Profile',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        actions: [
          TextButton(
            onPressed: _isSaving ? null : _saveProfile,
            child: _isSaving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.primary,
                    ),
                  )
                : const Text(
                    'Save',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_errorMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.error.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.error.withOpacity(0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: AppColors.error, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: const TextStyle(color: AppColors.error, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Display Name
              const Text(
                'Display Name',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _displayNameController,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppColors.surface,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: AppColors.glassBorder),
                  ),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return 'Display name is required';
                  return null;
                },
              ),

              const SizedBox(height: 16),

              // Username
              const Text(
                'Username',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _usernameController,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: InputDecoration(
                  prefixText: '@ ',
                  prefixStyle: const TextStyle(color: AppColors.textSecondary),
                  filled: true,
                  fillColor: AppColors.surface,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: AppColors.glassBorder),
                  ),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) return 'Username is required';
                  if (!RegExp(r'^[a-zA-Z0-9_]{3,30}$').hasMatch(val.trim())) {
                    return '3-30 alphanumeric characters or underscores';
                  }
                  return null;
                },
              ),

              const SizedBox(height: 16),

              // Bio
              const Text(
                'Bio',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              const Text(
                'Strict Zero-Location Invariant: Any coordinates, cities, or proximity references are sanitized.',
                style: TextStyle(color: AppColors.textMuted, fontSize: 11),
              ),
              const SizedBox(height: 6),
              TextFormField(
                controller: _bioController,
                maxLines: 3,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppColors.surface,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: AppColors.glassBorder),
                  ),
                ),
              ),

              const SizedBox(height: 24),

              // Social Links
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Social Links',
                    style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  if (_links.length < 5)
                    TextButton.icon(
                      onPressed: _addSocialLink,
                      icon: const Icon(Icons.add, size: 18, color: AppColors.primary),
                      label: const Text('Add Link', style: TextStyle(color: AppColors.primary)),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              if (_links.isEmpty)
                const Text(
                  'No links added yet (max 5).',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                )
              else
                ..._links.asMap().entries.map((entry) {
                  final index = entry.key;
                  final link = entry.value;
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.glassBorder),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.link, color: AppColors.accentCyan, size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                link.title,
                                style: const TextStyle(
                                  color: AppColors.textPrimary,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
                              Text(
                                link.url,
                                style: const TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 12,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, color: AppColors.textSecondary, size: 18),
                          onPressed: () {
                            setState(() {
                              _links.removeAt(index);
                            });
                          },
                        ),
                      ],
                    ),
                  );
                }),

              const SizedBox(height: 24),

              // Privacy Controls Section
              const Text(
                'Privacy Controls',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),

              SwitchListTile(
                value: _isPrivate,
                activeColor: AppColors.primary,
                contentPadding: EdgeInsets.zero,
                title: const Text('Private Account', style: TextStyle(color: AppColors.textPrimary)),
                subtitle: const Text(
                  'Only approved followers can view your reels and collections.',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
                onChanged: (val) => setState(() => _isPrivate = val),
              ),

              SwitchListTile(
                value: _hideFollowerCount,
                activeColor: AppColors.primary,
                contentPadding: EdgeInsets.zero,
                title: const Text('Hide Follower Count', style: TextStyle(color: AppColors.textPrimary)),
                subtitle: const Text(
                  'Follower numbers are hidden from visiting users.',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
                onChanged: (val) => setState(() => _hideFollowerCount = val),
              ),

              SwitchListTile(
                value: _hideFollowingCount,
                activeColor: AppColors.primary,
                contentPadding: EdgeInsets.zero,
                title: const Text('Hide Following Count', style: TextStyle(color: AppColors.textPrimary)),
                subtitle: const Text(
                  'Following numbers are hidden from visiting users.',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
                onChanged: (val) => setState(() => _hideFollowingCount = val),
              ),

              const SizedBox(height: 16),

              // Allow Tagging Dropdown
              const Text(
                'Who can tag you',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                value: _allowTagging,
                dropdownColor: AppColors.surface,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppColors.surface,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: AppColors.glassBorder),
                  ),
                ),
                items: const [
                  DropdownMenuItem(value: 'EVERYONE', child: Text('Everyone')),
                  DropdownMenuItem(value: 'FOLLOWING', child: Text('People You Follow')),
                  DropdownMenuItem(value: 'NOBODY', child: Text('No One')),
                ],
                onChanged: (val) {
                  if (val != null) setState(() => _allowTagging = val);
                },
              ),

              const SizedBox(height: 16),

              // Allow Mentions Dropdown
              const Text(
                'Who can @mention you',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                value: _allowMentions,
                dropdownColor: AppColors.surface,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppColors.surface,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: AppColors.glassBorder),
                  ),
                ),
                items: const [
                  DropdownMenuItem(value: 'EVERYONE', child: Text('Everyone')),
                  DropdownMenuItem(value: 'FOLLOWING', child: Text('People You Follow')),
                  DropdownMenuItem(value: 'NOBODY', child: Text('No One')),
                ],
                onChanged: (val) {
                  if (val != null) setState(() => _allowMentions = val);
                },
              ),

              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
}
