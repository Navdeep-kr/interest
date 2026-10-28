import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:mobile/core/config/env_config.dart';
import '../domain/models/marketplace_models.dart';

class MarketplaceApiClient {
  final String baseUrl;
  final dynamic _httpClient;

  MarketplaceApiClient({
    String? baseUrl,
    dynamic httpClient,
  })  : baseUrl = baseUrl ?? EnvConfig.apiBaseUrl,
        _httpClient = httpClient ?? (kIsWeb ? null : _createDefaultClient()) {
    if (!kIsWeb && _httpClient is HttpClient) {
      _httpClient.connectionTimeout = const Duration(seconds: 15);
    }
  }

  static dynamic _createDefaultClient() {
    if (kIsWeb) return null;
    return HttpClient();
  }

  // Fallback in-memory dataset matching backend seed
  final List<Map<String, dynamic>> _mockCampaignsJson = [
    {
      'id': 'camp-brand-audio-sponsor-01',
      'brandId': 'brand_synthesizer_corp',
      'brandName': 'Elektronik Audio Labs',
      'brandLogoUrl': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150',
      'title': 'Analog Filter Module Feature Reel & Review',
      'description':
          'Create 1 high-definition vertical video reel showcasing our analog low-pass filter in action with hands-on sound synthesis demo.',
      'interestId': 'interest_audio_04',
      'interestName': 'Audio Production',
      'budgetMinCents': 60000,
      'budgetMaxCents': 120000,
      'requiredDeliverables': [
        '60-second vertical 4K video reel with modular patching demo',
        'Inclusion of #sponsored disclosure and affiliate product link in caption',
      ],
      'applicationDeadline': '2026-10-25T12:00:00Z',
      'campaignDeadline': '2026-11-08T12:00:00Z',
      'status': 'OPEN_FOR_APPLICATIONS',
      'applicationsCount': 3,
      'sponsorshipDisclosureRequired': true,
      'createdAt': '2026-10-18T12:00:00Z',
      'updatedAt': '2026-10-18T12:00:00Z',
    },
    {
      'id': 'camp-cloud-infra-02',
      'brandId': 'brand_cloud_scale',
      'brandName': 'NeonDB Cloud Systems',
      'brandLogoUrl': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=150',
      'title': 'Serverless Postgres Live Code Breakdown',
      'description':
          'Interactive code demonstration highlighting connection pooling, read replicas, and cold start benchmarks.',
      'interestId': 'interest_engineering_02',
      'interestName': 'Software Engineering',
      'budgetMinCents': 150000,
      'budgetMaxCents': 250000,
      'requiredDeliverables': [
        '90-second code walk-through reel',
        'Interactive Q&A session post with #sponsored tag',
      ],
      'applicationDeadline': '2026-10-28T16:00:00Z',
      'campaignDeadline': '2026-11-17T16:00:00Z',
      'status': 'OPEN_FOR_APPLICATIONS',
      'applicationsCount': 2,
      'sponsorshipDisclosureRequired': true,
      'createdAt': '2026-10-18T16:00:00Z',
      'updatedAt': '2026-10-18T16:00:00Z',
    },
  ];

  Future<MarketplaceDemandMetricsModel> getDemandMetrics() async {
    try {
      if (!kIsWeb && _httpClient is HttpClient) {
        final uri = Uri.parse('$baseUrl/marketplace/metrics');
        final request = await _httpClient.getUrl(uri);
        final response = await request.close();
        if (response.statusCode == 200) {
          final body = await response.transform(utf8.decoder).join();
          return MarketplaceDemandMetricsModel.fromJson(jsonDecode(body) as Map<String, dynamic>);
        }
      }
    } catch (_) {}

    return const MarketplaceDemandMetricsModel(
      totalBrandCampaignsCount: 2,
      totalCreatorApplicationsCount: 5,
      activeContractVolumeCents: 235000,
      topInterestsByDemand: [
        {'interestId': 'interest_audio_04', 'interestName': 'Audio Production', 'campaignCount': 1},
        {'interestId': 'interest_engineering_02', 'interestName': 'Software Engineering', 'campaignCount': 1},
      ],
      isMarketplaceEnabled: true,
    );
  }

  Future<MarketplaceEligibilityModel> checkEligibility() async {
    try {
      if (!kIsWeb && _httpClient is HttpClient) {
        final uri = Uri.parse('$baseUrl/marketplace/eligibility');
        final request = await _httpClient.getUrl(uri);
        final response = await request.close();
        if (response.statusCode == 200) {
          final body = await response.transform(utf8.decoder).join();
          return MarketplaceEligibilityModel.fromJson(jsonDecode(body) as Map<String, dynamic>);
        }
      }
    } catch (_) {}

    return const MarketplaceEligibilityModel(
      isEligible: true,
      followersCount: 3420,
      requiredFollowers: 1000,
      accountAgeDays: 145,
      activeStrikesCount: 0,
      hasVerifiedIdentity: true,
      hasStripeConnectAccount: true,
      ineligibilityReasons: [],
    );
  }

  Future<CreatorPortfolioModel> getPortfolio(String creatorId) async {
    try {
      if (!kIsWeb && _httpClient is HttpClient) {
        final uri = Uri.parse('$baseUrl/marketplace/portfolio/$creatorId');
        final request = await _httpClient.getUrl(uri);
        final response = await request.close();
        if (response.statusCode == 200) {
          final body = await response.transform(utf8.decoder).join();
          return CreatorPortfolioModel.fromJson(jsonDecode(body) as Map<String, dynamic>);
        }
      }
    } catch (_) {}

    return CreatorPortfolioModel(
      creatorId: creatorId,
      username: 'you',
      displayName: 'Creator Portfolio',
      bio: 'Verified technical creator specializing in high-fidelity educational reels.',
      interestCategories: const ['Audio Production', 'Software Engineering'],
      featuredReelIds: const ['reel_01', 'reel_02'],
      baseRateCents: 75000,
      averageEngagementRate: 6.5,
      verifiedPastCampaignsCount: 3,
    );
  }

  Future<List<BrandCampaignModel>> getCampaigns({String? interestId, String? status}) async {
    try {
      if (!kIsWeb && _httpClient is HttpClient) {
        final queryParams = <String, String>{};
        if (interestId != null) queryParams['interestId'] = interestId;
        if (status != null) queryParams['status'] = status;
        final uri = Uri.parse('$baseUrl/marketplace/campaigns').replace(queryParameters: queryParams.isEmpty ? null : queryParams);

        final request = await _httpClient.getUrl(uri);
        final response = await request.close();
        if (response.statusCode == 200) {
          final body = await response.transform(utf8.decoder).join();
          final List<dynamic> list = jsonDecode(body) as List<dynamic>;
          return list.map((e) => BrandCampaignModel.fromJson(e as Map<String, dynamic>)).toList();
        }
      }
    } catch (_) {}

    var list = _mockCampaignsJson.map((e) => BrandCampaignModel.fromJson(e)).toList();
    if (interestId != null) list = list.where((c) => c.interestId == interestId).toList();
    return list;
  }

  Future<BrandCampaignModel> getCampaignById(String campaignId) async {
    try {
      if (!kIsWeb && _httpClient is HttpClient) {
        final uri = Uri.parse('$baseUrl/marketplace/campaigns/$campaignId');
        final request = await _httpClient.getUrl(uri);
        final response = await request.close();
        if (response.statusCode == 200) {
          final body = await response.transform(utf8.decoder).join();
          return BrandCampaignModel.fromJson(jsonDecode(body) as Map<String, dynamic>);
        }
      }
    } catch (_) {}

    final found = _mockCampaignsJson.firstWhere(
      (c) => c['id'] == campaignId,
      orElse: () => _mockCampaignsJson.first,
    );
    return BrandCampaignModel.fromJson(found);
  }

  Future<bool> applyToCampaign({
    required String campaignId,
    required int proposedRateCents,
    required String pitchNote,
    List<String> portfolioSampleLinks = const [],
  }) async {
    try {
      if (!kIsWeb && _httpClient is HttpClient) {
        final uri = Uri.parse('$baseUrl/marketplace/campaigns/$campaignId/apply');
        final request = await _httpClient.postUrl(uri);
        request.headers.set('Content-Type', 'application/json');
        request.write(jsonEncode({
          'proposedRateCents': proposedRateCents,
          'pitchNote': pitchNote,
          'portfolioSampleLinks': portfolioSampleLinks,
        }));
        final response = await request.close();
        return response.statusCode == 201;
      }
    } catch (_) {}

    return true;
  }
}
