import { test, expect } from '@playwright/test';
import { MOCK_ANALYSIS, mockAnalyzeApi, mockHealthApi, mockThumbnailImages, analyzeUrl, waitForFonts } from './helpers';

// ===========================================================================
// Visual regression test suite
// ===========================================================================

test.describe('Visual Regression', () => {
  // Use a consistent viewport for all visual regression tests so snapshots
  // are deterministic across runs.
  test.use({ viewport: { width: 1280, height: 800 } });

  // -----------------------------------------------------------------------
  // Homepage – empty / initial state
  // -----------------------------------------------------------------------

  test('homepage – initial empty state', async ({ page }) => {
    await page.goto('/');
    await waitForFonts(page);

    // Wait for the hero section to be fully rendered
    await expect(page.getByTestId('playlist-url-input')).toBeVisible();

    await expect(page).toHaveScreenshot('homepage-initial.png', {
      fullPage: true,
    });
  });

  test('homepage – header', async ({ page }) => {
    await page.goto('/');
    await waitForFonts(page);

    const header = page.locator('header');
    await expect(header).toBeVisible();

    await expect(header).toHaveScreenshot('header.png');
  });

  test('homepage – hero section with input', async ({ page }) => {
    await page.goto('/');
    await waitForFonts(page);

    const hero = page.getByTestId('hero-section');
    await expect(hero).toBeVisible();

    await expect(hero).toHaveScreenshot('hero-section.png');
  });

  test('homepage – footer', async ({ page }) => {
    await page.goto('/');
    await waitForFonts(page);

    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    await expect(footer).toHaveScreenshot('footer.png');
  });

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  test('loading state – spinner and progress message', async ({ page }) => {
    // Mock health check so it doesn't interfere
    await mockHealthApi(page, { ollama: true, models: ['deepseek-r1:8b'] });

    // Delay the API response so we can snapshot the loading state
    await page.route('/api/analyze', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ANALYSIS),
      });
    });

    await page.goto('/');
    await waitForFonts(page);
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');

    // Wait for the loading spinner to appear
    await expect(page.getByTestId('analyze-button')).toContainText('Analyzing...');

    // Hide the animated spinner so the screenshot is deterministic
    await page.evaluate(() => {
      const spinners = document.querySelectorAll('.animate-spin');
      spinners.forEach((el) => el.classList.remove('animate-spin'));
    });

    await expect(page).toHaveScreenshot('loading-state.png', {
      fullPage: true,
    });
  });

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------

  test('error state – validation error box', async ({ page }) => {
    await mockHealthApi(page, { ollama: true, models: ['deepseek-r1:8b'] });
    await mockAnalyzeApi(page, { error: 'Invalid YouTube playlist URL' }, 400);

    await page.goto('/');
    await waitForFonts(page);
    await analyzeUrl(page, 'https://example.com/not-a-playlist');

    await expect(page.getByTestId('error-box')).toBeVisible();

    await expect(page).toHaveScreenshot('error-state.png', {
      fullPage: true,
    });
  });

  test('error state – close-up of error box', async ({ page }) => {
    await mockHealthApi(page, { ollama: true, models: ['deepseek-r1:8b'] });
    await mockAnalyzeApi(page, { error: 'Rate limit exceeded. Please try again later.' }, 429);

    await page.goto('/');
    await waitForFonts(page);
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');

    const errorBox = page.getByTestId('error-box');
    await expect(errorBox).toBeVisible();

    await expect(errorBox).toHaveScreenshot('error-box.png');
  });

  // -----------------------------------------------------------------------
  // Results state – full playlist analysis
  // -----------------------------------------------------------------------

  test('results state – full page after successful analysis', async ({ page }) => {
    await mockHealthApi(page, { ollama: true, models: ['deepseek-r1:8b'] });
    await mockAnalyzeApi(page, MOCK_ANALYSIS);
    await mockThumbnailImages(page);

    await page.goto('/');
    await waitForFonts(page);
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');

    // Wait for results to render
    await expect(page.locator('text=Test Playlist')).toBeVisible();
    await waitForFonts(page);

    await expect(page).toHaveScreenshot('results-full-page.png', {
      fullPage: true,
    });
  });

  test('results state – playlist header', async ({ page }) => {
    await mockHealthApi(page, { ollama: true, models: ['deepseek-r1:8b'] });
    await mockAnalyzeApi(page, MOCK_ANALYSIS);
    await mockThumbnailImages(page);

    await page.goto('/');
    await waitForFonts(page);
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');
    await expect(page.locator('text=Test Playlist')).toBeVisible();

    const playlistHeader = page.getByTestId('playlist-header');
    await expect(playlistHeader).toBeVisible();

    await expect(playlistHeader).toHaveScreenshot('playlist-header.png');
  });

  test('results state – tag cloud (unfiltered)', async ({ page }) => {
    await mockHealthApi(page, { ollama: true, models: ['deepseek-r1:8b'] });
    await mockAnalyzeApi(page, MOCK_ANALYSIS);
    await mockThumbnailImages(page);

    await page.goto('/');
    await waitForFonts(page);
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');
    await expect(page.getByTestId('tag-cloud')).toBeVisible();

    const tagCloudSection = page.getByTestId('tag-cloud-section');
    await expect(tagCloudSection).toBeVisible();

    await expect(tagCloudSection).toHaveScreenshot('tag-cloud-unfiltered.png');
  });

  test('results state – tag cloud with selected tag', async ({ page }) => {
    await mockHealthApi(page, { ollama: true, models: ['deepseek-r1:8b'] });
    await mockAnalyzeApi(page, MOCK_ANALYSIS);
    await mockThumbnailImages(page);

    await page.goto('/');
    await waitForFonts(page);
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');
    await expect(page.getByTestId('tag-cloud')).toBeVisible();

    // Click the "React" tag to select it
    const reactBtn = page.getByTestId('tag-cloud').locator('button', { hasText: 'React' });
    await reactBtn.click();

    // Wait for the selection animation to complete
    await expect(reactBtn).toHaveClass(/bg-purple-600/);

    const tagCloudSection = page.getByTestId('tag-cloud-section');
    await expect(tagCloudSection).toHaveScreenshot('tag-cloud-selected.png');
  });

  test('results state – video card', async ({ page }) => {
    await mockHealthApi(page, { ollama: true, models: ['deepseek-r1:8b'] });
    await mockAnalyzeApi(page, MOCK_ANALYSIS);
    await mockThumbnailImages(page);

    await page.goto('/');
    await waitForFonts(page);
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');
    await expect(page.locator('[data-testid="video-card"]')).toHaveCount(3);

    // Snapshot the first video card
    const firstCard = page.locator('[data-testid="video-card"]').first();
    await expect(firstCard).toBeVisible();

    await expect(firstCard).toHaveScreenshot('video-card.png');
  });

  // -----------------------------------------------------------------------
  // Filtered results state
  // -----------------------------------------------------------------------

  test('filtered results – videos matching a single tag', async ({ page }) => {
    await mockHealthApi(page, { ollama: true, models: ['deepseek-r1:8b'] });
    await mockAnalyzeApi(page, MOCK_ANALYSIS);
    await mockThumbnailImages(page);

    await page.goto('/');
    await waitForFonts(page);
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');
    await expect(page.getByTestId('tag-cloud')).toBeVisible();

    // Filter by "React" tag
    await page.getByTestId('tag-cloud').locator('button', { hasText: 'React' }).click();

    // Wait for filter to apply
    await expect(page.locator('text=1 matching')).toBeVisible();

    await expect(page).toHaveScreenshot('filtered-results.png', {
      fullPage: true,
    });
  });

  test('no matching videos state', async ({ page }) => {
    await mockHealthApi(page, { ollama: true, models: ['deepseek-r1:8b'] });
    await mockAnalyzeApi(page, MOCK_ANALYSIS);
    await mockThumbnailImages(page);

    await page.goto('/');
    await waitForFonts(page);
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');
    await expect(page.getByTestId('tag-cloud')).toBeVisible();

    // Filter by "Node.js" (no videos have this tag)
    await page.getByTestId('tag-cloud').locator('button', { hasText: 'Node.js' }).click();
    await expect(page.locator('text=No videos match the selected tags')).toBeVisible();

    await expect(page).toHaveScreenshot('no-matching-videos.png', {
      fullPage: true,
    });
  });

  // -----------------------------------------------------------------------
  // Responsive layouts
  // -----------------------------------------------------------------------

  test.describe('Responsive', () => {
    test('mobile viewport – homepage', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/');
      await waitForFonts(page);
      await expect(page.getByTestId('playlist-url-input')).toBeVisible();

      await expect(page).toHaveScreenshot('mobile-homepage.png', {
        fullPage: true,
      });
    });

    test('mobile viewport – results', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await mockHealthApi(page, { ollama: true, models: ['deepseek-r1:8b'] });
      await mockAnalyzeApi(page, MOCK_ANALYSIS);
      await mockThumbnailImages(page);

      await page.goto('/');
      await waitForFonts(page);
      await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');
      await expect(page.locator('text=Test Playlist')).toBeVisible();

      await expect(page).toHaveScreenshot('mobile-results.png', {
        fullPage: true,
      });
    });

    test('tablet viewport – homepage', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');
      await waitForFonts(page);
      await expect(page.getByTestId('playlist-url-input')).toBeVisible();

      await expect(page).toHaveScreenshot('tablet-homepage.png', {
        fullPage: true,
      });
    });
  });
});
