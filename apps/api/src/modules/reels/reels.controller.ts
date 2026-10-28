import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { ReelsService } from './reels.service';
import {
  CreatePresignedUrlDto,
  InitiateMultipartUploadDto,
  GetMultipartPartUrlsDto,
  CompleteMultipartUploadDto,
  AbortMultipartUploadDto,
  FinalizeReelDto,
  SuggestInterestsDto,
  CreateImagePostDto,
  UpdateReelDto,
  ReelPaginationDto,
} from './dto/reels.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('reels')
export class ReelsController {
  constructor(private readonly reelsService: ReelsService) {}

  // ==========================================================================
  // 1. VIDEO UPLOAD & MULTIPART INGESTION
  // ==========================================================================

  /**
   * Generates single-part presigned upload URL for smaller videos.
   */
  @Post('presigned-url')
  async createPresignedUrl(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreatePresignedUrlDto,
  ) {
    return this.reelsService.createPresignedUploadUrl(userId, dto);
  }

  /**
   * Initiates an S3 multipart upload session for resilient large video ingestion.
   */
  @Post('multipart/initiate')
  async initiateMultipartUpload(
    @CurrentUser('userId') userId: string,
    @Body() dto: InitiateMultipartUploadDto,
  ) {
    return this.reelsService.initiateMultipartUpload(userId, dto);
  }

  /**
   * Generates pre-signed upload URLs for designated part numbers.
   */
  @Post('multipart/part-urls')
  async getMultipartPartUrls(
    @CurrentUser('userId') userId: string,
    @Body() dto: GetMultipartPartUrlsDto,
  ) {
    return this.reelsService.getMultipartPartUrls(userId, dto);
  }

  /**
   * Completes the S3 multipart upload by verifying all ETags.
   */
  @Post('multipart/complete')
  async completeMultipartUpload(
    @CurrentUser('userId') userId: string,
    @Body() dto: CompleteMultipartUploadDto,
  ) {
    return this.reelsService.completeMultipartUpload(userId, dto);
  }

  /**
   * Aborts an incomplete multipart upload and releases storage allocations.
   */
  @Post('multipart/abort')
  async abortMultipartUpload(
    @CurrentUser('userId') userId: string,
    @Body() dto: AbortMultipartUploadDto,
  ) {
    return this.reelsService.abortMultipartUpload(userId, dto);
  }

  /**
   * Finalizes reel metadata (1-5 interest tags, title, caption) and queues BullMQ transcode.
   */
  @Post('finalize')
  async finalizeReel(@CurrentUser('userId') userId: string, @Body() dto: FinalizeReelDto) {
    return this.reelsService.finalizeReel(userId, dto);
  }

  /**
   * Status tracking endpoint: uploading -> processing -> live / rejected.
   */
  @Get(':id/status')
  async getReelStatus(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reelsService.getReelStatus(userId, id);
  }

  // ==========================================================================
  // 2. IMAGE & PHOTO POSTS
  // ==========================================================================

  /**
   * Direct creation of multi-image carousel or photo posts.
   */
  @Post('image-post')
  @HttpCode(HttpStatus.CREATED)
  async createImagePost(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateImagePostDto,
  ) {
    return this.reelsService.createImagePost(userId, dto);
  }

  // ==========================================================================
  // 3. EDIT & DELETE RULES
  // ==========================================================================

  /**
   * Updates reel caption, title, visibility, and pinned status (creator only).
   */
  @Patch(':id')
  async updateReel(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) reelId: string,
    @Body() dto: UpdateReelDto,
  ) {
    return this.reelsService.updateReel(userId, reelId, dto);
  }

  /**
   * Deletes a reel and decrements creator's published reels count.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteReel(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) reelId: string,
  ) {
    return this.reelsService.deleteReel(userId, reelId);
  }

  // ==========================================================================
  // 4. PINNING CONTENT
  // ==========================================================================

  /**
   * Pins a reel to creator's profile (max 3 pinned reels).
   */
  @Post(':id/pin')
  @HttpCode(HttpStatus.OK)
  async pinReel(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) reelId: string,
  ) {
    return this.reelsService.pinReel(userId, reelId);
  }

  /**
   * Unpins a reel from creator's profile.
   */
  @Delete(':id/pin')
  @HttpCode(HttpStatus.OK)
  async unpinReel(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) reelId: string,
  ) {
    return this.reelsService.unpinReel(userId, reelId);
  }

  // ==========================================================================
  // 5. CONTENT HIDING
  // ==========================================================================

  /**
   * Hides a reel from caller's feed and discovery.
   */
  @Post(':id/hide')
  @HttpCode(HttpStatus.OK)
  async hideReel(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) reelId: string,
  ) {
    return this.reelsService.hideReel(userId, reelId);
  }

  /**
   * Unhides a previously hidden reel.
   */
  @Delete(':id/hide')
  @HttpCode(HttpStatus.OK)
  async unhideReel(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) reelId: string,
  ) {
    return this.reelsService.unhideReel(userId, reelId);
  }

  // ==========================================================================
  // 6. DISCOVERY & RATIONALE
  // ==========================================================================

  /**
   * AI-powered interest tagging: auto-suggests 1-5 matching interest tags from video content.
   */
  @Post('suggest-interests')
  async suggestInterests(@Body() dto: SuggestInterestsDto) {
    return this.reelsService.suggestInterests(dto);
  }

  /**
   * Retrieves creator reels with pinned content on top and visibility enforcement.
   */
  @Public()
  @Get('creator/:creatorId')
  async getCreatorReels(
    @Param('creatorId', ParseUUIDPipe) creatorId: string,
    @Req() req: Request,
    @Query() query: ReelPaginationDto,
  ) {
    const viewerId = (req as any).user?.userId;
    return this.reelsService.getCreatorReels(
      creatorId,
      viewerId,
      query.limit || 20,
      query.cursor,
    );
  }

  /**
   * Fetches published reel by ID with viewer relationship and live counter synchronization.
   */
  @Public()
  @Get(':id')
  async getReel(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const currentUserId = (req as any).user?.userId;
    return this.reelsService.getReelById(id, currentUserId);
  }

  /**
   * "Why am I seeing this?" transparent interest-only rationale.
   */
  @Get(':id/why')
  async explainReel(@CurrentUser('userId') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.reelsService.explainReel(userId, id);
  }
}
