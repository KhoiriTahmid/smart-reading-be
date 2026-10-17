import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { DevicesService } from './devices.service';
import {
  CreateDeviceRequest,
  DeleteDeviceRequest,
  FindAllDeviceRequest,
  FindOneDeviceRequest,
  UpdateDeviceRequest,
} from './devices.contract';

@Controller('devices')
export class DevicesController {
  constructor(
    @Inject()
    private readonly devicesService: DevicesService,
  ) {}

  @Get()
  async findAll(@Query() query: FindAllDeviceRequest) {
    return await this.devicesService.findAll(query);
  }

  @Get(':deviceId')
  async findOne(@Param() params: FindOneDeviceRequest) {
    return await this.devicesService.findOne(params);
  }

  @Post()
  async create(@Body() body: CreateDeviceRequest, @Req() req: any) {
    return await this.devicesService.create({
      ...body,
      createdByUserId: req.user.userId,
      metaUser: req.user,
    });
  }

  @Patch(':deviceId')
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
  async restore(@Param() params: FindOneDeviceRequest) {
    return await this.devicesService.restore(params.deviceId);
  }

  @Delete(':deviceId')
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
