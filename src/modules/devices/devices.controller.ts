import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import {
  CreateDeviceRequest,
  DeleteDeviceRequest,
  FindAllDeviceRequest,
  FindOneDeviceRequest,
  UpdateDeviceRequest,
} from './devices.contract';
import { Permissions } from 'src/decorators/permission.decorator';
import { PermissionGuard } from 'src/guards/permission.guard';

@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  @Permissions(['DEVICE.LIST'])
  async findAll(@Query() query: FindAllDeviceRequest) {
    return await this.devicesService.findAll(query);
  }

  @Get(':deviceId')
  @Permissions(['DEVICE.DETAIL'])
  async findOne(@Param() params: FindOneDeviceRequest) {
    return await this.devicesService.findOne(params);
  }

  @Post()
  @Permissions(['DEVICE.CREATE'])
  async create(@Body() body: CreateDeviceRequest, @Req() req: any) {
    return await this.devicesService.create({
      ...body,
      createdByUserId: req.user.userId,
      metaUser: req.user,
    });
  }

  @Patch(':deviceId')
  @Permissions(['DEVICE.UPDATE'])
  async update(
    @Param() params: FindOneDeviceRequest,
    @Body() body: UpdateDeviceRequest,
  ) {
    return await this.devicesService.update({
      ...body,
      deviceId: params.deviceId,
    });
  }

  @Post(':deviceId/restore')
  @Permissions(['DEVICE.DELETE'])
  async restore(@Param() params: FindOneDeviceRequest) {
    return await this.devicesService.restore(params.deviceId);
  }

  @Delete(':deviceId')
  @Permissions(['DEVICE.DELETE'])
  async delete(
    @Param() params: FindOneDeviceRequest,
    @Query() query: DeleteDeviceRequest,
  ) {
    return await this.devicesService.delete({
      deviceId: params.deviceId,
      isForceDelete: query.isForceDelete,
    });
  }
}
