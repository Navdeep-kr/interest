class CollectionItemModel {
  final String id;
  final String userId;
  final String name;
  final bool isPrivate;
  final int itemCount;
  final String? coverUrl;
  final String createdAt;

  const CollectionItemModel({
    required this.id,
    required this.userId,
    required this.name,
    required this.isPrivate,
    required this.itemCount,
    this.coverUrl,
    required this.createdAt,
  });

  factory CollectionItemModel.fromJson(Map<String, dynamic> json) {
    return CollectionItemModel(
      id: json['id'] as String? ?? '',
      userId: json['userId'] as String? ?? '',
      name: json['name'] as String? ?? '',
      isPrivate: json['isPrivate'] as bool? ?? true,
      itemCount: (json['itemCount'] as num?)?.toInt() ?? 0,
      coverUrl: json['coverUrl'] as String?,
      createdAt: json['createdAt'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'userId': userId,
        'name': name,
        'isPrivate': isPrivate,
        'itemCount': itemCount,
        'coverUrl': coverUrl,
        'createdAt': createdAt,
      };
}
