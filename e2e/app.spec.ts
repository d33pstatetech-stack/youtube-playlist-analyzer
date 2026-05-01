import { test, expect } from '@playwright/test';
import { MOCK_ANALYSIS, mockAnalyzeApi, mockHealthApi, analyzeUrl, tagButton } from './helpers';

// ===========================================================================
// Test suite
// ===========================================================================

test.describe('YouTube Playlist Analyzer', () => {
  // -----------------------------------------------------------------------
  // Page load
  // -----------------------------------------------------------------------

  test('loads the homepage with correct title and header', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Playlist Analyzer/i);

    const header = page.locator('header');
    await expect(header.locator('text=Playlist Analyzer')).toBeVisible();
    await expect(header.locator('text=AI-powered YouTube playlist insights')).toBeVisible();
  });

  test('shows the hero section with input and analyze button', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('text=Analyze Any YouTube Playlist')).toBeVisible();
    await expect(page.locator('text=Paste a playlist URL to get AI-powered topic tags')).toBeVisible();

    const input = page.getByTestId('playlist-url-input');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', /Paste a YouTube playlist URL/i);

    const analyzeBtn = page.getByTestId('analyze-button');
    await expect(analyzeBtn).toBeVisible();

    // Provider selector should be visible with all three options
    await expect(page.getByTestId('provider-auto')).toBeVisible();
    await expect(page.getByTestId('provider-gemini')).toBeVisible();
    await expect(page.getByTestId('provider-ollama')).toBeVisible();
  });

  test('shows footer text', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toContainText('YouTube Playlist Analyzer');
    await expect(footer).toContainText('Next.js, Firebase & AI');
  });

  // -----------------------------------------------------------------------
  // Provider selector
  // -----------------------------------------------------------------------

  test('provider selector switches between Auto, Gemini, and Ollama', async ({ page }) => {
    await page.goto('/');

    // Auto is selected by default
    await expect(page.getByTestId('provider-auto')).toHaveClass(/bg-purple-600/);

    // Click Ollama
    await page.getByTestId('provider-ollama').click();
    await expect(page.getByTestId('provider-ollama')).toHaveClass(/bg-purple-600/);
    await expect(page.getByTestId('provider-auto')).not.toHaveClass(/bg-purple-600/);

    // Click Gemini
    await page.getByTestId('provider-gemini').click();
    await expect(page.getByTestId('provider-gemini')).toHaveClass(/bg-purple-600/);

    // Click back to Auto
    await page.getByTestId('provider-auto').click();
    await expect(page.getByTestId('provider-auto')).toHaveClass(/bg-purple-600/);
  });

  test('provider selector is disabled during analysis', async ({ page }) => {
    await mockAnalyzeApi(page, MOCK_ANALYSIS, 200, 2000);

    await page.goto('/');
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');

    // Provider buttons should be disabled during loading
    await expect(page.getByTestId('provider-auto')).toBeDisabled();
    await expect(page.getByTestId('provider-gemini')).toBeDisabled();
    await expect(page.getByTestId('provider-ollama')).toBeDisabled();

    // Wait for completion — buttons should be re-enabled
    await expect(page.locator('text=Test Playlist')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('provider-auto')).toBeEnabled();
  });

  test('selecting Ollama shows slower helper text during loading', async ({ page }) => {
    await mockAnalyzeApi(page, MOCK_ANALYSIS, 200, 2000);

    await page.goto('/');

    // Select Ollama provider
    await page.getByTestId('provider-ollama').click();
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');

    // Should show Ollama-specific loading message
    await expect(page.locator('text=/analyzing with Ollama/')).toBeVisible();
    await expect(page.locator('text=Local LLMs are slower')).toBeVisible();

    // Wait for completion
    await expect(page.locator('text=Test Playlist')).toBeVisible({ timeout: 15_000 });
  });

  test('selected provider is sent in the API request body', async ({ page }) => {
    // Capture the request body sent to /api/analyze
    let capturedBody: Record<string, string> | null = null;
    await page.route('/api/analyze', async (route) => {
      const request = route.request();
      capturedBody = request.postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ANALYSIS),
      });
    });

    await page.goto('/');

    // With Auto selected (default)
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');
    await expect(page.locator('text=Test Playlist')).toBeVisible();
    expect(capturedBody).toBeTruthy();
    expect(capturedBody!.provider).toBe('auto');
    expect(capturedBody!.url).toContain('PL_TEST123');

    // Switch to Ollama and re-analyze
    await page.getByTestId('provider-ollama').click();
    capturedBody = null;
    await page.getByTestId('analyze-button').click();
    await expect(page.locator('text=Test Playlist')).toBeVisible();
    expect(capturedBody!.provider).toBe('ollama');

    // Switch to Gemini and re-analyze
    await page.getByTestId('provider-gemini').click();
    capturedBody = null;
    await page.getByTestId('analyze-button').click();
    await expect(page.locator('text=Test Playlist')).toBeVisible();
    expect(capturedBody!.provider).toBe('gemini');
  });

  // -----------------------------------------------------------------------
  // Ollama health status
  // -----------------------------------------------------------------------

  test('shows Ollama status dot next to the Ollama provider button', async ({ page }) => {
    await mockHealthApi(page, { ollama: true, models: ['deepseek-r1:8b'] });
    await page.goto('/');

    // Status dot should be visible
    const dot = page.getByTestId('ollama-status-dot');
    await expect(dot).toBeVisible();
  });

  test('shows green dot when Ollama is online with the configured model', async ({ page }) => {
    await mockHealthApi(page, { ollama: true, models: ['deepseek-r1:8b'], modelAvailable: true });
    await page.goto('/');

    const dot = page.getByTestId('ollama-status-dot');
    await expect(dot).toBeVisible();
    await expect(dot).toHaveClass(/bg-emerald-400/);
  });

  test('shows amber dot when Ollama is online but model is not pulled', async ({ page }) => {
    await mockHealthApi(page, { ollama: true, models: ['llama3:8b'], modelAvailable: false });
    await page.goto('/');

    const dot = page.getByTestId('ollama-status-dot');
    await expect(dot).toBeVisible();
    await expect(dot).toHaveClass(/bg-amber-400/);
  });

  test('shows red dot when Ollama is offline', async ({ page }) => {
    await mockHealthApi(page, { ollama: false, error: 'Connection refused' });
    await page.goto('/');

    const dot = page.getByTestId('ollama-status-dot');
    await expect(dot).toBeVisible();
    await expect(dot).toHaveClass(/bg-red-400/);
  });

  // -----------------------------------------------------------------------
  // Ollama offline/partial warning banner
  // -----------------------------------------------------------------------

  test('shows red warning banner when Ollama is selected but offline', async ({ page }) => {
    await mockHealthApi(page, { ollama: false, error: 'Connection refused' });
    await page.goto('/');

    // No banner when Auto is selected (default)
    await expect(page.getByTestId('ollama-warning-banner')).not.toBeVisible();

    // Switch to Ollama — banner should appear
    await page.getByTestId('provider-ollama').click();
    const banner = page.getByTestId('ollama-warning-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Ollama is not reachable');
    await expect(banner).toContainText('localhost:11434');
    // Banner should have red styling
    await expect(banner).toHaveClass(/bg-red-500/);
  });

  test('shows amber warning banner when Ollama is selected but model is not pulled', async ({ page }) => {
    await mockHealthApi(page, { ollama: true, models: ['llama3:8b'], modelAvailable: false });
    await page.goto('/');

    // Switch to Ollama — amber banner should appear
    await page.getByTestId('provider-ollama').click();
    const banner = page.getByTestId('ollama-warning-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('configured model is not pulled');
    await expect(banner).toHaveClass(/bg-amber-500/);
  });

  test('no warning banner when Ollama is selected and online with model', async ({ page }) => {
    await mockHealthApi(page, { ollama: true, models: ['deepseek-r1:8b'], modelAvailable: true });
    await page.goto('/');

    // Wait for health check to resolve (status dot turns green) before checking banner
    await expect(page.getByTestId('ollama-status-dot')).toHaveClass(/bg-emerald-400/);

    // Switch to Ollama — no banner since everything is fine
    await page.getByTestId('provider-ollama').click();
    await expect(page.getByTestId('ollama-warning-banner')).not.toBeVisible();
  });

  test('warning banner disappears when switching away from Ollama', async ({ page }) => {
    await mockHealthApi(page, { ollama: false, error: 'Connection refused' });
    await page.goto('/');

    // Switch to Ollama — banner appears
    await page.getByTestId('provider-ollama').click();
    await expect(page.getByTestId('ollama-warning-banner')).toBeVisible();

    // Switch to Gemini — banner disappears
    await page.getByTestId('provider-gemini').click();
    await expect(page.getByTestId('ollama-warning-banner')).not.toBeVisible();

    // Switch back to Ollama — banner reappears
    await page.getByTestId('provider-ollama').click();
    await expect(page.getByTestId('ollama-warning-banner')).toBeVisible();
  });

  test('shows gray checking banner when Ollama is selected but health check is pending', async ({ page }) => {
    // Delay the health check so we can observe the "unknown" state
    await page.route('/api/health', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ollama: true, models: ['deepseek-r1:8b'], modelAvailable: true, configuredModel: 'deepseek-r1:8b' }),
      });
    });

    await page.goto('/');

    // Quickly switch to Ollama before health check resolves
    await page.getByTestId('provider-ollama').click();
    const banner = page.getByTestId('ollama-warning-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Checking Ollama connection');
    await expect(banner).toHaveClass(/bg-gray-500/);
  });

  // -----------------------------------------------------------------------
  // Input validation
  // -----------------------------------------------------------------------

  test('analyze button is disabled when input is empty', async ({ page }) => {
    await page.goto('/');
    const analyzeBtn = page.getByTestId('analyze-button');
    await expect(analyzeBtn).toBeDisabled();
  });

  test('analyze button becomes enabled when text is entered', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('playlist-url-input').fill('https://www.youtube.com/playlist?list=PL_TEST123');
    const analyzeBtn = page.getByTestId('analyze-button');
    await expect(analyzeBtn).toBeEnabled();
  });

  // -----------------------------------------------------------------------
  // Validation errors from the API
  // -----------------------------------------------------------------------

  test('shows error when API returns "URL is required"', async ({ page }) => {
    await mockAnalyzeApi(page, { error: 'URL is required' }, 400);

    await page.goto('/');
    // Use a syntactically valid URL so the browser's native type="url" validation
    // doesn't block the form submission. The mock API still returns the error.
    await analyzeUrl(page, 'https://not-a-playlist.com');

    await expect(page.getByTestId('error-box')).toBeVisible();
    await expect(page.getByTestId('error-detail')).toContainText('URL is required');
  });

  test('shows error for invalid YouTube playlist URL', async ({ page }) => {
    await mockAnalyzeApi(page, { error: 'Invalid YouTube playlist URL' }, 400);

    await page.goto('/');
    await analyzeUrl(page, 'https://example.com/not-a-playlist');

    await expect(page.getByTestId('error-box')).toBeVisible();
    await expect(page.getByTestId('error-detail')).toContainText('Invalid YouTube playlist URL');
  });

  test('clears previous error on re-analysis', async ({ page }) => {
    // First call returns an error, second call succeeds
    let callCount = 0;
    await page.route('/api/analyze', async (route) => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid YouTube playlist URL' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_ANALYSIS),
        });
      }
    });

    await page.goto('/');

    // First attempt → error (use a syntactically valid URL so type="url" validation passes)
    await analyzeUrl(page, 'https://bad-url.com');
    await expect(page.getByTestId('error-box')).toBeVisible();

    // Second attempt → success (error should disappear)
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');
    await expect(page.locator('text=Test Playlist')).toBeVisible();
    await expect(page.getByTestId('error-box')).not.toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Successful analysis flow
  // -----------------------------------------------------------------------

  test('displays playlist results after successful analysis', async ({ page }) => {
    await mockAnalyzeApi(page, MOCK_ANALYSIS);

    await page.goto('/');
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');

    // Playlist title & video count
    await expect(page.locator('text=Test Playlist')).toBeVisible();
    await expect(page.locator('text=3 videos')).toBeVisible();

    // Tag cloud section
    await expect(page.getByRole('heading', { name: /Filter by Topics/i })).toBeVisible();
    await expect(tagButton(page, 'JavaScript')).toBeVisible();
    await expect(tagButton(page, 'React')).toBeVisible();
    await expect(tagButton(page, 'TypeScript')).toBeVisible();

    // Video cards
    await expect(page.locator('[data-testid="video-card"]', { hasText: 'Intro to React' })).toBeVisible();
    await expect(page.locator('[data-testid="video-card"]', { hasText: 'TypeScript Deep Dive' })).toBeVisible();
    await expect(page.locator('[data-testid="video-card"]', { hasText: 'CSS Grid Layout' })).toBeVisible();

    // Video summary points
    await expect(page.locator('text=Component basics')).toBeVisible();
    await expect(page.locator('text=Generic types')).toBeVisible();
    await expect(page.locator('text=Grid template areas')).toBeVisible();

    // Channel names
    await expect(page.locator('text=Code Academy')).toBeVisible();
    await expect(page.locator('text=TS Masters')).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  test('shows loading spinner while analysis is in progress', async ({ page }) => {
    // Delay the API response so we can observe the loading state
    await mockAnalyzeApi(page, MOCK_ANALYSIS, 200, 2000);

    await page.goto('/');
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');

    // Button should show "Analyzing..."
    await expect(page.getByTestId('analyze-button')).toContainText('Analyzing...');

    // Input should be disabled during loading
    await expect(page.getByTestId('playlist-url-input')).toBeDisabled();

    // Progress message — the provider label is dynamic based on selected provider
    await expect(page.locator('text=/Fetching playlist videos and analyzing with .+\.\.\./')).toBeVisible();
    // Helper text differs for local vs cloud providers — match either variant
    await expect(page.locator('text=/This may take a minute for large playlists|Local LLMs are slower/')).toBeVisible();

    // Wait for completion — input should be re-enabled
    await expect(page.locator('text=Test Playlist')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('playlist-url-input')).toBeEnabled();
  });

  // -----------------------------------------------------------------------
  // Tag filtering
  // -----------------------------------------------------------------------

  test('clicking a tag filters videos to those with that tag', async ({ page }) => {
    await mockAnalyzeApi(page, MOCK_ANALYSIS);

    await page.goto('/');
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');
    await expect(page.locator('text=Test Playlist')).toBeVisible();

    // Click the "React" tag in the tag cloud
    await tagButton(page, 'React').click();

    // Only videos tagged "React" should be visible (Intro to React)
    await expect(page.locator('[data-testid="video-card"]', { hasText: 'Intro to React' })).toBeVisible();
    // CSS Grid Layout has tag "CSS" only – should be hidden
    await expect(page.locator('[data-testid="video-card"]', { hasText: 'CSS Grid Layout' })).not.toBeVisible();

    // "1 matching" count
    await expect(page.locator('text=1 matching')).toBeVisible();
  });

  test('selecting multiple tags shows videos with any of the selected tags', async ({ page }) => {
    await mockAnalyzeApi(page, MOCK_ANALYSIS);

    await page.goto('/');
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');
    await expect(page.locator('text=Test Playlist')).toBeVisible();

    // Select "React" and "CSS" tags
    await tagButton(page, 'React').click();
    await tagButton(page, 'CSS').click();

    // "Intro to React" (React, JavaScript) and "CSS Grid Layout" (CSS) should show
    await expect(page.locator('[data-testid="video-card"]', { hasText: 'Intro to React' })).toBeVisible();
    await expect(page.locator('[data-testid="video-card"]', { hasText: 'CSS Grid Layout' })).toBeVisible();

    // "TypeScript Deep Dive" only has TypeScript & JavaScript tags – should be hidden
    await expect(page.locator('[data-testid="video-card"]', { hasText: 'TypeScript Deep Dive' })).not.toBeVisible();

    // "2 matching"
    await expect(page.locator('text=2 matching')).toBeVisible();
  });

  test('Clear all button resets tag selection and shows all videos', async ({ page }) => {
    await mockAnalyzeApi(page, MOCK_ANALYSIS);

    await page.goto('/');
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');
    await expect(page.locator('text=Test Playlist')).toBeVisible();

    // Select a tag
    await tagButton(page, 'React').click();
    await expect(page.locator('[data-testid="video-card"]', { hasText: 'CSS Grid Layout' })).not.toBeVisible();

    // Click "Clear all"
    await page.locator('button', { hasText: /Clear all/i }).click();

    // All videos should be back
    await expect(page.locator('[data-testid="video-card"]', { hasText: 'Intro to React' })).toBeVisible();
    await expect(page.locator('[data-testid="video-card"]', { hasText: 'CSS Grid Layout' })).toBeVisible();
    await expect(page.locator('[data-testid="video-card"]', { hasText: 'TypeScript Deep Dive' })).toBeVisible();
  });

  test('shows "No videos match" message when no videos have the selected tags', async ({ page }) => {
    await mockAnalyzeApi(page, MOCK_ANALYSIS);

    await page.goto('/');
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');
    await expect(page.locator('text=Test Playlist')).toBeVisible();

    // Select "Node.js" tag (no videos have this tag)
    await tagButton(page, 'Node.js').click();

    await expect(page.locator('text=No videos match the selected tags')).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Error recovery scenarios
  // -----------------------------------------------------------------------

  test('shows error and allows retry after network timeout', async ({ page }) => {
    // First call aborts the request (simulates network failure/timeout)
    let callCount = 0;
    await page.route('/api/analyze', async (route) => {
      callCount++;
      if (callCount === 1) {
        await route.abort('timedout');
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_ANALYSIS),
        });
      }
    });

    await page.goto('/');
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');

    // Error should appear with a network-related message
    await expect(page.getByTestId('error-box')).toBeVisible();

    // Input should be re-enabled after error
    await expect(page.getByTestId('playlist-url-input')).toBeEnabled();

    // Analyze button should be enabled (URL is still filled in)
    await expect(page.getByTestId('analyze-button')).toBeEnabled();

    // Retry → success
    await page.getByTestId('analyze-button').click();
    await expect(page.locator('text=Test Playlist')).toBeVisible();
    await expect(page.getByTestId('error-box')).not.toBeVisible();
  });

  test('shows error and allows retry after server 500 error', async ({ page }) => {
    let callCount = 0;
    await page.route('/api/analyze', async (route) => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'YouTube API key not configured' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_ANALYSIS),
        });
      }
    });

    await page.goto('/');
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');

    // Error should display with the server's error message
    await expect(page.getByTestId('error-box')).toBeVisible();
    await expect(page.getByTestId('error-detail')).toContainText('YouTube API key not configured');

    // Input should be re-enabled after error
    await expect(page.getByTestId('playlist-url-input')).toBeEnabled();

    // Retry → success
    await page.getByTestId('analyze-button').click();
    await expect(page.locator('text=Test Playlist')).toBeVisible();
    await expect(page.getByTestId('error-box')).not.toBeVisible();
  });

  test('shows error and allows retry after rate limiting (429)', async ({ page }) => {
    let callCount = 0;
    await page.route('/api/analyze', async (route) => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_ANALYSIS),
        });
      }
    });

    await page.goto('/');
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');

    // Error should display with the rate limit message
    await expect(page.getByTestId('error-box')).toBeVisible();
    await expect(page.getByTestId('error-detail')).toContainText('Rate limit exceeded');

    // Input should be re-enabled after error
    await expect(page.getByTestId('playlist-url-input')).toBeEnabled();

    // Retry → success
    await page.getByTestId('analyze-button').click();
    await expect(page.locator('text=Test Playlist')).toBeVisible();
    await expect(page.getByTestId('error-box')).not.toBeVisible();
  });

  test('recovers from consecutive network failures', async ({ page }) => {
    // Simulate two consecutive failures, then success
    let callCount = 0;
    await page.route('/api/analyze', async (route) => {
      callCount++;
      if (callCount <= 2) {
        await route.abort('failed');
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_ANALYSIS),
        });
      }
    });

    await page.goto('/');

    // First attempt → network failure
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');
    await expect(page.getByTestId('error-box')).toBeVisible();

    // Second attempt → another network failure
    await page.getByTestId('analyze-button').click();
    await expect(page.getByTestId('error-box')).toBeVisible();

    // Third attempt → success
    await page.getByTestId('analyze-button').click();
    await expect(page.locator('text=Test Playlist')).toBeVisible();
    await expect(page.getByTestId('error-box')).not.toBeVisible();
  });

  test('shows generic error message when server returns 500 without error body', async ({ page }) => {
    await page.route('/api/analyze', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'text/plain',
        body: 'Internal Server Error',
      });
    });

    await page.goto('/');
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');

    // Should show the Analysis Error box
    await expect(page.getByTestId('error-box')).toBeVisible();

    // The client tries res.json() on the non-JSON body → SyntaxError, which is
    // caught and displayed. The exact message varies by browser, so we verify
    // that the error detail element has some text content.
    const errorDetail = page.getByTestId('error-detail');
    await expect(errorDetail).toBeVisible();
    const detailText = await errorDetail.textContent();
    expect(detailText!.length).toBeGreaterThan(0);

    // Input should be re-enabled
    await expect(page.getByTestId('playlist-url-input')).toBeEnabled();
  });

  test('transitions from loading to error when server slowly returns 500', async ({ page }) => {
    // Simulate a slow server that takes time before returning a 500 error
    // (e.g., YouTube API succeeds but Gemini times out on the server side)
    let callCount = 0;
    await page.route('/api/analyze', async (route) => {
      callCount++;
      if (callCount === 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Gemini API request failed — will not cache degraded results' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_ANALYSIS),
        });
      }
    });

    await page.goto('/');
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');

    // First, the loading state should be visible
    await expect(page.getByTestId('analyze-button')).toContainText('Analyzing...');
    await expect(page.getByTestId('playlist-url-input')).toBeDisabled();

    // Then the error should replace the loading state
    await expect(page.getByTestId('error-box')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('error-detail')).toContainText('Gemini API request failed');

    // Loading spinner should be gone, input re-enabled
    await expect(page.getByTestId('playlist-url-input')).toBeEnabled();

    // Retry → success
    await page.getByTestId('analyze-button').click();
    await expect(page.locator('text=Test Playlist')).toBeVisible();
  });

  test('recovers from Gemini API failure followed by success', async ({ page }) => {
    let callCount = 0;
    await page.route('/api/analyze', async (route) => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Gemini API request failed — will not cache degraded results' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_ANALYSIS),
        });
      }
    });

    await page.goto('/');
    await analyzeUrl(page, 'https://www.youtube.com/playlist?list=PL_TEST123');

    // Should show the Gemini-specific error message
    await expect(page.getByTestId('error-box')).toBeVisible();
    await expect(page.getByTestId('error-detail')).toContainText('Gemini API request failed');

    // Retry → success
    await page.getByTestId('analyze-button').click();
    await expect(page.locator('text=Test Playlist')).toBeVisible();
    await expect(page.locator('text=3 videos')).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Dark theme (resilient check)
  // -----------------------------------------------------------------------

  test('has dark background theme', async ({ page }) => {
    await page.goto('/');
    const body = page.locator('body');
    const isDark = await body.evaluate((el) => {
      const { r, g, b } = parseRgb(getComputedStyle(el).backgroundColor);
      // All channels should be low (≤30) for a dark background
      return r <= 30 && g <= 30 && b <= 30;

      function parseRgb(str: string) {
        const m = str.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        return m ? { r: +m[1], g: +m[2], b: +m[3] } : { r: 255, g: 255, b: 255 };
      }
    });
    expect(isDark).toBeTruthy();
  });
});
