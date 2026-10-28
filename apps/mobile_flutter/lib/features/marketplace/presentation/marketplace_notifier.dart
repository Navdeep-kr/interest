import 'package:flutter/foundation.dart';
import '../domain/models/marketplace_models.dart';
import '../data/marketplace_repository.dart';

class MarketplaceState {
  final bool isLoading;
  final String? errorMessage;
  final MarketplaceDemandMetricsModel? demandMetrics;
  final MarketplaceEligibilityModel? eligibility;
  final CreatorPortfolioModel? portfolio;
  final List<BrandCampaignModel> campaigns;
  final BrandCampaignModel? selectedCampaign;
  final String? selectedInterestFilter;

  const MarketplaceState({
    this.isLoading = false,
    this.errorMessage,
    this.demandMetrics,
    this.eligibility,
    this.portfolio,
    this.campaigns = const [],
    this.selectedCampaign,
    this.selectedInterestFilter,
  });

  MarketplaceState copyWith({
    bool? isLoading,
    String? errorMessage,
    MarketplaceDemandMetricsModel? demandMetrics,
    MarketplaceEligibilityModel? eligibility,
    CreatorPortfolioModel? portfolio,
    List<BrandCampaignModel>? campaigns,
    BrandCampaignModel? selectedCampaign,
    String? selectedInterestFilter,
  }) {
    return MarketplaceState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      demandMetrics: demandMetrics ?? this.demandMetrics,
      eligibility: eligibility ?? this.eligibility,
      portfolio: portfolio ?? this.portfolio,
      campaigns: campaigns ?? this.campaigns,
      selectedCampaign: selectedCampaign ?? this.selectedCampaign,
      selectedInterestFilter: selectedInterestFilter ?? this.selectedInterestFilter,
    );
  }
}

class MarketplaceNotifier extends ChangeNotifier {
  final MarketplaceRepository _repository;
  MarketplaceState _state = const MarketplaceState();

  MarketplaceNotifier({MarketplaceRepository? repository})
      : _repository = repository ?? MarketplaceRepository();

  MarketplaceState get state => _state;

  Future<void> loadMarketplaceData() async {
    _state = _state.copyWith(isLoading: true, errorMessage: null);
    notifyListeners();

    try {
      final metrics = await _repository.fetchDemandMetrics();
      final eligibility = await _repository.fetchEligibility();
      final portfolio = await _repository.fetchPortfolio('current_user');
      final campaigns = await _repository.fetchCampaigns();

      _state = _state.copyWith(
        isLoading: false,
        demandMetrics: metrics,
        eligibility: eligibility,
        portfolio: portfolio,
        campaigns: campaigns,
      );
    } catch (e) {
      _state = _state.copyWith(
        isLoading: false,
        errorMessage: 'Unable to load marketplace data. Please try again.',
      );
    }
    notifyListeners();
  }

  void filterByInterest(String? interestId) async {
    _state = _state.copyWith(selectedInterestFilter: interestId, isLoading: true);
    notifyListeners();

    try {
      final filtered = await _repository.fetchCampaigns(interestId: interestId);
      _state = _state.copyWith(isLoading: false, campaigns: filtered);
    } catch (_) {
      _state = _state.copyWith(isLoading: false);
    }
    notifyListeners();
  }

  Future<void> selectCampaign(String campaignId) async {
    _state = _state.copyWith(isLoading: true);
    notifyListeners();

    try {
      final campaign = await _repository.fetchCampaignById(campaignId);
      _state = _state.copyWith(isLoading: false, selectedCampaign: campaign);
    } catch (_) {
      _state = _state.copyWith(isLoading: false);
    }
    notifyListeners();
  }

  Future<bool> submitApplication({
    required String campaignId,
    required int proposedRateCents,
    required String pitchNote,
    List<String> portfolioSampleLinks = const [],
  }) async {
    _state = _state.copyWith(isLoading: true, errorMessage: null);
    notifyListeners();

    try {
      final success = await _repository.applyToCampaign(
        campaignId: campaignId,
        proposedRateCents: proposedRateCents,
        pitchNote: pitchNote,
        portfolioSampleLinks: portfolioSampleLinks,
      );

      _state = _state.copyWith(isLoading: false);
      notifyListeners();
      return success;
    } catch (e) {
      _state = _state.copyWith(
        isLoading: false,
        errorMessage: 'Application failed: ${e.toString()}',
      );
      notifyListeners();
      return false;
    }
  }
}
