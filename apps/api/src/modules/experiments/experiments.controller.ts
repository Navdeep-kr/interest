import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ExperimentsService } from './experiments.service';
import {
  SetExperimentOverrideDto,
  UpdateExperimentStatusDto,
} from './dto/experiment.dto';

@Controller('experiments')
export class ExperimentsController {
  constructor(private readonly experimentsService: ExperimentsService) {}

  @Get()
  async listExperiments() {
    return this.experimentsService.listExperiments();
  }

  @Get(':id')
  async getExperiment(@Param('id') id: string) {
    return this.experimentsService.evaluateExperiment(id);
  }

  @Post(':id/override')
  @HttpCode(HttpStatus.OK)
  async setOverride(
    @Param('id') id: string,
    @Body() dto: SetExperimentOverrideDto,
  ) {
    this.experimentsService.setOverride(id, dto.userId, dto.variantId);
    return { success: true, experimentId: id, userId: dto.userId, variantId: dto.variantId };
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateExperimentStatusDto,
  ) {
    if (dto.winnerVariantId) {
      return this.experimentsService.concludeExperiment(id, dto.winnerVariantId);
    }
    return { success: true, experimentId: id, status: dto.status };
  }
}
