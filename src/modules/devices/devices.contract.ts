import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { BaseFindAllRequest } from '../common/base.contract';

export const DEVICE_STATUS = ['CONNECTED', 'DISCONNECTED'] as const;
export type DeviceStatusType = (typeof DEVICE_STATUS)[number];

export class FindAllDeviceRequest extends BaseFindAllRequest {
  @ApiPropertyOptional({ enum: DEVICE_STATUS })
  @IsOptional()
  @IsEnum(DEVICE_STATUS)
  declare connectionStatus?: DeviceStatusType;
}

export class FindOneDeviceRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  declare deviceId: string;
}

export class CreateDeviceRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  declare serialNumber: string;
}

export class UpdateDeviceRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  declare serialNumber?: string;

  @ApiPropertyOptional({ enum: DEVICE_STATUS })
  @IsOptional()
  @IsEnum(DEVICE_STATUS)
  declare status?: DeviceStatusType;
}

export class DeleteDeviceRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === 'true' || value === true,
  )
  @IsBoolean()
  declare isForceDelete?: boolean;
}
