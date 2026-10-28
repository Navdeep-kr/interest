import { Controller, Get, Header, HttpCode, HttpStatus } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getPrometheusMetrics(): Promise<string> {
    return this.metricsService.getPrometheusMetrics();
  }

  @Public()
  @Get('json')
  @HttpCode(HttpStatus.OK)
  async getJsonMetrics(): Promise<Record<string, any>> {
    return this.metricsService.getMetricsSnapshot();
  }
}
