import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from 'src/decorators/permission.decorator';
import { PermissionGuard } from 'src/guards/permission.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @Permissions(['DASHBOARD'])
  @ApiOperation({ summary: 'Get backend health latency and active OCR/TTS queue tasks' })
  @ApiOkResponse({ description: 'Dashboard system status summary' })
  async getSummary() {
    return await this.dashboardService.getSummary();
  }
}
