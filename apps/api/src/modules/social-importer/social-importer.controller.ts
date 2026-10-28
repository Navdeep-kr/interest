import { Controller, Post, Get, Body, Query, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { SocialImporterService } from './social-importer.service';
import {
  DirectSocialImportDto,
  PreviewExternalReelsDto,
  ExecuteReelsImportDto,
} from './dto/social-importer.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('social-import')
export class SocialImporterController {
  constructor(private readonly socialImporterService: SocialImporterService) {}

  /**
   * One-Click Social Profile & Content Import:
   * Users bypass standard signup by importing their Instagram/TikTok/YouTube
   * handle, avatar, bio, and existing craft reels.
   */
  @Public()
  @Post('direct-import')
  @HttpCode(HttpStatus.OK)
  async directSocialImport(
    @Body() dto: DirectSocialImportDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.socialImporterService.directSocialImport(dto, userAgent);
  }

  /**
   * Preview external reels before importing.
   */
  @Public()
  @Get('reels/preview')
  async previewExternalReels(@Query() query: PreviewExternalReelsDto) {
    return this.socialImporterService.previewExternalReels(query);
  }

  /**
   * Import external reels into an existing authenticated user's portfolio.
   */
  @Post('reels/execute')
  @HttpCode(HttpStatus.OK)
  async executeReelsImport(
    @CurrentUser('userId') userId: string,
    @Body() dto: ExecuteReelsImportDto,
  ) {
    return this.socialImporterService.executeReelsImport(userId, dto);
  }
}
