import { describe, it, expect } from 'vitest';
import { extractPlaylistId } from '@/lib/youtube';

describe('extractPlaylistId', () => {
  it('extracts playlist ID from a standard YouTube playlist URL', () => {
    const url = 'https://www.youtube.com/playlist?list=PLrAXtmErZfOvBR05mWkPoVYmYK7R1wjNO';
    expect(extractPlaylistId(url)).toBe('PLrAXtmErZfOvBR05mWkPoVYmYK7R1wjNO');
  });

  it('extracts playlist ID from a watch URL with list parameter', () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZfOvBR05mWkPoVYmYK7R1wjNO';
    expect(extractPlaylistId(url)).toBe('PLrAXtmErZfOvBR05mWkPoVYmYK7R1wjNO');
  });

  it('extracts playlist ID when list is the first query parameter', () => {
    const url = 'https://www.youtube.com/watch?list=PLrAXtmErZfOvBR05mWkPoVYmYK7R1wjNO&v=dQw4w9WgXcQ';
    expect(extractPlaylistId(url)).toBe('PLrAXtmErZfOvBR05mWkPoVYmYK7R1wjNO');
  });

  it('extracts playlist ID with underscore in the ID', () => {
    const url = 'https://www.youtube.com/playlist?list=PL_7tA4_-E4Ut_SaYcKbz-gJt0ra-ehFiI';
    expect(extractPlaylistId(url)).toBe('PL_7tA4_-E4Ut_SaYcKbz-gJt0ra-ehFiI');
  });

  it('extracts playlist ID with hyphen in the ID', () => {
    const url = 'https://www.youtube.com/playlist?list=PL-7tA4-E4UtSaYcKbzgJt0raehFiI';
    expect(extractPlaylistId(url)).toBe('PL-7tA4-E4UtSaYcKbzgJt0raehFiI');
  });

  it('returns null for a URL without a list parameter', () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    expect(extractPlaylistId(url)).toBeNull();
  });

  it('returns null for a URL with an empty list parameter', () => {
    const url = 'https://www.youtube.com/playlist?list=';
    expect(extractPlaylistId(url)).toBeNull();
  });

  it('returns null for a completely unrelated URL', () => {
    const url = 'https://example.com/some/page';
    expect(extractPlaylistId(url)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractPlaylistId('')).toBeNull();
  });

  it('handles URL-encoded playlist IDs', () => {
    // The regex matches alphanumeric, underscore, hyphen — URL-encoded chars won't match
    const url = 'https://www.youtube.com/playlist?list=PLrAXtmErZfOvBR05mWkPoVYmYK7R1wjNO';
    expect(extractPlaylistId(url)).toBe('PLrAXtmErZfOvBR05mWkPoVYmYK7R1wjNO');
  });

  it('extracts the first list parameter when multiple are present', () => {
    const url = 'https://www.youtube.com/playlist?list=AAAA&list=BBBB';
    expect(extractPlaylistId(url)).toBe('AAAA');
  });

  it('extracts playlist ID from a YouTube Music URL', () => {
    const url = 'https://music.youtube.com/playlist?list=RDCLAK5uy_kL9UxZqeZsNqPbWdMG1i6Df1VEsZasA';
    expect(extractPlaylistId(url)).toBe('RDCLAK5uy_kL9UxZqeZsNqPbWdMG1i6Df1VEsZasA');
  });

  it('extracts playlist ID from a short youtube.com URL', () => {
    const url = 'https://youtube.com/playlist?list=PLrAXtmErZfOvBR05mWkPoVYmYK7R1wjNO';
    expect(extractPlaylistId(url)).toBe('PLrAXtmErZfOvBR05mWkPoVYmYK7R1wjNO');
  });
});
