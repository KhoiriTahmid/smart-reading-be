import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseFindAllRequest } from '../common/base.contract';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class FindAllUserRequest extends BaseFindAllRequest {}

export class FindOneUserRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  declare userId: string;
}

export class CreateUserRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  declare name: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsEmail()
  declare email: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  declare roleId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  declare deviceId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  declare passwordHash?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  declare authProvider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  declare providerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  declare metaAdditionalData?: any;
}

export class UpdateUserRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  declare name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  declare email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  declare roleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  declare deviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  declare passwordHash?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  declare authProvider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  declare providerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  declare metaAdditionalData?: any;
}

export class DeleteUserRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === 'true' || value === true,
  )
  @IsBoolean()
  declare isForceDelete?: boolean;
}
