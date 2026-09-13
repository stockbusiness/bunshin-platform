import { describe, expect, it } from 'vitest';
import { postCopyFromDisclosure, postCopyFromMissionContent } from '../src/video/video-post-copy';

describe('video post copy', () => {
  it('combines the approved caption and hashtags without duplicates', () => {
    expect(
      postCopyFromMissionContent({
        caption: '午後に集中が切れたら、3分だけ席を立ってみましょう。 #仕事術',
        hashtags: ['#仕事術', '#集中力', 'invalid'],
      }),
    ).toBe('午後に集中が切れたら、3分だけ席を立ってみましょう。 #仕事術\n\n#集中力');
  });

  it('reads the immutable copy saved with a video', () => {
    expect(postCopyFromDisclosure({ postCopy: ' 保存して試してみてください。 ' })).toBe(
      '保存して試してみてください。',
    );
  });

  it('does not invent copy when the source has no caption', () => {
    expect(postCopyFromMissionContent({ slides: [] })).toBeNull();
  });
});
