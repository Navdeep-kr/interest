import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AiAssistantService } from './ai-assistant.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  QueryAiAssistantDto,
  SubmitAiQualityFeedbackDto,
  EnrollBetaDto,
} from './dto/ai-assistant.dto';

@Controller('ai-assistant')
export class AiAssistantController {
  constructor(private readonly aiAssistantService: AiAssistantService) {}

  @Post('query')
  @HttpCode(HttpStatus.OK)
  async queryAssistant(
    @CurrentUser('userId') userId: string,
    @Body() dto: QueryAiAssistantDto,
  ) {
    return this.aiAssistantService.queryAssistant(userId || 'guest_user', dto);
  }

  @Get('status')
  async getRateLimitStatus(@CurrentUser('userId') userId: string) {
    return this.aiAssistantService.getRateLimitStatus(userId || 'guest_user');
  }

  @Post('feedback')
  @HttpCode(HttpStatus.CREATED)
  async submitQualityFeedback(
    @CurrentUser('userId') userId: string,
    @Body() dto: SubmitAiQualityFeedbackDto,
  ) {
    return this.aiAssistantService.submitQualityFeedback(userId || 'guest_user', dto);
  }

  @Post('beta')
  @HttpCode(HttpStatus.OK)
  async enrollBeta(
    @CurrentUser('userId') userId: string,
    @Body() dto: EnrollBetaDto,
  ) {
    return this.aiAssistantService.enrollBeta(userId || 'guest_user', dto.enrolled);
  }

  @Public()
  @Get('metrics')
  async getFeedbackMetrics() {
    return this.aiAssistantService.getFeedbackMetrics();
  }
}
