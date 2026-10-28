import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { InteractionsService } from './interactions.service';
import {
  CreateCommentInputDto,
  ModerateCommentInputDto,
  CreateCollectionInputDto,
  AddReelToCollectionInputDto,
  ShareReelInputDto,
} from './dto/interactions.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  LikeToggleResponse,
  CommentLikeToggleResponse,
  CommentItem,
  CommentsResponseDto,
  SaveToggleResponse,
  CollectionItem,
  CollectionDetailsResponse,
  ShareResponse,
  FollowToggleResponse,
  FollowProfileItem,
  ReelRemixesResponse,
} from '@shared/types';

@Controller('interactions')
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  // ==========================================================================
  // LIKES
  // ==========================================================================

  @Post('reels/:id/like')
  @HttpCode(HttpStatus.OK)
  async toggleReelLike(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) reelId: string,
  ): Promise<LikeToggleResponse> {
    return this.interactionsService.toggleReelLike(userId, reelId);
  }

  @Post('comments/:id/like')
  @HttpCode(HttpStatus.OK)
  async toggleCommentLike(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) commentId: string,
  ): Promise<CommentLikeToggleResponse> {
    return this.interactionsService.toggleCommentLike(userId, commentId);
  }

  // ==========================================================================
  // THREADED COMMENTS & MODERATION
  // ==========================================================================

  @Public()
  @Get('reels/:id/comments')
  async getComments(
    @Param('id', ParseUUIDPipe) reelId: string,
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<CommentsResponseDto> {
    const currentUserId = (req as any).user?.userId;
    const parsedLimit = limit ? parseInt(limit, 10) : 30;
    return this.interactionsService.getComments(reelId, currentUserId, parsedLimit, cursor);
  }

  @Post('reels/:id/comments')
  @HttpCode(HttpStatus.CREATED)
  async addComment(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) reelId: string,
    @Body() dto: CreateCommentInputDto,
  ): Promise<CommentItem> {
    return this.interactionsService.addComment(userId, reelId, dto);
  }

  @Post('comments/:id/pin')
  @HttpCode(HttpStatus.OK)
  async pinComment(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) commentId: string,
  ): Promise<{ pinned: boolean; commentId: string }> {
    return this.interactionsService.pinComment(userId, commentId);
  }

  @Post('comments/:id/moderate')
  @HttpCode(HttpStatus.OK)
  async moderateComment(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) commentId: string,
    @Body() dto: ModerateCommentInputDto,
  ): Promise<{ success: boolean; action: string; commentId: string }> {
    return this.interactionsService.moderateComment(userId, commentId, dto);
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.OK)
  async deleteComment(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) commentId: string,
  ): Promise<{ success: boolean; action: string; commentId: string }> {
    return this.interactionsService.moderateComment(userId, commentId, { action: 'delete' });
  }

  // ==========================================================================
  // SAVES & COLLECTIONS
  // ==========================================================================

  @Post('reels/:id/save')
  @HttpCode(HttpStatus.OK)
  async toggleReelSave(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) reelId: string,
  ): Promise<SaveToggleResponse> {
    return this.interactionsService.toggleReelSave(userId, reelId);
  }

  @Get('collections')
  async getUserCollections(
    @CurrentUser('userId') userId: string,
  ): Promise<CollectionItem[]> {
    return this.interactionsService.getUserCollections(userId);
  }

  @Post('collections')
  @HttpCode(HttpStatus.CREATED)
  async createCollection(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateCollectionInputDto,
  ): Promise<CollectionItem> {
    return this.interactionsService.createCollection(userId, dto);
  }

  @Get('collections/:id/reels')
  async getCollectionReels(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) collectionId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<CollectionDetailsResponse> {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    return this.interactionsService.getCollectionReels(userId, collectionId, parsedLimit, parsedOffset);
  }

  @Post('collections/:id/reels')
  @HttpCode(HttpStatus.OK)
  async addReelToCollection(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) collectionId: string,
    @Body() dto: AddReelToCollectionInputDto,
  ): Promise<{ added: boolean; collectionId: string; reelId: string }> {
    return this.interactionsService.addReelToCollection(userId, collectionId, dto.reelId);
  }

  @Delete('collections/:id/reels/:reelId')
  @HttpCode(HttpStatus.OK)
  async removeReelFromCollection(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) collectionId: string,
    @Param('reelId', ParseUUIDPipe) reelId: string,
  ): Promise<{ removed: boolean; collectionId: string; reelId: string }> {
    return this.interactionsService.removeReelFromCollection(userId, collectionId, reelId);
  }

  // ==========================================================================
  // SHARES
  // ==========================================================================

  @Post('reels/:id/share')
  @HttpCode(HttpStatus.OK)
  async recordShare(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) reelId: string,
    @Body() dto: ShareReelInputDto,
  ): Promise<ShareResponse> {
    return this.interactionsService.recordShare(userId, reelId, dto.platform);
  }

  // ==========================================================================
  // FOLLOWS SOCIAL GRAPH
  // ==========================================================================

  @Post('users/:id/follow')
  @HttpCode(HttpStatus.OK)
  async toggleFollow(
    @CurrentUser('userId') followerId: string,
    @Param('id', ParseUUIDPipe) followingId: string,
  ): Promise<FollowToggleResponse> {
    return this.interactionsService.toggleFollow(followerId, followingId);
  }

  @Get('users/:id/followers')
  async getFollowers(
    @Param('id', ParseUUIDPipe) userId: string,
    @CurrentUser('userId') currentUserId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<FollowProfileItem[]> {
    const parsedLimit = limit ? parseInt(limit, 10) : 30;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    return this.interactionsService.getFollowers(userId, currentUserId, parsedLimit, parsedOffset);
  }

  @Get('users/:id/following')
  async getFollowing(
    @Param('id', ParseUUIDPipe) userId: string,
    @CurrentUser('userId') currentUserId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<FollowProfileItem[]> {
    const parsedLimit = limit ? parseInt(limit, 10) : 30;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    return this.interactionsService.getFollowing(userId, currentUserId, parsedLimit, parsedOffset);
  }

  // ==========================================================================
  // DUET & REMIX
  // ==========================================================================

  @Public()
  @Get('reels/:id/remixes')
  async getReelRemixes(
    @Param('id', ParseUUIDPipe) reelId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<ReelRemixesResponse> {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    return this.interactionsService.getReelRemixes(reelId, parsedLimit, parsedOffset);
  }
}
