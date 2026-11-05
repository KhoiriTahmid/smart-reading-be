import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ReadingHistoriesService } from './readingHistory.service';
import { ReadingHistoriesProcessor } from './readingHistory.processor';
import { ReadingStatus } from './readingHistory.constants';
import { UnrecoverableError } from 'bullmq';

// Minimal valid PNG header (89 50 4E 47 0D 0A 1A 0A)
const VALID_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);

describe('ReadingHistories (OCR + TTS Pipeline)', () => {
  const mockStorage = {
    put: jest.fn(),
    delete: jest.fn(),
    getPresignedUrl: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
    getJob: jest.fn(),
  };

  const mockModel = {
    create: jest.fn(),
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAndCountAll: jest.fn(),
    update: jest.fn(),
    restore: jest.fn(),
    destroy: jest.fn(),
  };

  const mockOcrClient = {
    ocr: jest.fn(),
    tts: jest.fn(),
    isHealthy: jest.fn(),
  };

  let service: ReadingHistoriesService;
  let processor: ReadingHistoriesProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.getPresignedUrl.mockImplementation(
      async (key: string) => `https://s3.mock/${key}?signed=1`,
    );

    service = new ReadingHistoriesService(
      mockModel as any,
      mockStorage as any,
      mockQueue as any,
    );

    processor = new ReadingHistoriesProcessor(
      mockModel as any,
      mockOcrClient as any,
    );
  });

  describe('ReadingHistoriesService.create', () => {
    it('uploads image, creates PENDING record, enqueues job, and returns presigned imageUrl', async () => {
      const fakeRow = {
        historyId: 'hist-123',
        get: () => ({
          historyId: 'hist-123',
          name: 'page1.png',
          voice: 'female',
          status: ReadingStatus.PENDING,
          sourceFileKey: 'uploads/hist-123/source.png',
          extractedText: null,
          audioUrl: null,
          errorMessage: null,
        }),
        update: jest.fn(),
      };
      mockModel.create.mockResolvedValue(fakeRow);
      mockQueue.add.mockResolvedValue({});

      const file = {
        buffer: VALID_PNG_BUFFER,
        mimetype: 'image/png',
        originalname: 'page1.png',
      } as Express.Multer.File;

      const res = await service.create(file, {
        voice: 'female',
        createdByUserId: 'user-1',
        metaUser: { userId: 'user-1' } as any,
      });

      expect(mockStorage.put).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'process',
        { historyId: expect.any(String), lang: 'id' },
        expect.objectContaining({ jobId: expect.any(String) }),
      );
      expect(res.status).toBe(ReadingStatus.PENDING);
      expect(res.imageUrl).toContain('https://s3.mock/uploads/');
      expect(res.audioUrl).toBeNull();
    });

    it('rejects files whose magic bytes do not match PNG or JPG', async () => {
      const badFile = {
        buffer: Buffer.from('not-an-image'),
        mimetype: 'image/png',
        originalname: 'fake.png',
      } as Express.Multer.File;

      await expect(
        service.create(badFile, {
          createdByUserId: 'user-1',
          metaUser: {} as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('marks row FAILED and throws 503 if BullMQ enqueue fails', async () => {
      const fakeRow = {
        historyId: 'hist-err',
        update: jest.fn(),
      };
      mockModel.create.mockResolvedValue(fakeRow);
      mockQueue.add.mockRejectedValueOnce(new Error('Redis down'));

      const file = {
        buffer: VALID_PNG_BUFFER,
        mimetype: 'image/png',
        originalname: 'page1.png',
      } as Express.Multer.File;

      await expect(
        service.create(file, {
          createdByUserId: 'user-1',
          metaUser: {} as any,
        }),
      ).rejects.toThrow(ServiceUnavailableException);

      expect(fakeRow.update).toHaveBeenCalledWith({
        status: ReadingStatus.FAILED,
        errorMessage: 'Failed to enqueue job',
      });
    });
  });

  describe('ReadingHistoriesService.retry', () => {
    it('re-queues a FAILED reading and resets errorMessage', async () => {
      const fakeRow = {
        historyId: 'hist-fail',
        status: ReadingStatus.FAILED,
        update: jest.fn(),
        get: () => ({
          historyId: 'hist-fail',
          status: ReadingStatus.PENDING,
          sourceFileKey: 'uploads/hist-fail/source.png',
          audioUrl: null,
          errorMessage: null,
        }),
      };
      mockModel.findByPk.mockResolvedValue(fakeRow);
      mockQueue.getJob.mockResolvedValue({ remove: jest.fn() });

      const res = await service.retry({ historyId: 'hist-fail' });

      expect(fakeRow.update).toHaveBeenCalledWith({
        status: ReadingStatus.PENDING,
        errorMessage: null,
      });
      expect(mockQueue.add).toHaveBeenCalled();
      expect(res.status).toBe(ReadingStatus.PENDING);
    });
  });

  describe('ReadingHistoriesProcessor.process', () => {
    it('runs OCR then TTS and updates status to COMPLETED', async () => {
      const state: Record<string, any> = {
        historyId: 'hist-1',
        status: ReadingStatus.PENDING,
        sourceFileKey: 'uploads/hist-1/source.png',
        extractedText: null,
        audioUrl: null,
        voice: 'male',
      };
      const row = {
        get historyId() {
          return state.historyId;
        },
        get status() {
          return state.status;
        },
        get sourceFileKey() {
          return state.sourceFileKey;
        },
        get extractedText() {
          return state.extractedText;
        },
        get audioUrl() {
          return state.audioUrl;
        },
        get voice() {
          return state.voice;
        },
        update: jest.fn(async (patch: Record<string, any>) => {
          Object.assign(state, patch);
        }),
      };

      mockModel.findByPk.mockResolvedValue(row);
      mockOcrClient.ocr.mockResolvedValue({
        text: 'Halo dunia membaca cerdas',
        lines: 1,
        avg_confidence: 0.98,
      });
      mockOcrClient.tts.mockResolvedValue({
        audio_key: 'audio/hist-1.mp3',
        duration_seconds: 2.5,
        chars: 25,
      });

      await processor.process({
        data: { historyId: 'hist-1', lang: 'en' },
      } as any);

      expect(mockOcrClient.ocr).toHaveBeenCalledWith(
        'uploads/hist-1/source.png',
        'en',
      );
      expect(mockOcrClient.tts).toHaveBeenCalledWith({
        historyId: 'hist-1',
        text: 'Halo dunia membaca cerdas',
        voice: 'male',
        lang: 'en',
      });
      expect(state.status).toBe(ReadingStatus.COMPLETED);
      expect(state.audioUrl).toBe('audio/hist-1.mp3');
      expect(state.extractedText).toBe('Halo dunia membaca cerdas');
    });

    it('throws UnrecoverableError when OCR finds no text', async () => {
      const row = {
        historyId: 'hist-blank',
        status: ReadingStatus.PENDING,
        sourceFileKey: 'uploads/hist-blank/source.png',
        extractedText: null,
        audioUrl: null,
        voice: 'female',
        update: jest.fn(),
      };
      mockModel.findByPk.mockResolvedValue(row);
      mockOcrClient.ocr.mockResolvedValue({
        text: '   ',
        lines: 0,
        avg_confidence: 0,
      });

      await expect(
        processor.process({ data: { historyId: 'hist-blank' } } as any),
      ).rejects.toThrow(UnrecoverableError);
    });
  });
});
