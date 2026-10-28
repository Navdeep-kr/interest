import 'package:flutter/material.dart';
import 'app.dart';
import 'core/config/env_config.dart';
import 'core/error/error_boundary.dart';
import 'core/performance/performance_profiler.dart';
import 'core/utils/app_logger.dart';

void main() {
  PerformanceProfiler().markColdLaunchStart();
  WidgetsFlutterBinding.ensureInitialized();

  // 1. Initialize Error Boundaries & Global Crash Handlers
  ErrorBoundary.initialize();

  // 2. Bound Flutter Image Cache Memory to Prevent High-Res Bitmap OOM Crashes
  PaintingBinding.instance.imageCache.maximumSizeBytes = 40 * 1024 * 1024; // 40 MB ceiling
  PaintingBinding.instance.imageCache.maximumSize = 60; // max 60 entries

  // 3. Initialize and Validate Environment Configuration
  try {
    EnvConfig.initialize();
    AppLogger.info(
      'Interest initialized in [${EnvConfig.environment.name.toUpperCase()}] mode. Zero-Location: ${EnvConfig.zeroLocationPolicy}',
    );
  } catch (e, stack) {
    AppLogger.error('Fatal configuration error during startup', error: e, stackTrace: stack);
    rethrow;
  }

  // 4. Launch Root Application
  runApp(const InterestApp());
}
