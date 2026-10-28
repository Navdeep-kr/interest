import '../domain/models/marketplace_models.dart';
import 'marketplace_api_client.dart';

class MarketplaceRepository {
  final MarketplaceApiClient _apiClient;

  MarketplaceRepository({
    MarketplaceApiClient? apiClient,
    dynamic storage,
  }) : _apiClient = apiClient ?? MarketplaceApiClient();

  Future<MarketplaceDemandMetricsModel> fetchDemandMetrics() async {
    return _apiClient.getDemandMetrics();
  }

  Future<MarketplaceEligibilityModel> fetchEligibility() async {
    return _apiClient.checkEligibility();
  }

  Future<CreatorPortfolioModel> fetchPortfolio(String creatorId) async {
    return _apiClient.getPortfolio(creatorId);
  }

  Future<List<BrandCampaignModel>> fetchCampaigns({String? interestId, String? status}) async {
    return _apiClient.getCampaigns(interestId: interestId, status: status);
  }

  Future<BrandCampaignModel> fetchCampaignById(String campaignId) async {
    return _apiClient.getCampaignById(campaignId);
  }

  Future<bool> applyToCampaign({
    required String campaignId,
    required int proposedRateCents,
    required String pitchNote,
    List<String> portfolioSampleLinks = const [],
  }) async {
    return _apiClient.applyToCampaign(
      campaignId: campaignId,
      proposedRateCents: proposedRateCents,
      pitchNote: pitchNote,
      portfolioSampleLinks: portfolioSampleLinks,
    );
  }
}
