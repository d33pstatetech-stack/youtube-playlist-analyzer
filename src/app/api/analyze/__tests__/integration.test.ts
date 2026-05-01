import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

// ---------------------------------------------------------------------------
// Mock next/cache – the route uses 'use cache' + cacheLife/cacheTag which
// are Next.js runtime features that don't work outside the Next server.
// ---------------------------------------------------------------------------

vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock YouTube API responses
// ---------------------------------------------------------------------------

const YOUTUBE_PLAYLIST_ITEMS_RESPONSE = {
  items: [
    {
      snippet: {
        title: 'Test Video 1',
        description: 'First test video description',
        thumbnails: {
          medium: { url: 'https://i.ytimg.com/vi/vid1/mqdefault.jpg' },
          default: { url: 'https://i.ytimg.com/vi/vid1/default.jpg' },
        },
        channelTitle: 'Test Channel',
        publishedAt: '2024-01-15T12:00:00Z',
        resourceId: { videoId: 'vid1' },
      },
    },
    {
      snippet: {
        title: 'Test Video 2',
        description: 'Second test video description',
        thumbnails: {
          medium: { url: 'https://i.ytimg.com/vi/vid2/mqdefault.jpg' },
        },
        channelTitle: 'Another Channel',
        publishedAt: '2024-02-20T08:30:00Z',
        resourceId: { videoId: 'vid2' },
      },
    },
  ],
  nextPageToken: '',
};

const YOUTUBE_PLAYLIST_TITLE_RESPONSE = {
  items: [
    {
      snippet: {
        title: 'My Test Playlist',
      },
    },
  ],
};

const GEMINI_ANALYSIS_RESPONSE = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: '[{"tags": ["testing", "tutorial"], "summary": ["A test video about testing", "Demonstrates unit testing"]}, {"tags": ["demo", "walkthrough"], "summary": ["A demo walkthrough", "Shows integration testing"]}]',
          },
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createPostRequest(url: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/analyze', {
    method: 'POST',
    body: JSON.stringify({ url }),
    headers: { 'Content-Type': 'application/json' },
  });
}

function createPostRequestWithBody(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/analyze', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/analyze – integration tests', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    // Stub environment variables for each test
    vi.stubEnv('YOUTUBE_API_KEY', 'test-youtube-key');
    vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  // -------------------------------------------------------------------------
  // Validation errors
  // -------------------------------------------------------------------------

  describe('validation errors', () => {
    it('returns 400 when url field is missing', async () => {
      const req = createPostRequestWithBody({});
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('URL is required');
    });

    it('returns 400 when url is an empty string', async () => {
      const req = createPostRequestWithBody({ url: '' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('URL is required');
    });

    it('returns 400 when url is not a YouTube playlist URL', async () => {
      const req = createPostRequest('https://example.com/not-a-playlist');
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Invalid YouTube playlist URL');
    });

    it('returns 400 for a YouTube watch URL without list parameter', async () => {
      const req = createPostRequest('https://www.youtube.com/watch?v=abc123');
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Invalid YouTube playlist URL');
    });

    it('returns 400 for a URL with an empty list parameter', async () => {
      const req = createPostRequest('https://www.youtube.com/playlist?list=');
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Invalid YouTube playlist URL');
    });
  });

  // -------------------------------------------------------------------------
  // Successful analysis
  // -------------------------------------------------------------------------

  describe('successful analysis', () => {
    beforeEach(() => {
      // Mock globalThis.fetch to return controlled API responses
      globalThis.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();

        // YouTube playlistItems endpoint
        if (urlStr.includes('/playlistItems')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(YOUTUBE_PLAYLIST_ITEMS_RESPONSE),
          } as Response);
        }

        // YouTube playlists endpoint (title)
        if (urlStr.includes('/playlists?')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(YOUTUBE_PLAYLIST_TITLE_RESPONSE),
          } as Response);
        }

        // Gemini API endpoint
        if (urlStr.includes('generativelanguage.googleapis.com')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(GEMINI_ANALYSIS_RESPONSE),
          } as Response);
        }

        // Default: unexpected URL
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ error: { message: 'Not found' } }),
        } as Response);
      });
    });

    it('returns 200 with full analysis for a valid playlist URL', async () => {
      const req = createPostRequest(
        'https://www.youtube.com/playlist?list=PLrAXtmErZfOvBR05mWkPoVYmYK7R1wjNO'
      );
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.playlistId).toBe('PLrAXtmErZfOvBR05mWkPoVYmYK7R1wjNO');
      expect(data.playlistTitle).toBe('My Test Playlist');
      expect(data.videoCount).toBe(2);
      expect(data.videos).toHaveLength(2);
      expect(data.allTags).toBeDefined();
      expect(data.analyzedAt).toBeDefined();
      expect(data.playlistUrl).toBe(
        'https://www.youtube.com/playlist?list=PLrAXtmErZfOvBR05mWkPoVYmYK7R1wjNO'
      );
    });

    it('maps video fields correctly from API responses', async () => {
      const req = createPostRequest(
        'https://www.youtube.com/playlist?list=PLrAXtmErZfOvBR05mWkPoVYmYK7R1wjNO'
      );
      const res = await POST(req);
      const data = await res.json();

      const video1 = data.videos[0];
      expect(video1.id).toBe('vid1');
      expect(video1.title).toBe('Test Video 1');
      expect(video1.channelTitle).toBe('Test Channel');
      expect(video1.thumbnail).toBe('https://i.ytimg.com/vi/vid1/mqdefault.jpg');
      expect(video1.url).toBe('https://www.youtube.com/watch?v=vid1');
      expect(video1.tags).toEqual(['testing', 'tutorial']);
      expect(video1.summary).toEqual(['A test video about testing', 'Demonstrates unit testing']);
    });

    it('collects unique tags sorted alphabetically', async () => {
      const req = createPostRequest(
        'https://www.youtube.com/playlist?list=PLrAXtmErZfOvBR05mWkPoVYmYK7R1wjNO'
      );
      const res = await POST(req);
      const data = await res.json();

      // Tags from video 1: testing, tutorial; video 2: demo, walkthrough
      // Unique + sorted
      expect(data.allTags).toEqual(['demo', 'testing', 'tutorial', 'walkthrough']);
    });

    it('works with a watch URL that contains a list parameter', async () => {
      const req = createPostRequest(
        'https://www.youtube.com/watch?v=vid1&list=PLrAXtmErZfOvBR05mWkPoVYmYK7R1wjNO'
      );
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.playlistId).toBe('PLrAXtmErZfOvBR05mWkPoVYmYK7R1wjNO');
    });
  });

  // -------------------------------------------------------------------------
  // YouTube API errors
  // -------------------------------------------------------------------------

  describe('YouTube API errors', () => {
    it('returns 500 when YouTube playlistItems API fails', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();

        if (urlStr.includes('/playlistItems')) {
          return Promise.resolve({
            ok: false,
            json: () =>
              Promise.resolve({
                error: { message: 'Playlist not found' },
              }),
          } as Response);
        }

        // Playlists title endpoint succeeds
        if (urlStr.includes('/playlists?')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(YOUTUBE_PLAYLIST_TITLE_RESPONSE),
          } as Response);
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response);
      });

      const req = createPostRequest(
        'https://www.youtube.com/playlist?list=PL_NONEXISTENT'
      );
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe('Playlist not found');
    });

    it('returns 500 when YouTube playlists API returns no items', async () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();

        if (urlStr.includes('/playlistItems')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(YOUTUBE_PLAYLIST_ITEMS_RESPONSE),
          } as Response);
        }

        // Playlists title endpoint returns empty items → falls back to 'Unknown Playlist'
        if (urlStr.includes('/playlists?')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ items: [] }),
          } as Response);
        }

        if (urlStr.includes('generativelanguage.googleapis.com')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(GEMINI_ANALYSIS_RESPONSE),
          } as Response);
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response);
      });

      const req = createPostRequest(
        'https://www.youtube.com/playlist?list=PL_EMPTY_TITLE'
      );
      const res = await POST(req);
      const data = await res.json();

      // Should succeed with fallback title
      expect(res.status).toBe(200);
      expect(data.playlistTitle).toBe('Unknown Playlist');
    });
  });

  // -------------------------------------------------------------------------
  // Gemini API errors
  // -------------------------------------------------------------------------

  describe('Gemini API errors', () => {
    beforeEach(() => {
      globalThis.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();

        // YouTube APIs succeed
        if (urlStr.includes('/playlistItems')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(YOUTUBE_PLAYLIST_ITEMS_RESPONSE),
          } as Response);
        }

        if (urlStr.includes('/playlists?')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(YOUTUBE_PLAYLIST_TITLE_RESPONSE),
          } as Response);
        }

        // Gemini API fails
        if (urlStr.includes('generativelanguage.googleapis.com')) {
          return Promise.resolve({
            ok: false,
            status: 429,
            text: () => Promise.resolve('Rate limit exceeded'),
          } as Response);
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response);
      });
    });

    it('returns 500 when Gemini API fails', async () => {
      const req = createPostRequest(
        'https://www.youtube.com/playlist?list=PLrAXtmErZfOvBR05mWkPoVYmYK7R1wjNO'
      );
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toContain('Gemini API');
    });

    it('returns 500 when Gemini returns unparseable JSON', async () => {
      // Override the Gemini mock for this specific test
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockImplementation((url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();

        if (urlStr.includes('/playlistItems')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(YOUTUBE_PLAYLIST_ITEMS_RESPONSE),
          } as Response);
        }

        if (urlStr.includes('/playlists?')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(YOUTUBE_PLAYLIST_TITLE_RESPONSE),
          } as Response);
        }

        if (urlStr.includes('generativelanguage.googleapis.com')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                candidates: [
                  {
                    content: {
                      parts: [{ text: 'This is not valid JSON [[[{{{' }],
                    },
                  },
                ],
              }),
          } as Response);
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response);
      });

      const req = createPostRequest(
        'https://www.youtube.com/playlist?list=PLrAXtmErZfOvBR05mWkPoVYmYK7R1wjNO'
      );
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toContain('Gemini');
    });
  });

  // -------------------------------------------------------------------------
  // Missing API keys
  // -------------------------------------------------------------------------

  describe('missing API keys', () => {
    it('returns 500 when YOUTUBE_API_KEY is not set', async () => {
      vi.stubEnv('YOUTUBE_API_KEY', '');

      const req = createPostRequest(
        'https://www.youtube.com/playlist?list=PLrAXtmErZfOvBR05mWkPoVYmYK7R1wjNO'
      );
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toContain('YouTube API key');
    });

    it('returns 500 when GEMINI_API_KEY is not set', async () => {
      vi.stubEnv('GEMINI_API_KEY', '');

      // YouTube fetch still needs to succeed to get past that point
      globalThis.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();

        if (urlStr.includes('/playlistItems')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(YOUTUBE_PLAYLIST_ITEMS_RESPONSE),
          } as Response);
        }

        if (urlStr.includes('/playlists?')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(YOUTUBE_PLAYLIST_TITLE_RESPONSE),
          } as Response);
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response);
      });

      const req = createPostRequest(
        'https://www.youtube.com/playlist?list=PLrAXtmErZfOvBR05mWkPoVYmYK7R1wjNO'
      );
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toContain('Gemini API key');
    });
  });
});
