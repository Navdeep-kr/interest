import 'package:flutter/material.dart';
import 'core/config/env_config.dart';
import 'core/theme/app_colors.dart';
import 'core/theme/app_theme.dart';

import 'core/storage/secure_storage_service.dart';
import 'features/auth/data/auth_api_client.dart';
import 'features/auth/data/auth_repository.dart';
import 'features/auth/presentation/auth_notifier.dart';
import 'features/auth/presentation/auth_state.dart';
import 'features/auth/presentation/screens/login_screen.dart';
import 'features/auth/presentation/screens/security_settings_screen.dart';
import 'main_navigation_shell.dart';

/// Root application widget for the Interest platform.
class InterestApp extends StatefulWidget {
  final AuthNotifier? authNotifier;

  const InterestApp({super.key, this.authNotifier});

  @override
  State<InterestApp> createState() => _InterestAppState();
}

class _InterestAppState extends State<InterestApp> {
  late final AuthNotifier _authNotifier;

  @override
  void initState() {
    super.initState();
    _authNotifier = widget.authNotifier ??
        AuthNotifier(
          repository: AuthRepository(
            apiClient: AuthApiClient(),
            secureStorage: PlatformSecureStorageService(),
          ),
        );
    _authNotifier.checkInitialSession();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: EnvConfig.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: AnimatedBuilder(
        animation: _authNotifier,
        builder: (context, _) {
          final state = _authNotifier.state;
          if (state is AuthenticatedState) {
            return MainNavigationShell(authNotifier: _authNotifier);
          }
          return LoginScreen(authNotifier: _authNotifier);
        },
      ),
    );
  }
}

/// Initial foundation screen confirming environment configuration, theme, invariants, and auth state.
class FoundationHomeScreen extends StatelessWidget {
  final AuthNotifier? authNotifier;

  const FoundationHomeScreen({super.key, this.authNotifier});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header Brand Badge
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          gradient: AppColors.primaryGradient,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.flash_on, color: Colors.white, size: 22),
                      ),
                      const SizedBox(width: 12),
                      const Text(
                        'Interest',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.5,
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceElevated,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.glassBorder),
                    ),
                    child: Text(
                      EnvConfig.environment.name.toUpperCase(),
                      style: const TextStyle(
                        color: AppColors.accentPink,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 32),

              // Title
              const Text(
                'Foundation & Release Configuration',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Flutter 3.24.3 (Dart 3.5.3) • Zero-Location Protected',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 24),

              // Configuration Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.glassBorder),
                ),
                child: Column(
                  children: [
                    _buildInfoRow('Application ID', EnvConfig.appId, Icons.badge_outlined),
                    const Divider(color: AppColors.glassBorder, height: 20),
                    _buildInfoRow(
                      'API Base URL',
                      EnvConfig.apiBaseUrl,
                      Icons.cloud_outlined,
                      highlight: true,
                    ),
                    const Divider(color: AppColors.glassBorder, height: 20),
                    _buildInfoRow('WebSocket URL', EnvConfig.wsBaseUrl, Icons.cable_outlined),
                    const Divider(color: AppColors.glassBorder, height: 20),
                    _buildInfoRow(
                      'Zero-Location Policy',
                      EnvConfig.zeroLocationPolicy ? 'ENFORCED (0 Geo Permissions)' : 'VIOLATION',
                      Icons.shield_outlined,
                      statusColor: AppColors.success,
                    ),
                    const Divider(color: AppColors.glassBorder, height: 20),
                    _buildInfoRow(
                      'Mock Fallback Mode',
                      EnvConfig.mockModeEnabled ? 'ACTIVE (Dev only)' : 'DISABLED (Real APIs Only)',
                      Icons.data_object_outlined,
                      statusColor: EnvConfig.mockModeEnabled ? AppColors.warning : AppColors.success,
                    ),
                  ],
                ),
              ),

              if (authNotifier?.currentUser != null) ...[
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.primary.withOpacity(0.4)),
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 20,
                        backgroundColor: AppColors.primary.withOpacity(0.2),
                        child: Text(
                          authNotifier!.currentUser!.username.isNotEmpty
                              ? authNotifier!.currentUser!.username[0].toUpperCase()
                              : '?',
                          style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              authNotifier!.currentUser!.displayName,
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                            Text(
                              '@${authNotifier!.currentUser!.username}',
                              style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        ),
                        icon: const Icon(Icons.shield_outlined, size: 16, color: Colors.white),
                        label: const Text('Security', style: TextStyle(color: Colors.white, fontSize: 12)),
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => SecuritySettingsScreen(authNotifier: authNotifier!),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(
    String label,
    String value,
    IconData icon, {
    bool highlight = false,
    Color? statusColor,
  }) {
    return Row(
      children: [
        Icon(icon, size: 18, color: statusColor ?? AppColors.textMuted),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: TextStyle(
                  color: statusColor ?? (highlight ? AppColors.accentCyan : Colors.white),
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
