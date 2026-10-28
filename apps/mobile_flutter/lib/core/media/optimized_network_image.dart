import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_colors.dart';

class OptimizedNetworkImage extends StatelessWidget {
  final String imageUrl;
  final BoxFit fit;
  final double? width;
  final double? height;
  final int? targetCacheWidth;
  final int? targetCacheHeight;
  final Widget? placeholder;
  final Widget? errorWidget;

  const OptimizedNetworkImage({
    super.key,
    required this.imageUrl,
    this.fit = BoxFit.cover,
    this.width,
    this.height,
    this.targetCacheWidth,
    this.targetCacheHeight,
    this.placeholder,
    this.errorWidget,
  });

  @override
  Widget build(BuildContext context) {
    if (imageUrl.isEmpty) {
      return errorWidget ?? _defaultErrorWidget();
    }

    // Determine target decoding dimensions to prevent high-res bitmap RAM explosion
    final mediaQuery = MediaQuery.maybeOf(context);
    final dpr = mediaQuery?.devicePixelRatio ?? 2.0;

    int? computedCacheWidth = targetCacheWidth;
    int? computedCacheHeight = targetCacheHeight;

    if (computedCacheWidth == null && width != null && width! > 0) {
      computedCacheWidth = (width! * dpr).round();
    }
    if (computedCacheHeight == null && height != null && height! > 0) {
      computedCacheHeight = (height! * dpr).round();
    }

    // Cap maximum decode dimensions to 1080x1920 to protect low-RAM devices
    computedCacheWidth = computedCacheWidth?.clamp(64, 1080) ?? 720;
    computedCacheHeight = computedCacheHeight?.clamp(64, 1920);

    return Image.network(
      imageUrl,
      fit: fit,
      width: width,
      height: height,
      cacheWidth: computedCacheWidth,
      cacheHeight: computedCacheHeight,
      filterQuality: FilterQuality.low, // Lowest raster CPU cost during scrolling
      loadingBuilder: (context, child, loadingProgress) {
        if (loadingProgress == null) return child;
        return placeholder ??
            Container(
              color: AppColors.backgroundCard,
              child: Center(
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    value: loadingProgress.expectedTotalBytes != null
                        ? loadingProgress.cumulativeBytesLoaded /
                            loadingProgress.expectedTotalBytes!
                        : null,
                    valueColor: const AlwaysStoppedAnimation<Color>(AppColors.brandPrimary),
                  ),
                ),
              ),
            );
      },
      errorBuilder: (context, error, stackTrace) {
        return errorWidget ?? _defaultErrorWidget();
      },
    );
  }

  Widget _defaultErrorWidget() {
    return Container(
      color: AppColors.backgroundCard,
      child: const Center(
        child: Icon(Icons.broken_image_outlined, size: 36, color: AppColors.textSecondary),
      ),
    );
  }
}

/// Memory-bounded ImageProvider for avatars to prevent large bitmap allocations.
ImageProvider? appAvatarProvider(String? url, {int targetWidth = 100, int targetHeight = 100}) {
  if (url == null || url.trim().isEmpty) return null;
  return ResizeImage.resizeIfNeeded(targetWidth, targetHeight, NetworkImage(url));
}
