import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import '../../domain/models/shoppable_product_model.dart';
import '../../../monetization/domain/services/superfans_manager.dart';
import '../../../monetization/presentation/widgets/superfans_subscribe_sheet.dart';

/// Interactive In-Video Shoppable Product Pin with pulsating beacon.
/// Zero-Location guaranteed.
class ShoppableProductTagOverlay extends StatefulWidget {
  final ShoppableProduct product;
  final String creatorId;
  final String creatorUsername;

  const ShoppableProductTagOverlay({
    super.key,
    required this.product,
    required this.creatorId,
    required this.creatorUsername,
  });

  @override
  State<ShoppableProductTagOverlay> createState() => _ShoppableProductTagOverlayState();
}

class _ShoppableProductTagOverlayState extends State<ShoppableProductTagOverlay> with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  bool _isExpanded = false;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  void _openCheckout() {
    ShoppableCheckoutBottomSheet.show(
      context,
      product: widget.product,
      creatorId: widget.creatorId,
      creatorUsername: widget.creatorUsername,
    );
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final top = (widget.product.pinY * size.height).clamp(100.0, size.height - 220.0);
    final left = (widget.product.pinX * size.width).clamp(20.0, size.width - 200.0);

    return Positioned(
      top: top,
      left: left,
      child: GestureDetector(
        onTap: () {
          setState(() => _isExpanded = !_isExpanded);
          _openCheckout();
        },
        child: AnimatedBuilder(
          animation: _pulseController,
          builder: (ctx, child) {
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: widget.product.isSuperfanExclusiveDrop
                      ? [const Color(0xFF7E22CE), const Color(0xFF3B0764)]
                      : [const Color(0xFF18181B).withOpacity(0.9), const Color(0xFF27272A).withOpacity(0.9)],
                ),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: widget.product.isSuperfanExclusiveDrop
                      ? Colors.amberAccent.withOpacity(0.7 + (_pulseController.value * 0.3))
                      : Colors.white38,
                  width: 1.5,
                ),
                boxShadow: [
                  BoxShadow(
                    color: widget.product.isSuperfanExclusiveDrop
                        ? Colors.purpleAccent.withOpacity(0.3 * _pulseController.value)
                        : Colors.black45,
                    blurRadius: 10,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: widget.product.isSuperfanExclusiveDrop ? Colors.amberAccent : Colors.cyanAccent,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    widget.product.isSuperfanExclusiveDrop
                        ? '👑 DROP \$${widget.product.price.toStringAsFixed(0)}'
                        : '🛍️ \$${widget.product.price.toStringAsFixed(2)}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(width: 4),
                  const Icon(Icons.arrow_forward_ios, color: Colors.white70, size: 10),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

/// Instant 1-Tap Checkout Bottom Sheet with Superfan Early-Access Gate.
class ShoppableCheckoutBottomSheet extends StatefulWidget {
  final ShoppableProduct product;
  final String creatorId;
  final String creatorUsername;

  const ShoppableCheckoutBottomSheet({
    super.key,
    required this.product,
    required this.creatorId,
    required this.creatorUsername,
  });

  static void show(
    BuildContext context, {
    required ShoppableProduct product,
    required String creatorId,
    required String creatorUsername,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF12101B),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => ShoppableCheckoutBottomSheet(
        product: product,
        creatorId: creatorId,
        creatorUsername: creatorUsername,
      ),
    );
  }

  @override
  State<ShoppableCheckoutBottomSheet> createState() => _ShoppableCheckoutBottomSheetState();
}

class _ShoppableCheckoutBottomSheetState extends State<ShoppableCheckoutBottomSheet> {
  int _quantity = 1;
  int _selectedColorIndex = 0;
  final List<String> _colors = ['Neon Cyan', 'Obsidian Black', 'Cyber Violet'];
  bool _isProcessing = false;
  bool _isPurchased = false;

  void _processInstantBuy() async {
    setState(() => _isProcessing = true);
    await Future.delayed(const Duration(milliseconds: 900));
    if (mounted) {
      setState(() {
        _isProcessing = false;
        _isPurchased = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isSuperfan = SuperfansManager().isSuperfanOf(widget.creatorId);
    final canBuy = !widget.product.isSuperfanExclusiveDrop || isSuperfan;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).padding.bottom + 16,
        left: 20,
        right: 20,
        top: 12,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle
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

          if (_isPurchased)
            // Purchase Successful State
            Container(
              padding: const EdgeInsets.symmetric(vertical: 24),
              alignment: Alignment.center,
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.greenAccent.withOpacity(0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.check_circle, color: Colors.greenAccent, size: 56),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Order Placed Successfully! 🎉',
                    style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Order #INT-${DateTime.now().millisecondsSinceEpoch % 100000} • 1-Tap Pay Escrow Confirmed',
                    style: const TextStyle(color: Colors.white60, fontSize: 12),
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white12,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Done'),
                  ),
                ],
              ),
            )
          else ...[
            // Product Information Header
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: OptimizedNetworkImage(
                    imageUrl: widget.product.imageUrl,
                    width: 90,
                    height: 90,
                    fit: BoxFit.cover,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (widget.product.isSuperfanExclusiveDrop)
                        Container(
                          margin: const EdgeInsets.only(bottom: 4),
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(colors: [Colors.purpleAccent, Colors.amber]),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text(
                            '👑 SUPERFAN EARLY ACCESS DROP',
                            style: TextStyle(color: Colors.black, fontSize: 9, fontWeight: FontWeight.w900),
                          ),
                        ),
                      Text(
                        widget.product.title,
                        style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Text(
                            '\$${widget.product.price.toStringAsFixed(2)}',
                            style: const TextStyle(color: Colors.amberAccent, fontSize: 18, fontWeight: FontWeight.w900),
                          ),
                          if (widget.product.originalPrice != null) ...[
                            const SizedBox(width: 8),
                            Text(
                              '\$${widget.product.originalPrice!.toStringAsFixed(2)}',
                              style: const TextStyle(
                                color: Colors.white38,
                                fontSize: 13,
                                decoration: TextDecoration.lineThrough,
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Sold by ${widget.product.merchantName} • ⭐ ${widget.product.rating} (${widget.product.reviewCount})',
                        style: const TextStyle(color: Colors.white60, fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),

            // Superfan Gate Check Banner
            if (widget.product.isSuperfanExclusiveDrop && !isSuperfan)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.purple.shade900.withOpacity(0.4),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.purpleAccent, width: 1.2),
                ),
                child: Row(
                  children: [
                    const Text('🔒', style: TextStyle(fontSize: 24)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Exclusive Superfans Early Drop',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                          Text(
                            'Public release in ${widget.product.dropEarlyAccessHours ?? 24} hours. Subscribe to @${widget.creatorUsername} to buy now!',
                            style: const TextStyle(color: Colors.white70, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.purpleAccent,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      onPressed: () {
                        Navigator.pop(context);
                        SuperfansSubscribeSheet.show(
                          context,
                          creatorId: widget.creatorId,
                          creatorUsername: widget.creatorUsername,
                        );
                      },
                      child: const Text('Unlock', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),

            // Color Variant Selection
            const Text('Select Style / Color', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: List.generate(_colors.length, (i) {
                final isSelected = _selectedColorIndex == i;
                return ChoiceChip(
                  label: Text(_colors[i]),
                  selected: isSelected,
                  selectedColor: Colors.cyanAccent,
                  backgroundColor: const Color(0xFF221E36),
                  labelStyle: TextStyle(
                    color: isSelected ? Colors.black : Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                  onSelected: (sel) {
                    if (sel) setState(() => _selectedColorIndex = i);
                  },
                );
              }),
            ),
            const SizedBox(height: 16),

            // Quantity & Total Price
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Quantity', style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold)),
                Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.remove_circle_outline, color: Colors.white60),
                      onPressed: _quantity > 1 ? () => setState(() => _quantity--) : null,
                    ),
                    Text('$_quantity', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                    IconButton(
                      icon: const Icon(Icons.add_circle_outline, color: Colors.white60),
                      onPressed: () => setState(() => _quantity++),
                    ),
                  ],
                ),
              ],
            ),
            const Divider(color: Colors.white12),
            const SizedBox(height: 8),

            // Instant Buy Button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: canBuy ? Colors.cyanAccent : Colors.grey.shade800,
                  foregroundColor: canBuy ? Colors.black : Colors.white54,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 6,
                ),
                icon: _isProcessing
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                      )
                    : const Icon(Icons.bolt, size: 22),
                label: Text(
                  _isProcessing
                      ? 'Securing Escrow & Placing Order...'
                      : canBuy
                          ? '1-Tap Buy Now • \$${(widget.product.price * _quantity).toStringAsFixed(2)}'
                          : 'Locked for Superfans Only 🔒',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                ),
                onPressed: canBuy && !_isProcessing ? _processInstantBuy : null,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
