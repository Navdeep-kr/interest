class StoryHighlightModel {
  final String id;
  final String title;
  final String coverUrl;
  final List<String> storyIds;
  final int storyCount;
  final DateTime createdAt;

  const StoryHighlightModel({
    required this.id,
    required this.title,
    required this.coverUrl,
    required this.storyIds,
    required this.storyCount,
    required this.createdAt,
  });

  factory StoryHighlightModel.fromJson(Map<String, dynamic> json) {
    return StoryHighlightModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      coverUrl: json['coverUrl'] as String? ?? '',
      storyIds: (json['storyIds'] as List?)?.cast<String>() ?? [],
      storyCount: (json['storyCount'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'coverUrl': coverUrl,
    'storyIds': storyIds,
    'storyCount': storyCount,
    'createdAt': createdAt.toIso8601String(),
  };
}
