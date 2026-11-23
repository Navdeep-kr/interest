import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_colors.dart';

class AiDubbingLanguage {
  final String code;
  final String name;
  final String flag;
  final String voiceStyle;
  final bool isClone;

  const AiDubbingLanguage({
    required this.code,
    required this.name,
    required this.flag,
    required this.voiceStyle,
    this.isClone = true,
  });

  static const List<AiDubbingLanguage> supportedLanguages = [
    AiDubbingLanguage(code: 'en', name: 'English', flag: '🇺🇸', voiceStyle: 'Original Creator Voice', isClone: false),
    AiDubbingLanguage(code: 'es', name: 'Spanish', flag: '🇪🇸', voiceStyle: 'Neural Lip-Sync Clone'),
    AiDubbingLanguage(code: 'hi', name: 'Hindi', flag: '🇮🇳', voiceStyle: 'Natural Regional Accent'),
    AiDubbingLanguage(code: 'ja', name: 'Japanese', flag: '🇯🇵', voiceStyle: 'Anime Studio Acoustic'),
    AiDubbingLanguage(code: 'fr', name: 'French', flag: '🇫🇷', voiceStyle: 'Parisian AI Dub'),
  ];
}

class AiDubbingSelectorSheet extends StatefulWidget {
  final String currentLangCode;
  final Function(AiDubbingLanguage) onLanguageSelected;

  const AiDubbingSelectorSheet({
    super.key,
    required this.currentLangCode,
    required this.onLanguageSelected,
  });

  static Future<AiDubbingLanguage?> show(BuildContext context, {String currentCode = 'en'}) {
    return showModalBottomSheet<AiDubbingLanguage>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => AiDubbingSelectorSheet(
        currentLangCode: currentCode,
        onLanguageSelected: (lang) => Navigator.of(ctx).pop(lang),
      ),
    );
  }

  @override
  State<AiDubbingSelectorSheet> createState() => _AiDubbingSelectorSheetState();
}

class _AiDubbingSelectorSheetState extends State<AiDubbingSelectorSheet> {
  late String _selectedCode;

  @override
  void initState() {
    super.initState();
    _selectedCode = widget.currentLangCode;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      decoration: BoxDecoration(
        color: AppColors.backgroundSecondary,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(color: AppColors.primary.withOpacity(0.4)),
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Row(
              children: [
                Icon(Icons.translate, color: AppColors.primary, size: 22),
                SizedBox(width: 8),
                Text(
                  'AI Multi-Voice Auto-Dubbing',
                  style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 4),
            const Text(
              'Listen in your native language with zero-latency AI voice cloning & lip-sync.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
            const SizedBox(height: 18),

            ...AiDubbingLanguage.supportedLanguages.map((lang) {
              final isSelected = _selectedCode == lang.code;
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.primary.withOpacity(0.15) : AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isSelected ? AppColors.primary : Colors.white10,
                  ),
                ),
                child: ListTile(
                  leading: Text(lang.flag, style: const TextStyle(fontSize: 26)),
                  title: Row(
                    children: [
                      Text(lang.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                      const SizedBox(width: 8),
                      if (lang.isClone)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.purple.shade900,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text('AI CLONE', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                        ),
                    ],
                  ),
                  subtitle: Text(lang.voiceStyle, style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                  trailing: isSelected
                      ? const Icon(Icons.check_circle, color: AppColors.primary, size: 22)
                      : null,
                  onTap: () {
                    setState(() => _selectedCode = lang.code);
                    widget.onLanguageSelected(lang);
                  },
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}
