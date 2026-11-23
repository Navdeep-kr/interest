enum SupportedCurrency {
  usd,
  eur,
  inr,
  gbp,
  jpy,
  brl,
  aed,
}

class CurrencyInfo {
  final SupportedCurrency code;
  final String symbol;
  final double rateToUsd;
  final String displayName;

  const CurrencyInfo({
    required this.code,
    required this.symbol,
    required this.rateToUsd,
    required this.displayName,
  });
}

/// Global Currency Formatting & Regional Conversion Engine.
class CurrencyService {
  static SupportedCurrency _activeCurrency = SupportedCurrency.usd;

  static const Map<SupportedCurrency, CurrencyInfo> _currencies = {
    SupportedCurrency.usd: CurrencyInfo(code: SupportedCurrency.usd, symbol: '\$', rateToUsd: 1.0, displayName: 'USD - United States Dollar'),
    SupportedCurrency.eur: CurrencyInfo(code: SupportedCurrency.eur, symbol: '€', rateToUsd: 0.92, displayName: 'EUR - Euro'),
    SupportedCurrency.inr: CurrencyInfo(code: SupportedCurrency.inr, symbol: '₹', rateToUsd: 83.5, displayName: 'INR - Indian Rupee'),
    SupportedCurrency.gbp: CurrencyInfo(code: SupportedCurrency.gbp, symbol: '£', rateToUsd: 0.79, displayName: 'GBP - British Pound'),
    SupportedCurrency.jpy: CurrencyInfo(code: SupportedCurrency.jpy, symbol: '¥', rateToUsd: 154.2, displayName: 'JPY - Japanese Yen'),
    SupportedCurrency.brl: CurrencyInfo(code: SupportedCurrency.brl, symbol: 'R\$', rateToUsd: 5.15, displayName: 'BRL - Brazilian Real'),
    SupportedCurrency.aed: CurrencyInfo(code: SupportedCurrency.aed, symbol: 'د.إ', rateToUsd: 3.67, displayName: 'AED - UAE Dirham'),
  };

  static SupportedCurrency get activeCurrency => _activeCurrency;

  static void setCurrency(SupportedCurrency currency) {
    _activeCurrency = currency;
  }

  static String format(double usdAmount) {
    final info = _currencies[_activeCurrency] ?? _currencies[SupportedCurrency.usd]!;
    final converted = usdAmount * info.rateToUsd;

    if (_activeCurrency == SupportedCurrency.jpy) {
      return '${info.symbol}${converted.round()}';
    }
    return '${info.symbol}${converted.toStringAsFixed(2)}';
  }

  static List<CurrencyInfo> get allCurrencies => _currencies.values.toList();
}
