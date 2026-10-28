import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  OAuthLoginDto,
  PhoneOtpRequestDto,
  PhoneOtpVerifyDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ChangePasswordDto,
  DeactivateAccountDto,
  ReactivateAccountDto,
} from './dto/auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @RateLimit({ points: 5, duration: 60 })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Headers('user-agent') userAgent?: string) {
    return this.authService.register(dto, userAgent);
  }

  @Public()
  @RateLimit({ points: 5, duration: 60 })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Headers('user-agent') userAgent?: string) {
    return this.authService.login(dto, userAgent);
  }

  @Public()
  @Post('oauth')
  @HttpCode(HttpStatus.OK)
  async oauthLogin(@Body() dto: OAuthLoginDto, @Headers('user-agent') userAgent?: string) {
    return this.authService.oauthLogin(dto, userAgent);
  }

  @Public()
  @RateLimit({ points: 5, duration: 60 })
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  async requestPhoneOtp(@Body() dto: PhoneOtpRequestDto) {
    return this.authService.requestPhoneOtp(dto);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyPhoneOtp(@Body() dto: PhoneOtpVerifyDto, @Headers('user-agent') userAgent?: string) {
    return this.authService.verifyPhoneOtp(dto, userAgent);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(@Body() dto: RefreshTokenDto, @Headers('user-agent') userAgent?: string) {
    return this.authService.refreshTokens(dto.refreshToken, dto.deviceName, userAgent);
  }

  @Public()
  @RateLimit({ points: 5, duration: 60 })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser('userId') userId: string,
    @CurrentUser('sessionId') sessionId?: string,
  ) {
    return this.authService.logout(userId, sessionId);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('userId') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto);
  }

  @Post('deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivateAccount(
    @CurrentUser('userId') userId: string,
    @Body() dto: DeactivateAccountDto,
  ) {
    return this.authService.deactivateAccount(userId, dto);
  }

  @Public()
  @RateLimit({ points: 5, duration: 60 })
  @Post('reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivateAccount(
    @Body() dto: ReactivateAccountDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.reactivateAccount(dto, userAgent);
  }

  @Get('sessions')
  async getSessions(
    @CurrentUser('userId') userId: string,
    @CurrentUser('sessionId') currentSessionId?: string,
  ) {
    return this.authService.getUserSessions(userId, currentSessionId);
  }

  @Delete('sessions/:id')
  async revokeSession(@CurrentUser('userId') userId: string, @Param('id') sessionId: string) {
    return this.authService.revokeSession(userId, sessionId);
  }

  @Delete('sessions')
  async revokeOtherSessions(
    @CurrentUser('userId') userId: string,
    @CurrentUser('sessionId') currentSessionId?: string,
  ) {
    return this.authService.revokeOtherSessions(userId, currentSessionId || '');
  }
}
