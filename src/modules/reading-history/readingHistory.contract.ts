import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ReadingStatus } from './readingHistory.constants';
import {
  READING_LANGS,
  READING_VOICES,
  ReadingLang,
  ReadingVoice,
} from './readingHistory.pipeline';

export class CreateReadingHistoryRequest {
  @ApiProperty({ type: 'string', format: 'binary' })
  file: any;

  @ApiPropertyOptional({ enum: READING_VOICES, default: 'female' })
  @IsOptional()
  @IsIn([...READING_VOICES])
  voice?: ReadingVoice;

  @ApiPropertyOptional({ enum: READING_LANGS, default: 'id' })
  @IsOptional()
  @IsIn([...READING_LANGS])
  lang?: ReadingLang;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;
}

export class UpdateReadingHistoryRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}

export class FindOneReadingHistoryRequest {
  @ApiProperty()
  @IsUUID()
  declare historyId: string;
}

export class FindAllReadingHistoryRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['active', 'archive'], default: 'active' })
  @IsOptional()
  @IsIn(['active', 'archive'])
  status?: 'active' | 'archive' = 'active';

  @ApiPropertyOptional({ enum: Object.values(ReadingStatus) })
  @IsOptional()
  @IsIn(Object.values(ReadingStatus))
  readingStatus?: string;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

export class DeleteReadingHistoryRequest {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isForceDelete?: boolean;
}
