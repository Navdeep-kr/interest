import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { DeepLinkService } from './deep-link.service';
import {
  RegisterDeviceTokenDto,
  UnregisterDeviceTokenDto,
  UpdateNotificationPreferencesDto,
  GetNotificationsQueryDto,
  DispatchNotificationDto,
  ResolveDeepLinkDto,
} from './dto/notifications.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly deepLinkService: DeepLinkService,
  ) {}

  // ==========================================================================
  // INBOX & ACTIONS
  // ==========================================================================

  @Get()
  async getNotifications(@Request() req: any, @Query() query: GetNotificationsQueryDto) {
    return this.notificationsService.getNotifications(req.user.id, query);
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req: any) {
    const count = await this.notificationsService.getUnreadCount(req.user.id);
    return { unreadCount: count };
  }

  @Patch(':id/read')
  async markAsRead(@Request() req: any, @Param('id') notificationId: string) {
    return this.notificationsService.markAsRead(req.user.id, notificationId);
  }

  @Patch('read-all')
  async markAllAsRead(@Request() req: any) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  // ==========================================================================
  // PREFERENCES & QUIET HOURS
  // ==========================================================================

  @Get('preferences')
  async getPreferences(@Request() req: any) {
    return this.notificationsService.getPreferences(req.user.id);
  }

  @Put('preferences')
  async updatePreferences(
    @Request() req: any,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(req.user.id, dto);
  }

  // ==========================================================================
  // DEVICE TOKENS (FCM / APNs)
  // ==========================================================================

  @Post('devices')
  @HttpCode(HttpStatus.CREATED)
  async registerDevice(@Request() req: any, @Body() dto: RegisterDeviceTokenDto) {
    return this.notificationsService.registerDeviceToken(req.user.id, dto);
  }

  @Delete('devices')
  async unregisterDevice(@Request() req: any, @Body() dto: UnregisterDeviceTokenDto) {
    return this.notificationsService.unregisterDeviceToken(req.user.id, dto.token);
  }

  @Get('devices')
  async getDevices(@Request() req: any) {
    return this.notificationsService.getUserDeviceTokens(req.user.id);
  }

  // ==========================================================================
  // TEST DISPATCH
  // ==========================================================================

  @Post('test-dispatch')
  @HttpCode(HttpStatus.OK)
  async testDispatch(@Request() req: any, @Body() dto: DispatchNotificationDto) {
    return this.notificationsService.dispatchNotification({
      ...dto,
      userId: req.user.id,
    });
  }

  // ==========================================================================
  // DEEP LINK RESOLUTION
  // ==========================================================================

  @Post('deep-links/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveDeepLink(@Request() req: any, @Body() dto: ResolveDeepLinkDto) {
    return this.deepLinkService.resolveDeepLink(req.user.id, dto.url);
  }
}
