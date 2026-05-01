import { Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Sample mock data that mirrors the real API response shape
// ---------------------------------------------------------------------------

export const MOCK_ANALYSIS = {
  playlistId: 'PL_TEST123',
  playlistTitle: 'Test Playlist',
  playlistUrl: 'https://www.youtube.com/playlist?list=PL_TEST123',
  videoCount: 3,
  analyzedAt: '2024-06-15T12:00:00.000Z',
  provider: 'gemini',
  allTags: ['JavaScript', 'React', 'TypeScript', 'CSS', 'Node.js'],
  videos: [
    {
      id: 'vid1',
      title: 'Intro to React',
      description: 'Learn React basics',
      thumbnail: 'https://i.ytimg.com/vi/vid1/mqdefault.jpg',
      channelTitle: 'Code Academy',
      publishedAt: '2024-01-15T12:00:00Z',
      tags: ['React', 'JavaScript'],
      summary: ['Component basics', 'JSX syntax'],
      url: 'https://www.youtube.com/watch?v=vid1',
    },
    {
      id: 'vid2',
      title: 'TypeScript Deep Dive',
      description: 'Advanced TypeScript patterns',
      thumbnail: 'https://i.ytimg.com/vi/vid2/mqdefault.jpg',
      channelTitle: 'TS Masters',
      publishedAt: '2024-02-20T08:30:00Z',
      tags: ['TypeScript', 'JavaScript'],
      summary: ['Generic types', 'Utility types'],
      url: 'https://www.youtube.com/watch?v=vid2',
    },
    {
      id: 'vid3',
      title: 'CSS Grid Layout',
      description: 'Master CSS Grid',
      thumbnail: 'https://i.ytimg.com/vi/vid3/mqdefault.jpg',
      channelTitle: 'CSS Wizards',
      publishedAt: '2024-03-10T14:00:00Z',
      tags: ['CSS'],
      summary: ['Grid template areas', 'Auto-placement'],
      url: 'https://www.youtube.com/watch?v=vid3',
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Intercept /api/health and return the given Ollama status. */
export async function mockHealthApi(page: Page, opts: { ollama: boolean; models?: string[]; modelAvailable?: boolean; error?: string } = { ollama: true }) {
  await page.route('/api/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ollama: opts.ollama,
        models: opts.models || (opts.ollama ? ['deepseek-r1:8b'] : []),
        modelAvailable: opts.modelAvailable ?? opts.ollama,
        configuredModel: 'deepseek-r1:8b',
        ...(opts.error ? { error: opts.error } : {}),
      }),
    });
  });
}

/** Intercept /api/analyze and return the given response with given status. */
export async function mockAnalyzeApi(page: Page, body: unknown, status = 200, delayMs = 0) {
  await page.route('/api/analyze', async (route) => {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

/** Fill the playlist URL input and click Analyze. */
export async function analyzeUrl(page: Page, url: string) {
  await page.getByTestId('playlist-url-input').fill(url);
  await page.getByTestId('analyze-button').click();
}

/** Get a tag button inside the tag cloud by its label. */
export function tagButton(page: Page, label: string) {
  return page.getByTestId('tag-cloud').locator('button', { hasText: label });
}

/**
 * Intercept external image URLs (YouTube thumbnails) and serve a tiny
 * 1×1 purple PNG placeholder so screenshots are deterministic and don't
 * depend on network-loaded images.
 */
export async function mockThumbnailImages(page: Page) {
  // 1×1 purple PNG (minimal valid PNG with a purple-ish pixel)
  const placeholderPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );

  await page.route('https://i.ytimg.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: placeholderPng,
    });
  });
}

/** Wait for web fonts to finish loading so screenshots are consistent. */
export async function waitForFonts(page: Page) {
  await page.evaluate(() => document.fonts.ready);
}
