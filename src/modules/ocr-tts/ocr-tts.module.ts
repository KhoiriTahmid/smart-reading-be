import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { OcrTtsService } from './ocr-tts.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        baseURL: config.getOrThrow<string>('OCR_SERVICE_URL'),
        headers: {
          'x-api-key': config.getOrThrow<string>('OCR_SERVICE_API_KEY'),
        },
        maxRedirects: 0,
      }),
    }),
  ],
  providers: [OcrTtsService],
  exports: [OcrTtsService],
})
export class OcrClientModule {}
