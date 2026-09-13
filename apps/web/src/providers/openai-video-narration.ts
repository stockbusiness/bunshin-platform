import 'server-only';
import {
  DEFAULT_VIDEO_NARRATION_SPEED,
  DEFAULT_VIDEO_NARRATION_VOICE,
  type VideoNarrationSpeed,
  type VideoNarrationVoice,
} from '@bunshin/application';
import { ApplicationError } from '@bunshin/shared';

export const NARRATION_MODEL = 'gpt-4o-mini-tts';
export const NARRATION_VOICE = DEFAULT_VIDEO_NARRATION_VOICE;
export const NARRATION_VERSION = 'video-narration-natural-ja-v2';
export const NARRATION_INSTRUCTIONS =
  '自然で聞き取りやすい日本語で話してください。落ち着いた温かい声で、親しい案内役のように話します。文節の区切りに短い間を取り、語尾を急がず、数字や英語も明瞭に読みます。広告のような大げさな調子、過度な感情、不自然な抑揚は避けてください。';
export const NARRATION_MICROS_PER_CHARACTER = 15;
const bytesPerMs = 48; // 24 kHz, mono, signed 16-bit PCM.
const maxPreviewBytes = 2 * 1024 * 1024;
export const NARRATION_PREVIEW_TEXT = 'こんにちは。今日も無理なく、一歩ずつ進めていきましょう。';

export function narrationSpeedValue(speed: VideoNarrationSpeed) {
  return speed === 'SLOW' ? 0.88 : 0.96;
}

export class OpenAIVideoNarrationError extends Error {
  constructor(
    readonly category: string,
    readonly retryable: boolean,
  ) {
    super(category);
  }
}

export function narrationCharacters(text: string) {
  return Array.from(text.trim()).length;
}

export function validateNarrationScenes(scenes: Array<{ narration: string; durationMs: number }>) {
  if (!scenes.length || scenes.length > 12)
    throw new ApplicationError('VALIDATION_ERROR', '音声の場面数が不正です。');
  for (const scene of scenes) {
    const count = narrationCharacters(scene.narration);
    if (
      count === 0 ||
      !Number.isInteger(scene.durationMs) ||
      scene.durationMs < 500 ||
      scene.durationMs > 60_000 ||
      count > Math.floor((scene.durationMs / 1000) * 3)
    )
      throw new ApplicationError(
        'VALIDATION_ERROR',
        '音声の台本が長すぎます。企画を作り直してください。',
      );
  }
}

export async function composeNarration(
  scenes: Array<{ narration: string; durationMs: number }>,
  speak: (text: string, durationMs: number) => Promise<Uint8Array>,
) {
  validateNarrationScenes(scenes);
  const durationMs = scenes.reduce((total, scene) => total + scene.durationMs, 0);
  if (durationMs !== 30_000 && durationMs !== 60_000)
    throw new ApplicationError('VALIDATION_ERROR', '動画の長さが不正です。');
  const pcm = Buffer.alloc(durationMs * bytesPerMs);
  let offset = 0;
  for (const scene of scenes) {
    const audio = await speak(scene.narration.trim(), scene.durationMs);
    if (!audio.length || audio.length % 2 !== 0 || audio.length > scene.durationMs * bytesPerMs)
      throw new ApplicationError(
        'VALIDATION_ERROR',
        '音声が場面の時間を超えました。企画を作り直してください。',
      );
    pcm.set(audio, offset);
    offset += scene.durationMs * bytesPerMs;
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(pcm.length + 36, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(24_000, 24);
  header.writeUInt32LE(48_000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export class OpenAIVideoNarration {
  constructor(
    private readonly apiKey: string,
    private readonly request: typeof fetch = fetch,
  ) {}

  private async requestSpeech(input: {
    text: string;
    voice: VideoNarrationVoice;
    responseFormat: 'pcm' | 'mp3';
    maxBytes: number;
    speed: VideoNarrationSpeed;
  }) {
    let response: Response;
    try {
      response = await this.request('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
        headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: NARRATION_MODEL,
          voice: input.voice,
          input: input.text,
          instructions: NARRATION_INSTRUCTIONS,
          response_format: input.responseFormat,
          speed: narrationSpeedValue(input.speed),
        }),
      });
    } catch {
      throw new OpenAIVideoNarrationError('NETWORK', true);
    }
    if (!response.ok)
      throw new OpenAIVideoNarrationError(
        response.status === 429
          ? 'RATE_LIMIT'
          : response.status >= 500
            ? 'PROVIDER_ERROR'
            : 'INVALID_REQUEST',
        response.status === 429 || response.status >= 500,
      );
    if (!response.body) throw new OpenAIVideoNarrationError('INVALID_RESPONSE', true);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > input.maxBytes)
          throw new ApplicationError(
            'VALIDATION_ERROR',
            '音声が場面の時間を超えました。企画を作り直してください。',
          );
        chunks.push(chunk.value);
      }
    } finally {
      await reader.cancel();
    }
    return Buffer.concat(chunks);
  }

  async speak(
    text: string,
    durationMs: number,
    voice: VideoNarrationVoice = NARRATION_VOICE,
    speed: VideoNarrationSpeed = DEFAULT_VIDEO_NARRATION_SPEED,
  ) {
    return this.requestSpeech({
      text,
      voice,
      responseFormat: 'pcm',
      maxBytes: durationMs * bytesPerMs,
      speed,
    });
  }

  async preview(
    voice: VideoNarrationVoice,
    speed: VideoNarrationSpeed = DEFAULT_VIDEO_NARRATION_SPEED,
    text = NARRATION_PREVIEW_TEXT,
  ) {
    return this.requestSpeech({
      text,
      voice,
      responseFormat: 'mp3',
      maxBytes: maxPreviewBytes,
      speed,
    });
  }
}
