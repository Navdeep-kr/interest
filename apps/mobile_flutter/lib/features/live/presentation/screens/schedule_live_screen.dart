import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile/core/theme/app_colors.dart';
import '../live_notifier.dart';

class ScheduleLiveScreen extends StatefulWidget {
  final LiveNotifier notifier;

  const ScheduleLiveScreen({super.key, required this.notifier});

  @override
  State<ScheduleLiveScreen> createState() => _ScheduleLiveScreenState();
}

class _ScheduleLiveScreenState extends State<ScheduleLiveScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();

  String _selectedInterestId = 'interest_engineering_02';
  String _selectedInterestName = 'Software Engineering';
  bool _is18Plus = false;
  bool _recordSession = true;
  DateTime _scheduledTime = DateTime.now().add(const Duration(hours: 2));

  final List<Map<String, String>> _interests = [
    {'id': 'interest_engineering_02', 'name': 'Software Engineering'},
    {'id': 'interest_audio_04', 'name': 'Audio Production'},
    {'id': 'interest_design_01', 'name': 'UI/UX Design'},
    {'id': 'interest_photo_03', 'name': 'Photography & Film'},
    {'id': 'interest_data_05', 'name': 'Machine Learning'},
  ];

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submitSchedule() async {
    if (!_formKey.currentState!.validate()) return;

    final success = await widget.notifier.createEvent(
      title: _titleController.text.trim(),
      description: _descriptionController.text.trim(),
      interestId: _selectedInterestId,
      interestName: _selectedInterestName,
      scheduledStartTime: _scheduledTime.toIso8601String(),
      is18Plus: _is18Plus,
      recordSession: _recordSession,
    );

    if (success && mounted) {
      final streamKey = widget.notifier.state.createdStreamKey;
      if (streamKey != null) {
        _showStreamKeyModal(streamKey);
      } else {
        Navigator.of(context).pop();
      }
    }
  }

  Future<void> _pickDateTime() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _scheduledTime,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 90)),
    );
    if (date == null) return;
    if (!mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_scheduledTime),
    );
    if (time != null && mounted) {
      setState(() {
        _scheduledTime = DateTime(date.year, date.month, date.day, time.hour, time.minute);
      });
    }
  }

  void _showStreamKeyModal(String streamKey) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: AppColors.surface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Row(
            children: [
              Icon(Icons.key, color: AppColors.warning, size: 22),
              SizedBox(width: 8),
              Text('Secure Stream Key', style: TextStyle(color: Colors.white, fontSize: 16)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Your RTMP/WHIP cryptographic stream key has been generated. For security, this key is hashed with HMAC-SHA256 on the server and will NOT be shown again.',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.surfaceElevated,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.glassBorder),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        streamKey,
                        style: const TextStyle(
                          color: AppColors.accentCyan,
                          fontSize: 12,
                          fontFamily: 'monospace',
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.copy, size: 18, color: Colors.white70),
                      tooltip: 'Copy Key',
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: streamKey));
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Stream key copied to clipboard.')),
                        );
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              const Row(
                children: [
                  Icon(Icons.warning_amber_rounded, size: 14, color: AppColors.warning),
                  SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Keep this key secret. Never expose in live chat or client repos.',
                      style: TextStyle(color: AppColors.warning, fontSize: 11),
                    ),
                  ),
                ],
              ),
            ],
          ),
          actions: [
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onPressed: () {
                widget.notifier.clearCreatedStreamKey();
                Navigator.of(ctx).pop();
                Navigator.of(context).pop();
              },
              child: const Text('I Have Saved My Key', style: TextStyle(color: Colors.white)),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        title: const Text('Schedule Live Session', style: TextStyle(color: Colors.white, fontSize: 18)),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Title Input
            const Text('SESSION TITLE', style: TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            TextFormField(
              controller: _titleController,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'e.g. Distributed Consensus in Production',
                hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                filled: true,
                fillColor: AppColors.surface,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.glassBorder)),
              ),
              validator: (val) => val == null || val.trim().length < 5 ? 'Title must have at least 5 characters.' : null,
            ),
            const SizedBox(height: 16),

            // Description Input
            const Text('DESCRIPTION & AGENDA', style: TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            TextFormField(
              controller: _descriptionController,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Describe topics, live demos, and interactive Q&A format...',
                hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                filled: true,
                fillColor: AppColors.surface,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.glassBorder)),
              ),
              validator: (val) => val == null || val.trim().length < 10 ? 'Description must have at least 10 characters.' : null,
            ),
            const SizedBox(height: 16),

            // Interest Category
            const Text('INTEREST CATEGORY', style: TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            DropdownButtonFormField<String>(
              value: _selectedInterestId,
              dropdownColor: AppColors.surfaceElevated,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                filled: true,
                fillColor: AppColors.surface,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.glassBorder)),
              ),
              items: _interests.map((item) {
                return DropdownMenuItem(value: item['id'], child: Text(item['name']!));
              }).toList(),
              onChanged: (val) {
                if (val != null) {
                  setState(() {
                    _selectedInterestId = val;
                    _selectedInterestName = _interests.firstWhere((i) => i['id'] == val)['name']!;
                  });
                }
              },
            ),
            const SizedBox(height: 16),

            // Scheduled Start Time
            const Text('START TIME', style: TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            InkWell(
              onTap: _pickDateTime,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.glassBorder),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.calendar_today, size: 16, color: AppColors.accentCyan),
                    const SizedBox(width: 8),
                    Text(
                      '${_scheduledTime.month}/${_scheduledTime.day}/${_scheduledTime.year} at ${_scheduledTime.hour.toString().padLeft(2, '0')}:${_scheduledTime.minute.toString().padLeft(2, '0')}',
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                    ),
                    const Spacer(),
                    const Text('Change', style: TextStyle(color: AppColors.accentCyan, fontSize: 12)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Age Restriction Switch
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Restricted to 18+ Viewers', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600)),
              subtitle: const Text('Enforce age verification gate before viewing broadcast.', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
              activeColor: AppColors.warning,
              value: _is18Plus,
              onChanged: (val) => setState(() => _is18Plus = val),
            ),
            const Divider(color: AppColors.glassBorder),

            // Permitted Recording Switch
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Archive Recording (30-Day VOD)', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600)),
              subtitle: const Text('Make replay available to community members for 30 days.', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
              activeColor: AppColors.primary,
              value: _recordSession,
              onChanged: (val) => setState(() => _recordSession = val),
            ),
            const SizedBox(height: 32),

            // Schedule Button
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: _submitSchedule,
              child: const Text('Schedule & Generate Stream Key', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }
}
