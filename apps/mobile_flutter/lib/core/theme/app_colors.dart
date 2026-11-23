import 'package:flutter/material.dart';

/// Next-Generation Luxury Neon Aurora & Velvet Obsidian Color System.
/// Carefully calibrated for high contrast, OLED power efficiency, and glowing aesthetics.
class AppColors {
  // Backgrounds & Surfaces (Deep Cosmic Velvet & Obsidian)
  static const Color background = Color(0xFF090714); // Deep cosmic midnight velvet
  static const Color surface = Color(0xFF130F26); // Luminous card surface with deep violet warmth
  static const Color surfaceElevated = Color(0xFF1E1738); // Elevated acrylic specular surface
  static const Color glassBorder = Color(0x33A78BFA); // 20% violet-cyan specular edge highlight

  // Brand Neon Gradients & Key Accents
  static const Color primary = Color(0xFF8B5CF6); // Electric Amethyst / Ultraviolet
  static const Color secondary = Color(0xFFEC4899); // Vivid Neon Rose
  static const Color accentPink = Color(0xFFFF2A85); // Hyper Electric Fuchsia
  static const Color accentCyan = Color(0xFF00F0FF); // Pure Cyber Cyan
  static const Color accentGold = Color(0xFFFFB703); // Radiant Amber Gold
  static const Color accentViolet = Color(0xFFA855F7); // Royal Purple

  // Typography (Ultra-crisp legibility)
  static const Color textPrimary = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFFCBD5E1); // Slate 300 for clearer reading
  static const Color textMuted = Color(0xFF94A3B8); // Slate 400

  // Status & Feedback Colors
  static const Color success = Color(0xFF10B981); // Radiant Emerald
  static const Color error = Color(0xFFFF3366); // Neon Crimson
  static const Color warning = Color(0xFFFFB703); // Solar Gold
  static const Color info = Color(0xFF00F0FF); // Cyber Cyan

  // Semantic Aliases
  static const Color brandPrimary = primary;
  static const Color accentRed = error;
  static const Color backgroundPrimary = background;
  static const Color backgroundSecondary = surface;
  static const Color backgroundCard = surfaceElevated;
  static const Color divider = glassBorder;
  static const Color textTertiary = textMuted;

  // Signature World-Class Gradients
  /// Neon Aurora: Electric Violet -> Neon Pink -> Hyper Cyan
  static const LinearGradient primaryGradient = LinearGradient(
    colors: [
      Color(0xFF8B5CF6),
      Color(0xFFFF2A85),
      Color(0xFF00F0FF),
    ],
    stops: [0.0, 0.55, 1.0],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Multi-stop Aurora Wave
  static const LinearGradient auroraGradient = LinearGradient(
    colors: [
      Color(0xFF7928CA),
      Color(0xFFFF0080),
      Color(0xFF00F0FF),
      Color(0xFF7928CA),
    ],
    stops: [0.0, 0.35, 0.75, 1.0],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Cyberpunk Neon Matrix
  static const LinearGradient cyberGradient = LinearGradient(
    colors: [
      Color(0xFF00F0FF),
      Color(0xFF0072FF),
    ],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Sunset Mirage: Coral -> Golden Amber -> Plum
  static const LinearGradient sunsetGradient = LinearGradient(
    colors: [
      Color(0xFFFF416C),
      Color(0xFFFF4B2B),
      Color(0xFFFFB703),
    ],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Frosted Obsidian Glass Surface Gradient
  static const LinearGradient glassGradient = LinearGradient(
    colors: [
      Color(0x332A1F4D),
      Color(0x1A140F2D),
    ],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  /// Specular Border Gradient for luxury card edges
  static const LinearGradient specularBorderGradient = LinearGradient(
    colors: [
      Color(0x6600F0FF),
      Color(0x4DFF2A85),
      Color(0x1A8B5CF6),
    ],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}
