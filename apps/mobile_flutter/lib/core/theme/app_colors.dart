import 'package:flutter/material.dart';

/// Pure Obsidian Glass color system for the Interest social platform.
class AppColors {
  // Backgrounds & Surfaces
  static const Color background = Color(0xFF09090B); // Pure dark zinc
  static const Color surface = Color(0xFF18181B); // Card surface
  static const Color surfaceElevated = Color(0xFF27272A); // Elevated glass
  static const Color glassBorder = Color(0x1FFFFFFF); // 12% white border

  // Brand Gradients & Accents
  static const Color primary = Color(0xFF6366F1); // Indigo
  static const Color secondary = Color(0xFF8B5CF6); // Purple
  static const Color accentPink = Color(0xFFEC4899); // Pink
  static const Color accentCyan = Color(0xFF38BDF8); // Cyan

  // Typography
  static const Color textPrimary = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFFA1A1AA);
  static const Color textMuted = Color(0xFF71717A);

  // Status Colors
  static const Color success = Color(0xFF34D399); // Emerald
  static const Color error = Color(0xFFEF4444); // Red
  static const Color warning = Color(0xFFF59E0B); // Amber
  static const Color info = Color(0xFF38BDF8); // Sky blue

  // Semantic Aliases
  static const Color brandPrimary = primary;
  static const Color accentRed = error;
  static const Color accentGold = warning;
  static const Color backgroundPrimary = background;
  static const Color backgroundSecondary = surface;
  static const Color backgroundCard = surfaceElevated;
  static const Color divider = glassBorder;
  static const Color textTertiary = textMuted;

  // Brand Gradients
  static const LinearGradient primaryGradient = LinearGradient(
    colors: [primary, secondary, accentPink],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient glassGradient = LinearGradient(
    colors: [Color(0x3327272A), Color(0x1A18181B)],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );
}
