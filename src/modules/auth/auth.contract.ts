import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginRequest {
  @ApiProperty({ example: 'admin@gmail.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class SignupRequest {
  @ApiProperty({ example: 'Jane Doe' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsNotEmpty()
  @IsEmail()
  @Transform(({ value }) => value?.trim())
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class AuthTokensResponse {
  @ApiProperty()
  access_token!: string;

  @ApiProperty()
  refresh_token!: string;
}

export class LogoutResponse {
  @ApiProperty({ example: true })
  ok!: boolean;
}

export class GoogleLoginRequest {
  googleId!: string;
  name!: string;
  email?: string;
  picture?: string;
}

export class RefreshTokenRequest {
  userId!: string;
  email!: string;
  permissions!: Record<string, boolean>;
  refreshToken!: string;
}

export class RedirectParam {
  @ApiPropertyOptional({
    description:
      'Set false to return JSON tokens instead of redirecting to the frontend. Useful for Swagger/API clients.',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === 'true' || value === true,
  )
  @IsBoolean()
  isRedirect?: boolean;
}
