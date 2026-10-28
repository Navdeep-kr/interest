import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../utils/app_logger.dart';

/// Global error boundary and crash protection handler.
class ErrorBoundary {
  /// Initializes global framework and platform error listeners.
  static void initialize() {
    // 1. Flutter framework render errors
    FlutterError.onError = (FlutterErrorDetails details) {
      AppLogger.error(
        'FlutterError caught by framework boundary',
        error: details.exception,
        stackTrace: details.stack,
      );
      if (kDebugMode) {
        FlutterError.dumpErrorToConsole(details);
      }
    };

    // 2. Unhandled asynchronous and platform dispatcher errors
    PlatformDispatcher.instance.onError = (Object error, StackTrace stack) {
      AppLogger.error(
        'Unhandled asynchronous platform error caught by ErrorBoundary',
        error: error,
        stackTrace: stack,
      );
      return true; // Mark as handled
    };

    // 3. User-facing fallback widget during unexpected build phase crashes
    ErrorWidget.builder = (FlutterErrorDetails details) {
      return Material(
        color: const Color(0xFF09090B), // Obsidian Zinc background
        child: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: const Color(0xFF27272A),
                      borderRadius: BorderRadius.circular(28),
                      border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.4)),
                    ),
                    child: const Icon(
                      Icons.warning_amber_rounded,
                      color: Color(0xFFEF4444),
                      size: 28,
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Something went wrong',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    kDebugMode
                        ? details.exception.toString()
                        : 'Interest encountered an unexpected render issue. The error has been logged.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Color(0xFFA1A1AA),
                      fontSize: 13,
                      height: 1.4,
                    ),
                    maxLines: 4,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    };
  }
}
