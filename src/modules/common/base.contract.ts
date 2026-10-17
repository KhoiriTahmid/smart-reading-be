import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

const STATUS = ['active', 'archive', 'all'] as const;
export type StatusType = (typeof STATUS)[number];

export class BaseFindAllRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  declare search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  limit: number = 10;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;

  @ApiPropertyOptional({ enum: STATUS })
  @IsOptional()
  @IsEnum(STATUS)
  status: StatusType = 'all';
}

export class BaseUserInfoRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  declare createdByUserId: string;

  @ApiProperty()
  @IsNotEmptyObject()
  @IsObject()
  declare metaUser: any;
}
