import 'package:flutter/material.dart';
import 'app_colors.dart';
import '../utils/haptic_service.dart';

/// Pre-configured signature luxury theme palettes.
enum AppThemePalette {
  neonAurora,
  cyberTeal,
  sunsetLuxe,
  pureObsidian,
}

class ThemePaletteConfig {
  final AppThemePalette palette;
  final String name;
  final String description;
  final List<Color> previewColors;
  final Color primary;
  final Color secondary;
  final Color accent;
  final Color background;
  final Color surface;
  final Color surfaceElevated;
  final Color glassBorder;
  final LinearGradient gradient;

  const ThemePaletteConfig({
    required this.palette,
    required this.name,
    required this.description,
    required this.previewColors,
    required this.primary,
    required this.secondary,
    required this.accent,
    required this.background,
    required this.surface,
    required this.surfaceElevated,
    required this.glassBorder,
    required this.gradient,
  });
}

/// Global Theme Engine managing active aesthetic palettes across the entire application.
class ThemeManager extends ChangeNotifier {
  static final ThemeManager _instance = ThemeManager._internal();
  factory ThemeManager() => _instance;
  ThemeManager._internal();

  static const List<ThemePaletteConfig> availablePalettes = [
    ThemePaletteConfig(
      palette: AppThemePalette.neonAurora,
      name: 'Neon Aurora',
      description: 'Electric Violet, Vivid Fuchsia & Cyber Cyan over Cosmic Velvet',
      previewColors: [Color(0xFF8B5CF6), Color(0xFFFF2A85), Color(0xFF00F0FF)],
      primary: Color(0xFF8B5CF6),
      secondary: Color(0xFFFF2A85),
      accent: Color(0xFF00F0FF),
      background: Color(0xFF090714),
      surface: Color(0xFF130F26),
      surfaceElevated: Color(0xFF1E1738),
      glassBorder: Color(0x33A78BFA),
      gradient: AppColors.primaryGradient,
    ),
    ThemePaletteConfig(
      palette: AppThemePalette.cyberTeal,
      name: 'Cyberpunk Matrix',
      description: 'Pure Cyan, Neon Emerald & Deep Matrix Onyx',
      previewColors: [Color(0xFF00F0FF), Color(0xFF10B981), Color(0xFF0072FF)],
      primary: Color(0xFF00F0FF),
      secondary: Color(0xFF10B981),
      accent: Color(0xFF0072FF),
      background: Color(0xFF05080E),
      surface: Color(0xFF0B1320),
      surfaceElevated: Color(0xFF132034),
      glassBorder: Color(0x3300F0FF),
      gradient: LinearGradient(
        colors: [Color(0xFF00F0FF), Color(0xFF10B981)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
    ),
    ThemePaletteConfig(
      palette: AppThemePalette.sunsetLuxe,
      name: 'Sunset Mirage',
      description: 'Radiant Coral, Solar Amber & Royal Velvet Plum',
      previewColors: [Color(0xFFFF416C), Color(0xFFFF8C00), Color(0xFFFF2A85)],
      primary: Color(0xFFFF416C),
      secondary: Color(0xFFFF8C00),
      accent: Color(0xFFFFB703),
      background: Color(0xFF10070B),
      surface: Color(0xFF1F0E16),
      surfaceElevated: Color(0xFF2E1521),
      glassBorder: Color(0x33FF416C),
      gradient: AppColors.sunsetGradient,
    ),
    ThemePaletteConfig(
      palette: AppThemePalette.pureObsidian,
      name: 'Minimal Titanium',
      description: 'Deep OLED Black, Titanium Slate & Subtle Ice Blue',
      previewColors: [Color(0xFFFFFFFF), Color(0xFF38BDF8), Color(0xFF64748B)],
      primary: Color(0xFF38BDF8),
      secondary: Color(0xFFE2E8F0),
      accent: Color(0xFF94A3B8),
      background: Color(0xFF000000),
      surface: Color(0xFF111113),
      surfaceElevated: Color(0xFF1C1C1F),
      glassBorder: Color(0x26FFFFFF),
      gradient: LinearGradient(
        colors: [Color(0xFF38BDF8), Color(0xFF818CF8)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
    ),
  ];

  AppThemePalette _currentPalette = AppThemePalette.neonAurora;

  AppThemePalette get currentPalette => _currentPalette;

  ThemePaletteConfig get activeConfig => availablePalettes.firstWhere(
        (p) => p.palette == _currentPalette,
        orElse: () => availablePalettes[0],
      );

  void setPalette(AppThemePalette palette) {
    if (_currentPalette == palette) return;
    _currentPalette = palette;
    HapticService.selection();
    notifyListeners();
  }

  /// Generates dynamic Material 3 ThemeData reflecting the active palette.
  ThemeData get themeData {
    final cfg = activeConfig;
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: cfg.background,
      primaryColor: cfg.primary,
      colorScheme: ColorScheme.dark(
        primary: cfg.primary,
        secondary: cfg.secondary,
        surface: cfg.surface,
        error: AppColors.error,
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        onSurface: AppColors.textPrimary,
        onError: Colors.white,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: AppColors.textPrimary,
          fontSize: 20,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.5,
        ),
        iconTheme: IconThemeData(color: AppColors.textPrimary),
      ),
      cardTheme: CardTheme(
        color: cfg.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: cfg.glassBorder),
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: cfg.surface.withOpacity(0.95),
        selectedItemColor: cfg.primary,
        unselectedItemColor: AppColors.textMuted,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: cfg.primary,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.2,
          ),
        ),
      ),
      textTheme: const TextTheme(
        headlineLarge: TextStyle(
          color: AppColors.textPrimary,
          fontSize: 28,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.5,
        ),
        headlineMedium: TextStyle(
          color: AppColors.textPrimary,
          fontSize: 22,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
        ),
        titleLarge: TextStyle(
          color: AppColors.textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w700,
        ),
        bodyLarge: TextStyle(
          color: AppColors.textPrimary,
          fontSize: 15,
          fontWeight: FontWeight.w400,
        ),
        bodyMedium: TextStyle(
          color: AppColors.textSecondary,
          fontSize: 13,
          fontWeight: FontWeight.w400,
        ),
        labelSmall: TextStyle(
          color: AppColors.textMuted,
          fontSize: 11,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}
