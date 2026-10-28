import 'package:flutter/material.dart';
import 'package:mobile/features/safety/domain/models/safety_models.dart';
import 'package:mobile/features/safety/data/safety_repository.dart';

class ReportContentDialog extends StatefulWidget {
  final ReportTargetType targetType;
  final String targetId;
  final String targetTitle;
  final String token;
  final SafetyRepository? repository;

  const ReportContentDialog({
    super.key,
    required this.targetType,
    required this.targetId,
    required this.targetTitle,
    required this.token,
    this.repository,
  });

  static Future<bool?> show(
    BuildContext context, {
    required ReportTargetType targetType,
    required String targetId,
    required String targetTitle,
    required String token,
    SafetyRepository? repository,
  }) {
    return showDialog<bool>(
      context: context,
      builder: (context) => ReportContentDialog(
        targetType: targetType,
        targetId: targetId,
        targetTitle: targetTitle,
        token: token,
        repository: repository,
      ),
    );
  }

  @override
  State<ReportContentDialog> createState() => _ReportContentDialogState();
}

class _ReportContentDialogState extends State<ReportContentDialog> {
  late final SafetyRepository _repository;
  ReportCategory _selectedCategory = ReportCategory.harassmentBullying;
  final _detailsController = TextEditingController();
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _repository = widget.repository ?? SafetyRepository();
  }

  @override
  void dispose() {
    _detailsController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final req = CreateReportRequest(
        targetType: widget.targetType,
        targetId: widget.targetId,
        category: _selectedCategory,
        details: _detailsController.text.trim(),
      );

      final res = await _repository.submitReport(req, token: widget.token);

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res.message),
          backgroundColor: res.isUrgent ? Colors.amber.shade900 : Colors.green.shade800,
        ),
      );

      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString().replaceFirst('Exception: ', '');
        _isSubmitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Report Content',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
          ),
          const SizedBox(height: 4),
          Text(
            widget.targetTitle,
            style: TextStyle(
              fontSize: 13,
              color: Colors.grey.shade400,
              fontWeight: FontWeight.normal,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
      content: SizedBox(
        width: double.maxFinite,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_selectedCategory.isUrgent)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.red.shade900.withOpacity(0.3),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red.shade400, width: 1),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.warning_amber_rounded, color: Colors.red.shade300, size: 20),
                      const SizedBox(width: 8),
                      const Expanded(
                        child: Text(
                          'Urgent Safety Escalation: Reviewed under 1-hour priority SLA.',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                ),
              const Text(
                'Why are you reporting this?',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<ReportCategory>(
                value: _selectedCategory,
                isExpanded: true,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                items: ReportCategory.values.map((cat) {
                  return DropdownMenuItem<ReportCategory>(
                    value: cat,
                    child: Text(
                      cat.displayName,
                      style: TextStyle(
                        fontSize: 13,
                        color: cat.isUrgent ? Colors.red.shade300 : null,
                        fontWeight: cat.isUrgent ? FontWeight.w600 : FontWeight.normal,
                      ),
                    ),
                  );
                }).toList(),
                onChanged: (cat) {
                  if (cat != null) {
                    setState(() {
                      _selectedCategory = cat;
                    });
                  }
                },
              ),
              const SizedBox(height: 16),
              const Text(
                'Additional details (optional):',
                style: TextStyle(fontSize: 13, color: Colors.grey),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: _detailsController,
                maxLines: 3,
                maxLength: 500,
                decoration: const InputDecoration(
                  hintText: 'Describe why this violates community guidelines...',
                  border: OutlineInputBorder(),
                ),
              ),
              if (_errorMessage != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    _errorMessage!,
                    style: const TextStyle(color: Colors.red, fontSize: 12),
                  ),
                ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          key: const Key('submit_report_button'),
          onPressed: _isSubmitting ? null : _handleSubmit,
          style: ElevatedButton.styleFrom(
            backgroundColor: _selectedCategory.isUrgent ? Colors.red.shade700 : null,
          ),
          child: _isSubmitting
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Submit Report'),
        ),
      ],
    );
  }
}
