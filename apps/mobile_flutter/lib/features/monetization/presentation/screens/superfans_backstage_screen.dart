import 'dart:async';
import 'package:flutter/material.dart';
import 'package:mobile/core/media/optimized_network_image.dart';
import '../../domain/services/superfans_manager.dart';
import '../widgets/superfans_subscribe_sheet.dart';

/// Live Drop-in Backstage Audio & Video Lounge exclusively for paying Superfans.
/// Zero-Location guaranteed.
class SuperfansBackstageScreen extends StatefulWidget {
  final String creatorId;
  final String creatorUsername;
  final String? creatorAvatarUrl;

  const SuperfansBackstageScreen({
    super.key,
    required this.creatorId,
    required this.creatorUsername,
    this.creatorAvatarUrl,
  });

  @override
  State<SuperfansBackstageScreen> createState() => _SuperfansBackstageScreenState();
}

class _SuperfansBackstageScreenState extends State<SuperfansBackstageScreen> with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  bool _isHandRaised = false;
  bool _isMuted = true;
  final List<String> _floatingReactions = [];
  Timer? _reactionCleanupTimer;

  final List<Map<String, dynamic>> _stageSpeakers = [
    {
      'username': 'synth_coder',
      'displayName': 'Alex Rivera (Host)',
      'avatar': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
      'role': 'Host',
      'isSpeaking': true,
    },
    {
      'username': 'elena_dev',
      'displayName': 'Elena Rostova',
      'avatar': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
      'role': 'VIP Speaker',
      'isSpeaking': false,
    },
  ];

  final List<Map<String, dynamic>> _audienceMembers = [
    {
      'username': 'sarah_design',
      'avatar': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200',
      'tier': 'Founder 💎',
    },
    {
      'username': 'marcus_code',
      'avatar': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
      'tier': 'VIP 👑',
    },
    {
      'username': 'chloe_art',
      'avatar': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
      'tier': 'Superfan 🟣',
    },
    {
      'username': 'jake_music',
      'avatar': 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200',
      'tier': 'Superfan 🟣',
    },
    {
      'username': 'amara_writer',
      'avatar': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      'tier': 'VIP 👑',
    },
  ];

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _reactionCleanupTimer?.cancel();
    super.dispose();
  }

  void _triggerReaction(String emoji) {
    setState(() {
      _floatingReactions.add(emoji);
    });
    Timer(const Duration(milliseconds: 1500), () {
      if (mounted) {
        setState(() {
          if (_floatingReactions.isNotEmpty) {
            _floatingReactions.removeAt(0);
          }
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final manager = SuperfansManager();
    final isSubscriber = manager.isSuperfanOf(widget.creatorId);

    return Scaffold(
      backgroundColor: const Color(0xFF0F0C20),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.redAccent.withOpacity(0.8),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.mic, color: Colors.white, size: 12),
                      SizedBox(width: 4),
                      Text('LIVE BACKSTAGE', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '@${widget.creatorUsername}',
                  style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 2),
            const Text(
              '48 VIP Superfans in room',
              style: TextStyle(color: Colors.white60, fontSize: 11),
            ),
          ],
        ),
        centerTitle: true,
      ),
      body: Stack(
        children: [
          // Background ambient gradient
          Positioned(
            top: -100,
            right: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.purple.withOpacity(0.25),
              ),
            ),
          ),
          Positioned(
            bottom: 100,
            left: -100,
            child: Container(
              width: 250,
              height: 250,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.deepPurpleAccent.withOpacity(0.18),
              ),
            ),
          ),

          // Main Room Content
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!isSubscriber)
                Container(
                  margin: const EdgeInsets.all(16),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Colors.purple.shade900.withOpacity(0.9), Colors.indigo.shade900.withOpacity(0.9)],
                    ),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.purpleAccent, width: 1.5),
                  ),
                  child: Row(
                    children: [
                      const Text('🔒', style: TextStyle(fontSize: 28)),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Superfans-Only Audio Lounge',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Subscribe to @${widget.creatorUsername} to participate on stage, speak, and access recordings.',
                              style: const TextStyle(color: Colors.white70, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.purpleAccent,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        ),
                        onPressed: () {
                          SuperfansSubscribeSheet.show(
                            context,
                            creatorId: widget.creatorId,
                            creatorUsername: widget.creatorUsername,
                            creatorAvatarUrl: widget.creatorAvatarUrl,
                          );
                        },
                        child: const Text('Unlock', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                ),

              // Stage Section Title
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                child: Row(
                  children: [
                    const Icon(Icons.podcasts, color: Colors.purpleAccent, size: 18),
                    const SizedBox(width: 8),
                    const Text(
                      'STAGE SPEAKERS',
                      style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.green.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Text('High-Fidelity Audio', style: TextStyle(color: Colors.greenAccent, fontSize: 10)),
                    ),
                  ],
                ),
              ),

              // Stage Speakers Row
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: _stageSpeakers.map((speaker) {
                    final isSpeaking = speaker['isSpeaking'] as bool;
                    return Column(
                      children: [
                        AnimatedBuilder(
                          animation: _pulseController,
                          builder: (ctx, child) {
                            return Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: isSpeaking
                                      ? Colors.purpleAccent.withOpacity(0.5 + (_pulseController.value * 0.5))
                                      : Colors.transparent,
                                  width: 3,
                                ),
                                boxShadow: isSpeaking
                                    ? [
                                        BoxShadow(
                                          color: Colors.purpleAccent.withOpacity(0.4 * _pulseController.value),
                                          blurRadius: 16,
                                          spreadRadius: 4,
                                        ),
                                      ]
                                    : null,
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(40),
                                child: OptimizedNetworkImage(
                                  imageUrl: speaker['avatar'] as String,
                                  width: 76,
                                  height: 76,
                                  fit: BoxFit.cover,
                                ),
                              ),
                            );
                          },
                        ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              speaker['displayName'] as String,
                              style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                            ),
                            if (isSpeaking) ...[
                              const SizedBox(width: 4),
                              const Icon(Icons.volume_up, color: Colors.purpleAccent, size: 14),
                            ],
                          ],
                        ),
                        Text(
                          speaker['role'] as String,
                          style: const TextStyle(color: Colors.white54, fontSize: 11),
                        ),
                      ],
                    );
                  }).toList(),
                ),
              ),

              const SizedBox(height: 24),
              const Divider(color: Colors.white12, indent: 20, endIndent: 20),

              // Superfan Audience Section
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: [
                    Icon(Icons.people_alt, color: Colors.amber, size: 18),
                    SizedBox(width: 8),
                    Text(
                      'SUPERFANS IN ATTENDANCE',
                      style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1),
                    ),
                  ],
                ),
              ),

              // Audience Grid
              Expanded(
                child: GridView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 4,
                    childAspectRatio: 0.82,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                  itemCount: _audienceMembers.length,
                  itemBuilder: (ctx, i) {
                    final member = _audienceMembers[i];
                    return Column(
                      children: [
                        Stack(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(28),
                              child: OptimizedNetworkImage(
                                imageUrl: member['avatar'] as String,
                                width: 56,
                                height: 56,
                                fit: BoxFit.cover,
                              ),
                            ),
                            Positioned(
                              bottom: 0,
                              right: 0,
                              child: Container(
                                padding: const EdgeInsets.all(2),
                                decoration: const BoxDecoration(
                                  color: Colors.black87,
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.mic_off, color: Colors.white60, size: 12),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          member['username'] as String,
                          style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w500),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          member['tier'] as String,
                          style: const TextStyle(color: Colors.purpleAccent, fontSize: 9, fontWeight: FontWeight.bold),
                          maxLines: 1,
                        ),
                      ],
                    );
                  },
                ),
              ),

              // Floating Reactions Area
              if (_floatingReactions.isNotEmpty)
                Container(
                  height: 40,
                  alignment: Alignment.centerRight,
                  padding: const EdgeInsets.only(right: 24),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: _floatingReactions.map((emoji) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: Text(emoji, style: const TextStyle(fontSize: 24)),
                      );
                    }).toList(),
                  ),
                ),

              // Bottom Interaction & Soundboard Bar
              Container(
                padding: EdgeInsets.only(
                  left: 16,
                  right: 16,
                  top: 12,
                  bottom: MediaQuery.of(context).padding.bottom + 12,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFF16122C),
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.5),
                      blurRadius: 16,
                      offset: const Offset(0, -4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    // Raise Hand button
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _isHandRaised ? Colors.amber : const Color(0xFF2B254E),
                        foregroundColor: _isHandRaised ? Colors.black : Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      ),
                      icon: Text(_isHandRaised ? '✋' : '👋', style: const TextStyle(fontSize: 16)),
                      label: Text(
                        _isHandRaised ? 'Hand Raised' : 'Raise Hand',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                      onPressed: () {
                        setState(() => _isHandRaised = !_isHandRaised);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(_isHandRaised ? 'Hand raised to speak on stage!' : 'Hand lowered'),
                            duration: const Duration(seconds: 1),
                          ),
                        );
                      },
                    ),
                    const SizedBox(width: 8),

                    // Mute Toggle
                    IconButton(
                      icon: Icon(
                        _isMuted ? Icons.mic_off : Icons.mic,
                        color: _isMuted ? Colors.white60 : Colors.greenAccent,
                      ),
                      tooltip: _isMuted ? 'Unmute' : 'Mute',
                      onPressed: () => setState(() => _isMuted = !_isMuted),
                    ),

                    const Spacer(),

                    // Soundboard & Reaction Emojis
                    ...['👏', '🔥', '💎', '❤️'].map((emoji) {
                      return GestureDetector(
                        onTap: () => _triggerReaction(emoji),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          child: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: const BoxDecoration(
                              color: Color(0xFF262044),
                              shape: BoxShape.circle,
                            ),
                            child: Text(emoji, style: const TextStyle(fontSize: 18)),
                          ),
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
