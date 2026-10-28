import { Controller, Get, Post, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto, ExploreQueryDto, RecordRecentSearchDto, TrendingWindowDto } from './dto/search.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * Unified or Tabbed Search API:
   * Supports type: 'all' | 'reels' | 'users' | 'hashtags' | 'interests' | 'audio' | 'communities'.
   * Personalizes relevance by interest affinity if user is authenticated.
   */
  @Public()
  @Get()
  async search(
    @CurrentUser('userId') userId: string | null,
    @Query() queryDto: SearchQueryDto,
  ) {
    return this.searchService.search(userId || null, queryDto);
  }

  /**
   * Safe Autocomplete API:
   * Live sanitized suggestions across topics, creators, hashtags, and communities.
   */
  @Public()
  @Get('autocomplete')
  async getAutocomplete(
    @Query('q') q: string,
    @Query('limit') limit?: number,
  ) {
    return this.searchService.getSafeAutocomplete(q || '', limit ? Number(limit) : 8);
  }

  /**
   * Transparent Trending Windows API:
   * Returns trending topics and hashtags with explicit velocity time window (24h, 72h, 7d).
   */
  @Public()
  @Get('trending')
  async getTrending(@Query() dto: TrendingWindowDto) {
    return this.searchService.getTransparentTrending(dto.window || '24h', dto.limit || 10);
  }

  /**
   * Recent Searches History Endpoints
   */
  @Get('recent')
  async getRecentSearches(
    @CurrentUser('userId') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.searchService.getRecentSearches(userId, limit ? Number(limit) : 10);
  }

  @Post('recent')
  async recordRecentSearch(
    @CurrentUser('userId') userId: string,
    @Body() dto: RecordRecentSearchDto,
  ) {
    await this.searchService.recordRecentSearch(userId, dto.queryText, dto.searchType || 'all');
    return { success: true };
  }

  @Delete('recent/:id')
  async deleteRecentSearch(
    @CurrentUser('userId') userId: string,
    @Param('id') searchId: string,
  ) {
    await this.searchService.deleteRecentSearch(userId, searchId);
    return { success: true };
  }

  @Delete('recent')
  async clearRecentSearches(@CurrentUser('userId') userId: string) {
    await this.searchService.clearRecentSearches(userId);
    return { success: true };
  }

  /**
   * Trending Interests API:
   * Returns top trending topics and niches over the last 7 days.
   */
  @Public()
  @Get('trending-interests')
  async getTrendingInterests(@Query('limit') limit?: number) {
    return this.searchService.getTrendingInterests(limit ? Number(limit) : 10);
  }

  /**
   * Explore Interests Dashboard API:
   * Aggregates trending interests, taxonomy clusters, audio tracks, and recommended topics.
   */
  @Public()
  @Get('explore')
  async getExplorePayload(@CurrentUser('userId') userId: string | null) {
    return this.searchService.getExplorePayload(userId || null);
  }

  /**
   * Audio Reels API:
   * Fetches reels that use a specific soundtrack.
   */
  @Public()
  @Get('audio/:id/reels')
  async getAudioReels(
    @Param('id') audioId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.searchService.getAudioReels(
      audioId,
      limit ? Number(limit) : 20,
      offset ? Number(offset) : 0,
    );
  }
}
