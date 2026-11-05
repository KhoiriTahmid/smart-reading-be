import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseFindAllRequest } from '../common/base.contract';
import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class FindAllRoleRequest extends BaseFindAllRequest {}
export class FindOneRequest {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  declare roleId: string;
}

export class CreateRoleRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  declare name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  declare description?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsObject()
  declare permissions: object;
}

export class UpdateRoleRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  declare name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  declare description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  declare permissions?: object;
}

export class DeleteRoleRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  declare isForceDelete: boolean;
}
