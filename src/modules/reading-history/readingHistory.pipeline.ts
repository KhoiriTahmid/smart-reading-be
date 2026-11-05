import { JobsOptions } from 'bullmq';

export const READINGS_QUEUE = 'readings';
export const READING_JOB_NAME = 'process';

export const READING_VOICES = ['female', 'male'] as const;
export type ReadingVoice = (typeof READING_VOICES)[number];
export const DEFAULT_READING_VOICE: ReadingVoice = 'female';

export const READING_LANGS = ['id', 'en', 'auto'] as const;
export type ReadingLang = (typeof READING_LANGS)[number];
export const DEFAULT_READING_LANG: ReadingLang = 'id';

/** Must match TTS_MAX_CHARS on the FastAPI side. */
export const TTS_MAX_CHARS = 20_000;

/** jobId is added per call (= historyId) so a reading is never queued twice. */
export const READING_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { age: 3_600 },
  removeOnFail: { age: 86_400 },
};
