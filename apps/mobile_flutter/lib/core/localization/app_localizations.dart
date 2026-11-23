import 'package:flutter/material.dart';
import '../utils/haptic_service.dart';

class SupportedLanguage {
  final String code;
  final String name;
  final String nativeName;
  final String flag;
  final bool isRtl;

  const SupportedLanguage({
    required this.code,
    required this.name,
    required this.nativeName,
    required this.flag,
    this.isRtl = false,
  });
}

/// Central Localization Manager for Global Multi-Language & RTL Layout Mirroring.
class LocaleManager extends ChangeNotifier {
  static final LocaleManager _instance = LocaleManager._internal();
  factory LocaleManager() => _instance;
  LocaleManager._internal();

  static const List<SupportedLanguage> supportedLanguages = [
    SupportedLanguage(code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸'),
    SupportedLanguage(code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸'),
    SupportedLanguage(code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳'),
    SupportedLanguage(code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', isRtl: true),
    SupportedLanguage(code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵'),
    SupportedLanguage(code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷'),
    SupportedLanguage(code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷'),
    SupportedLanguage(code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪'),
    SupportedLanguage(code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩'),
    SupportedLanguage(code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺'),
    SupportedLanguage(code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩'),
    SupportedLanguage(code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳'),
  ];

  Locale _currentLocale = const Locale('en');

  Locale get currentLocale => _currentLocale;
  String get currentLanguageCode => _currentLocale.languageCode;

  bool get isRtl {
    final lang = supportedLanguages.firstWhere(
      (l) => l.code == _currentLocale.languageCode,
      orElse: () => supportedLanguages.first,
    );
    return lang.isRtl;
  }

  TextDirection get textDirection => isRtl ? TextDirection.rtl : TextDirection.ltr;

  void setLocale(String languageCode) {
    if (_currentLocale.languageCode != languageCode) {
      _currentLocale = Locale(languageCode);
      HapticService.selection();
      notifyListeners();
    }
  }

  String translate(String key) {
    return _translations[_currentLocale.languageCode]?[key] ??
        _translations['en']?[key] ??
        key;
  }

  static const Map<String, Map<String, String>> _translations = {
    'en': {
      'appName': 'Interest',
      'feed': 'Feed',
      'explore': 'Explore',
      'create': 'Create',
      'inbox': 'Inbox',
      'profile': 'Profile',
      'like': 'Like',
      'comment': 'Comment',
      'share': 'Share',
      'save': 'Save',
      'buyNow': '1-Tap Buy',
      'subscribe': 'Subscribe',
      'backstage': 'Live Backstage',
      'bounties': 'Video Bounties',
      'touchToView': 'Hold to View Snap',
      'decoyMode': 'Decoy Safe Mode',
      'dataSaver': 'Data Saver (Low Bandwidth)',
      'offlineCached': 'Viewing in Offline Mode',
    },
    'es': {
      'appName': 'Interest',
      'feed': 'Inicio',
      'explore': 'Explorar',
      'create': 'Crear',
      'inbox': 'Mensajes',
      'profile': 'Perfil',
      'like': 'Me gusta',
      'comment': 'Comentar',
      'share': 'Compartir',
      'save': 'Guardar',
      'buyNow': 'Comprar en 1 toque',
      'subscribe': 'Suscribirse',
      'backstage': 'Backstage en Vivo',
      'bounties': 'Desafíos de Video',
      'touchToView': 'Mantén presionado para ver',
      'decoyMode': 'Modo Señuelo Seguro',
      'dataSaver': 'Ahorro de Datos',
      'offlineCached': 'Modo sin conexión',
    },
    'hi': {
      'appName': 'Interest',
      'feed': 'फ़ीड',
      'explore': 'खोजें',
      'create': 'बनाएं',
      'inbox': 'संदेश',
      'profile': 'प्रोफ़ाइल',
      'like': 'पसंद करें',
      'comment': 'टिप्पणी',
      'share': 'साझा करें',
      'save': 'सहेजें',
      'buyNow': 'तुरंत खरीदें',
      'subscribe': 'सदस्यता लें',
      'backstage': 'लाइव बैकस्टेज',
      'bounties': 'वीडियो चुनौतियां',
      'touchToView': 'देखने के लिए दबाए रखें',
      'decoyMode': 'सुरक्षित छद्म मोड',
      'dataSaver': 'डेटा सेवर मोड',
      'offlineCached': 'ऑफ़लाइन मोड सक्रिय',
    },
    'ar': {
      'appName': 'إنترست',
      'feed': 'الرئيسية',
      'explore': 'استكشف',
      'create': 'إنشاء',
      'inbox': 'الرسائل',
      'profile': 'الملف الشخصي',
      'like': 'إعجاب',
      'comment': 'تعليق',
      'share': 'مشاركة',
      'save': 'حفظ',
      'buyNow': 'شراء بنقرة واحدة',
      'subscribe': 'اشتراك',
      'backstage': 'كواليس حية',
      'bounties': 'تحديات الفيديو',
      'touchToView': 'اضغط مع الاستمرار للعرض',
      'decoyMode': 'وضع التمويه الآمن',
      'dataSaver': 'توفير البيانات',
      'offlineCached': 'تصفح دون اتصال',
    },
    'ja': {
      'appName': 'Interest',
      'feed': 'フィード',
      'explore': '見つける',
      'create': '投稿',
      'inbox': 'メッセージ',
      'profile': 'マイページ',
      'like': 'いいね',
      'comment': 'コメント',
      'share': 'シェア',
      'save': '保存',
      'buyNow': 'ワンタップ購入',
      'subscribe': 'サブスク登録',
      'backstage': 'ライブ控室',
      'bounties': '動画バウンティ',
      'touchToView': '長押しで閲覧',
      'decoyMode': 'ステルスおとりモード',
      'dataSaver': 'データ節約モード',
      'offlineCached': 'オフライン表示中',
    },
    'fr': {
      'appName': 'Interest',
      'feed': 'Fil',
      'explore': 'Explorer',
      'create': 'Créer',
      'inbox': 'Boîte de réception',
      'profile': 'Profil',
      'like': 'J\'aime',
      'comment': 'Commenter',
      'share': 'Partager',
      'save': 'Enregistrer',
      'buyNow': 'Acheter en 1 clic',
      'subscribe': 'S\'abonner',
      'backstage': 'Coulisses en Direct',
      'bounties': 'Défis Vidéo',
      'touchToView': 'Maintenir pour afficher',
      'decoyMode': 'Mode Leurre Sécurisé',
      'dataSaver': 'Économiseur de données',
      'offlineCached': 'Consultation hors ligne',
    },
    'pt': {
      'appName': 'Interest',
      'feed': 'Início',
      'explore': 'Explorar',
      'create': 'Criar',
      'inbox': 'Mensagens',
      'profile': 'Perfil',
      'like': 'Curtir',
      'comment': 'Comentar',
      'share': 'Compartilhar',
      'save': 'Salvar',
      'buyNow': 'Comprar em 1 toque',
      'subscribe': 'Inscrever-se',
      'backstage': 'Bastidores ao Vivo',
      'bounties': 'Desafios de Vídeo',
      'touchToView': 'Segure para visualizar',
      'decoyMode': 'Modo Camuflagem Seguro',
      'dataSaver': 'Economia de Dados',
      'offlineCached': 'Modo Offline Ativo',
    },
    'zh': {
      'appName': 'Interest',
      'feed': '动态',
      'explore': '探索',
      'create': '创作',
      'inbox': '消息',
      'profile': '我的',
      'like': '赞',
      'comment': '评论',
      'share': '分享',
      'save': '收藏',
      'buyNow': '一键闪购',
      'subscribe': '订阅会员',
      'backstage': '独家连麦后台',
      'bounties': '悬赏挑战',
      'touchToView': '按住查看快照',
      'decoyMode': '防查备用安全模式',
      'dataSaver': '极简省流模式',
      'offlineCached': '离线缓存浏览',
    },
  };
}
