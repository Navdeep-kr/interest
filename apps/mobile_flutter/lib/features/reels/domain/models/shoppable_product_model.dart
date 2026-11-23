class ShoppableProduct {
  final String id;
  final String title;
  final double price;
  final double? originalPrice;
  final String imageUrl;
  final String merchantName;
  final double rating;
  final int reviewCount;
  final bool inStock;
  final bool isSuperfanExclusiveDrop;
  final int? dropEarlyAccessHours;
  final double pinX; // 0.0 to 1.0 (relative canvas horizontal position)
  final double pinY; // 0.0 to 1.0 (relative canvas vertical position)

  const ShoppableProduct({
    required this.id,
    required this.title,
    required this.price,
    this.originalPrice,
    required this.imageUrl,
    required this.merchantName,
    this.rating = 4.8,
    this.reviewCount = 142,
    this.inStock = true,
    this.isSuperfanExclusiveDrop = false,
    this.dropEarlyAccessHours,
    this.pinX = 0.25,
    this.pinY = 0.65,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'price': price,
    'originalPrice': originalPrice,
    'imageUrl': imageUrl,
    'merchantName': merchantName,
    'rating': rating,
    'reviewCount': reviewCount,
    'inStock': inStock,
    'isSuperfanExclusiveDrop': isSuperfanExclusiveDrop,
    'dropEarlyAccessHours': dropEarlyAccessHours,
    'pinX': pinX,
    'pinY': pinY,
  };

  factory ShoppableProduct.fromJson(Map<String, dynamic> json) {
    return ShoppableProduct(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      originalPrice: (json['originalPrice'] as num?)?.toDouble(),
      imageUrl: json['imageUrl'] as String? ?? '',
      merchantName: json['merchantName'] as String? ?? 'Interest Store',
      rating: (json['rating'] as num?)?.toDouble() ?? 4.8,
      reviewCount: json['reviewCount'] as int? ?? 0,
      inStock: json['inStock'] as bool? ?? true,
      isSuperfanExclusiveDrop: json['isSuperfanExclusiveDrop'] as bool? ?? false,
      dropEarlyAccessHours: json['dropEarlyAccessHours'] as int?,
      pinX: (json['pinX'] as num?)?.toDouble() ?? 0.25,
      pinY: (json['pinY'] as num?)?.toDouble() ?? 0.65,
    );
  }
}
