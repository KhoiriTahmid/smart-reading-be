import { Logger } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import { ReadingHistoriesProcessor } from './readingHistory.processor';
import { ReadingStatus } from './readingHistory.constants';
import { TTS_MAX_CHARS } from './readingHistory.pipeline';

/** A mutable fake Sequelize row: update() patches the state in place. */
const makeRow = (initial: Record<string, any>) => {
  const row: Record<string, any> = {
    historyId: 'h-1',
    status: ReadingStatus.PENDING,
    sourceFileKey: 'uploads/h-1/source.png',
    extractedText: null,
    audioUrl: null,
    voice: 'female',
    metaDevice: null,
    ...initial,
  };
  row.update = jest.fn(async (patch: Record<string, any>) => {
    Object.assign(row, patch);
  });
  return row;
};

describe('ReadingHistoriesProcessor', () => {
  const model = { findByPk: jest.fn(), update: jest.fn() };
  const ocrClient = { ocr: jest.fn(), tts: jest.fn() };
  let processor: ReadingHistoriesProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    processor = new ReadingHistoriesProcessor(model as any, ocrClient as any);
    ocrClient.ocr.mockResolvedValue({ text: 'Halo dunia' });
    ocrClient.tts.mockResolvedValue({ audio_key: 'audio/h-1.mp3' });
  });

  const run = (data: Record<string, any> = { historyId: 'h-1' }) =>
    processor.process({ data } as any);

  describe('language resolution', () => {
    it('job lang wins over the lang stored on the row', async () => {
      model.findByPk.mockResolvedValue(makeRow({ metaDevice: { lang: 'id' } }));
      await run({ historyId: 'h-1', lang: 'en' });
      expect(ocrClient.ocr).toHaveBeenCalledWith(expect.any(String), 'en');
      expect(ocrClient.tts).toHaveBeenCalledWith(
        expect.objectContaining({ lang: 'en' }),
      );
    });

    it('falls back to metaDevice.lang (used on retry)', async () => {
      model.findByPk.mockResolvedValue(
        makeRow({ metaDevice: { lang: 'auto' } }),
      );
      await run();
      expect(ocrClient.tts).toHaveBeenCalledWith(
        expect.objectContaining({ lang: 'auto' }),
      );
    });

    it('defaults to id for missing or invalid langs', async () => {
      model.findByPk.mockResolvedValue(makeRow({ metaDevice: { lang: 'fr' } }));
      await run();
      expect(ocrClient.ocr).toHaveBeenCalledWith(expect.any(String), 'id');
    });
  });

  it('defaults an unknown voice to female', async () => {
    model.findByPk.mockResolvedValue(makeRow({ voice: 'robot' }));
    await run();
    expect(ocrClient.tts).toHaveBeenCalledWith(
      expect.objectContaining({ voice: 'female' }),
    );
  });

  it('skips OCR on retry when text was already extracted', async () => {
    const row = makeRow({ extractedText: 'Sudah ada' });
    model.findByPk.mockResolvedValue(row);
    await run();
    expect(ocrClient.ocr).not.toHaveBeenCalled();
    expect(ocrClient.tts).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Sudah ada' }),
    );
    expect(row.status).toBe(ReadingStatus.COMPLETED);
  });

  it('is idempotent: a COMPLETED row with audio does nothing', async () => {
    model.findByPk.mockResolvedValue(
      makeRow({ status: ReadingStatus.COMPLETED, audioUrl: 'audio/x.mp3' }),
    );
    await run();
    expect(ocrClient.ocr).not.toHaveBeenCalled();
    expect(ocrClient.tts).not.toHaveBeenCalled();
  });

  it('truncates very long text and records a remark', async () => {
    const row = makeRow({ extractedText: 'a'.repeat(TTS_MAX_CHARS + 50) });
    model.findByPk.mockResolvedValue(row);
    await run();
    expect(ocrClient.tts.mock.calls[0][0].text).toHaveLength(TTS_MAX_CHARS);
    expect(row.remark).toContain(String(TTS_MAX_CHARS));
  });

  it('throws UnrecoverableError for a deleted row or missing source file', async () => {
    model.findByPk.mockResolvedValueOnce(null);
    await expect(run()).rejects.toThrow(UnrecoverableError);
    model.findByPk.mockResolvedValueOnce(makeRow({ sourceFileKey: null }));
    await expect(run()).rejects.toThrow(UnrecoverableError);
  });

  describe('onFailed', () => {
    const job = (attemptsMade: number, attempts = 5) =>
      ({
        id: 'j1',
        attemptsMade,
        opts: { attempts },
        data: { historyId: 'h-1' },
      }) as any;

    it('keeps the status while BullMQ will still retry', async () => {
      await processor.onFailed(job(1), new Error('503'));
      expect(model.update).not.toHaveBeenCalled();
    });

    it('marks FAILED after the last attempt', async () => {
      await processor.onFailed(job(5), new Error('boom'));
      expect(model.update).toHaveBeenCalledWith(
        { status: ReadingStatus.FAILED, errorMessage: 'boom' },
        { where: { historyId: 'h-1' } },
      );
    });

    it('marks FAILED immediately for unrecoverable errors', async () => {
      await processor.onFailed(job(1), new UnrecoverableError('no text'));
      expect(model.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: ReadingStatus.FAILED }),
        expect.anything(),
      );
    });

    it('caps very long error messages at 1000 chars', async () => {
      await processor.onFailed(job(5), new Error('x'.repeat(5000)));
      expect(model.update.mock.calls[0][0].errorMessage).toHaveLength(1000);
    });

    it('ignores events without a job', async () => {
      await processor.onFailed(undefined, new Error('x'));
      expect(model.update).not.toHaveBeenCalled();
    });
  });
});
