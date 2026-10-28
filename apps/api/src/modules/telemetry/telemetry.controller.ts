import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { TelemetryBatchDto } from './dto/telemetry.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  async ingestBatch(@CurrentUser('userId') userId: string, @Body() dto: TelemetryBatchDto) {
    return this.telemetryService.ingestBatch(userId, dto);
  }
}
