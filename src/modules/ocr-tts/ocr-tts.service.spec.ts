import { Logger } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import { of, throwError } from 'rxjs';
import { OcrTtsService } from './ocr-tts.service';

const httpError = (status?: number, detail?: string, code?: string) =>
  Object.assign(new Error('axios failed'), {
    code,
    response: status ? { status, data: detail ? { detail } : {} } : undefined,
  });

describe('OcrTtsService (FastAPI client)', () => {
  const http = { post: jest.fn(), get: jest.fn() };
  const config = { get: jest.fn() };
  let service: OcrTtsService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    config.get.mockReturnValue(undefined);
    service = new OcrTtsService(http as any, config as any);
  });

  describe('ocr', () => {
    it('posts file_key and lang and returns the result', async () => {
      http.post.mockReturnValue(of({ data: { text: 'Halo', lines: 1 } }));
      await expect(service.ocr('uploads/a.png', 'en')).resolves.toEqual({
        text: 'Halo',
        lines: 1,
      });
      expect(http.post).toHaveBeenCalledWith(
        '/ocr',
        { file_key: 'uploads/a.png', lang: 'en' },
        { timeout: 120_000 },
      );
    });

    it('omits lang when not provided', async () => {
      http.post.mockReturnValue(of({ data: { text: '' } }));
      await service.ocr('uploads/a.png');
      expect(http.post.mock.calls[0][1]).toEqual({ file_key: 'uploads/a.png' });
    });

    it('rejects a malformed response', async () => {
      http.post.mockReturnValue(of({ data: { nope: true } }));
      await expect(service.ocr('uploads/a.png')).rejects.toThrow(
        'Invalid response from OCR service (/ocr)',
      );
    });

    it('uses OCR_TIMEOUT_MS from config', async () => {
      config.get.mockImplementation((k: string) =>
        k === 'OCR_TIMEOUT_MS' ? '5000' : undefined,
      );
      service = new OcrTtsService(http as any, config as any);
      http.post.mockReturnValue(of({ data: { text: 'x' } }));
      await service.ocr('uploads/a.png');
      expect(http.post.mock.calls[0][2]).toEqual({ timeout: 5000 });
    });
  });

  describe('tts', () => {
    it('maps params to the snake_case FastAPI contract incl. lang', async () => {
      http.post.mockReturnValue(of({ data: { audio_key: 'audio/h.mp3' } }));
      await service.tts({
        historyId: 'h',
        text: 'Hello',
        voice: 'male',
        lang: 'auto',
      });
      expect(http.post).toHaveBeenCalledWith(
        '/tts',
        {
          history_id: 'h',
          text: 'Hello',
          voice: 'male',
          lang: 'auto',
          rate: undefined,
        },
        { timeout: 180_000 },
      );
    });

    it('rejects an empty audio_key', async () => {
      http.post.mockReturnValue(of({ data: { audio_key: '' } }));
      await expect(service.tts({ historyId: 'h', text: 't' })).rejects.toThrow(
        'Invalid response from OCR service (/tts)',
      );
    });
  });

  describe('error mapping (decides whether BullMQ retries)', () => {
    it.each([400, 401, 403, 404, 413, 422])(
      '%i -> UnrecoverableError (no retry)',
      async (status) => {
        http.post.mockReturnValue(throwError(() => httpError(status, 'bad')));
        const err = await service.ocr('uploads/a.png').catch((e) => e);
        expect(err).toBeInstanceOf(UnrecoverableError);
        expect(err.message).toBe(`/ocr -> ${status}: bad`);
      },
    );

    it.each([408, 429, 500, 503])('%i -> retryable Error', async (status) => {
      http.post.mockReturnValue(throwError(() => httpError(status)));
      const err = await service.ocr('uploads/a.png').catch((e) => e);
      expect(err).not.toBeInstanceOf(UnrecoverableError);
      expect(err.message).toBe(`/ocr -> ${status}`);
    });

    it('network errors are retryable and include the error code', async () => {
      http.post.mockReturnValue(
        throwError(() => httpError(undefined, undefined, 'ECONNREFUSED')),
      );
      const err = await service.tts({ historyId: 'h', text: 't' }).catch((e) => e);
      expect(err).not.toBeInstanceOf(UnrecoverableError);
      expect(err.message).toBe('/tts request failed: ECONNREFUSED');
    });
  });

  describe('isHealthy', () => {
    it('returns true when /health responds', async () => {
      http.get.mockReturnValue(of({ data: { status: 'ok' } }));
      await expect(service.isHealthy()).resolves.toBe(true);
    });

    it('never throws, returns false on failure', async () => {
      http.get.mockReturnValue(throwError(() => new Error('down')));
      await expect(service.isHealthy()).resolves.toBe(false);
    });
  });
});
