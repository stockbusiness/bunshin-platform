import 'server-only';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { ApplicationError } from '@bunshin/shared';

export async function normalizeImageReferenceBytes(source: Uint8Array) {
  if (source.byteLength < 1 || source.byteLength > 10_000_000)
    throw new ApplicationError(
      'VALIDATION_ERROR',
      '写真は10MB以下のJPEG・PNG・WebPを選んでください',
    );
  try {
    const image = sharp(source, { limitInputPixels: 20_000_000 });
    const metadata = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) !== 1)
      throw new Error('invalid image');
    const bytes = await image
      .rotate()
      .resize({ width: 1536, height: 1536, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    return {
      bytes,
      referenceImage: {
        sha256: createHash('sha256').update(bytes).digest('hex'),
        rightsConfirmed: true as const,
      },
    };
  } catch {
    throw new ApplicationError(
      'VALIDATION_ERROR',
      '写真を読み込めません。JPEG・PNG・WebPを選んでください',
    );
  }
}

export async function normalizeImageReference(encoded: string) {
  if (encoded.length > 4_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
    throw new ApplicationError(
      'VALIDATION_ERROR',
      '写真は3MB以下のJPEG・PNG・WebPを選んでください',
    );
  return normalizeImageReferenceBytes(Buffer.from(encoded, 'base64'));
}
