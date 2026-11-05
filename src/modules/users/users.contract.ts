import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { BaseFindAllRequest } from '../common/base.contract';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class FindAllUserRequest extends BaseFindAllRequest {}

export class FindOneUserRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  declare userId: string;
}

export class CreateUserRequestByEmail {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  declare roleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  declare deviceId?: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  declare password: string;

  @ApiPropertyOptional()
  @IsOptional()
  declare metaAdditionalData?: any;
}

export class CreateUserRequestByGoogle {
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
  @MaxLength(50)
  declare authProvider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  declare providerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  declare picture?: string;

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

export class UpdateProfileRequest extends OmitType(UpdateUserRequest, [
  'passwordHash',
  'authProvider',
  'providerId',
] as const) {}

export class DeleteUserRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === 'true' || value === true,
  )
  @IsBoolean()
  declare isForceDelete?: boolean;
}
