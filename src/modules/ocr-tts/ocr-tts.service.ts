import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { UnrecoverableError } from 'bullmq';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

export type TtsVoice = 'female' | 'male';
export type OcrLang = 'id' | 'en' | 'auto';

export interface OcrResult {
  text: string;
  lines?: number;
  avg_confidence?: number;
}

export interface TtsResult {
  audio_key: string;
  duration_seconds?: number;
  chars?: number;
}

export interface TtsParams {
  historyId: string;
  text: string;
  voice?: TtsVoice;
  lang?: OcrLang;
  rate?: string; // e.g. "-10%" or "+20%"
}

/**
 * The only place that knows about the FastAPI OCR/TTS service.
 *
 * Error policy (matches the FastAPI contract):
 *  - 4xx except 408/429 -> UnrecoverableError (BullMQ will NOT retry)
 *  - 408, 429, 5xx, timeouts, network errors -> plain Error (BullMQ retries with backoff)
 */
@Injectable()
export class OcrTtsService {
  private readonly logger = new Logger(OcrTtsService.name);
  private readonly ocrTimeoutMs: number;
  private readonly ttsTimeoutMs: number;

  constructor(
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    this.ocrTimeoutMs = Number(config.get('OCR_TIMEOUT_MS') ?? 120_000);
    this.ttsTimeoutMs = Number(config.get('TTS_TIMEOUT_MS') ?? 180_000);
  }

  async ocr(fileKey: string, lang?: OcrLang): Promise<OcrResult> {
    const data = await this.post<OcrResult>(
      '/ocr',
      { file_key: fileKey, ...(lang ? { lang } : {}) },
      this.ocrTimeoutMs,
    );
    if (typeof data?.text !== 'string') {
      throw new Error('Invalid response from OCR service (/ocr)');
    }
    return data;
  }

  async tts({ historyId, text, voice, lang, rate }: TtsParams): Promise<TtsResult> {
    const data = await this.post<TtsResult>(
      '/tts',
      { history_id: historyId, text, voice, ...(lang ? { lang } : {}), rate },
      this.ttsTimeoutMs,
    );
    if (typeof data?.audio_key !== 'string' || !data.audio_key) {
      throw new Error('Invalid response from OCR service (/tts)');
    }
    return data;
  }

  /** Cheap liveness check, e.g. for a health endpoint. Never throws. */
  async isHealthy(): Promise<boolean> {
    try {
      await firstValueFrom(this.http.get('/health', { timeout: 3_000 }));
      return true;
    } catch {
      return false;
    }
  }

  private async post<T>(
    path: string,
    body: object,
    timeout: number,
  ): Promise<T> {
    try {
      const res = await firstValueFrom(
        this.http.post<T>(path, body, { timeout }),
      );
      return res.data;
    } catch (e) {
      throw this.mapError(path, e);
    }
  }

  private mapError(path: string, e: unknown): Error {
    const err = e as AxiosError<{ detail?: unknown }>;
    const status = err.response?.status;

    if (status) {
      const detail =
        typeof err.response?.data?.detail === 'string'
          ? err.response.data.detail
          : '';
      const message = `${path} -> ${status}${detail ? `: ${detail}` : ''}`;

      if (status === 401 || status === 403) {
        // Misconfiguration (wrong API key). Fail loudly, retrying will not help.
        this.logger.error(`OCR service rejected our credentials (${status})`);
      }
      if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
        return new UnrecoverableError(message);
      }
      return new Error(message); // 408 / 429 / 5xx -> retry
    }

    // No HTTP response: timeout, ECONNREFUSED, DNS failure, ...
    return new Error(`${path} request failed: ${err.code ?? err.message}`);
  }
}
