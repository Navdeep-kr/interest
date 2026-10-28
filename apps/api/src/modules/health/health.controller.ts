import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  checkLiveness() {
    return this.healthService.getLiveness();
  }

  @Public()
  @Get('ready')
  async checkReadiness() {
    const health = await this.healthService.getReadiness();
    if (health.status === 'down') {
      throw new ServiceUnavailableException(health);
    }
    return health;
  }
}
