import { NextRequest, NextResponse } from 'next/server';
import { cacheLife, cacheTag } from 'next/cache';
import { VideoItem } from '@/lib/types';
import { extractPlaylistId } from '@/lib/youtube';

interface YouTubePlaylistItemSnippet {
  title: string;
  description: string;
  thumbnails: { medium?: { url: string }; default?: { url: string } };
  channelTitle: string;
  publishedAt: string;
  resourceId: { videoId: string };
}

interface YouTubePlaylistItem {
  snippet: YouTubePlaylistItemSnippet;
}


async function fetchAllPlaylistItems(playlistId: string, apiKey: string) {
  const items: YouTubePlaylistItem[] = [];
  let nextPageToken = '';

  do {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${apiKey}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'YouTube API error');
    }
    const data = await res.json();
    items.push(...data.items);
    nextPageToken = data.nextPageToken || '';
  } while (nextPageToken);

  return items;
}

async function fetchPlaylistTitle(playlistId: string, apiKey: string): Promise<string> {
  const url = `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return 'Unknown Playlist';
  const data = await res.json();
  return data.items?.[0]?.snippet?.title || 'Unknown Playlist';
}

/** Shared prompt builder for video analysis. */
function buildAnalysisPrompt(batch: { title: string; description: string }[], batchSize: number): string {
  return `Analyze these YouTube videos. For each video, provide:
1. 2-5 topic tags (short, lowercase, single or two words)
2. 2-4 bullet point summary (brief, informative)

Return ONLY valid JSON array. Each element: {"tags": ["tag1", "tag2"], "summary": ["point 1", "point 2"]}

Videos:
${batch.map((v, idx) => `${idx + 1}. Title: ${v.title}\nDescription: ${v.description?.substring(0, 300) || 'No description'}`).join('\n\n')}

Return exactly ${batchSize} objects in the JSON array. ONLY the JSON array, no markdown.`;
}

/** Extract and parse the JSON array from an LLM response string. */
function parseAnalysisResponse(text: string): { tags: string[]; summary: string[] }[] {
  // Strip <think>...</think> blocks (deepseek-r1 reasoning traces)
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  // Extract JSON from possible markdown code blocks
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  const raw = jsonMatch ? jsonMatch[0] : cleaned.trim();
  const parsed = JSON.parse(raw);

  // Normalize: smaller models (e.g. deepseek-r1:8b) may return a single
  // object instead of the requested array, or an object wrapping the array.
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed && typeof parsed === 'object') {
    // Single video result — wrap in array
    if (parsed.tags || parsed.summary) {
      return [parsed];
    }
    // Object wrapping an array — find the first array-valued property
    for (const value of Object.values(parsed)) {
      if (Array.isArray(value) && value.length > 0 && value[0]?.tags) {
        return value as { tags: string[]; summary: string[] }[];
      }
    }
  }

  throw new Error('Unexpected response structure from LLM');
}

async function analyzeWithGemini(videos: { title: string; description: string }[]): Promise<{ tags: string[]; summary: string[] }[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key not configured');

  const BATCH_SIZE = 20;
  const results: { tags: string[]; summary: string[] }[] = [];

  for (let i = 0; i < videos.length; i += BATCH_SIZE) {
    const batch = videos.slice(i, i + BATCH_SIZE);
    const prompt = buildAnalysisPrompt(batch, batch.length);

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
        }),
      }
    );

    if (!res.ok) {
      console.error('Gemini API error:', await res.text());
      throw new Error('Gemini API request failed — will not cache degraded results');
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    try {
      const parsed = parseAnalysisResponse(text);
      results.push(...parsed);
    } catch {
      console.error('Failed to parse Gemini response');
      throw new Error('Failed to parse Gemini response — will not cache degraded results');
    }
  }

  return results;
}

const OLLAMA_TIMEOUT_MS = 120_000; // 2 minutes per batch — local LLMs can be slow

async function analyzeWithOllama(videos: { title: string; description: string }[]): Promise<{ tags: string[]; summary: string[] }[]> {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'deepseek-r1:8b';

  const BATCH_SIZE = 5; // small batches for local LLMs — improves per-video output reliability
  const results: { tags: string[]; summary: string[] }[] = [];

  for (let i = 0; i < videos.length; i += BATCH_SIZE) {
    const batch = videos.slice(i, i + BATCH_SIZE);
    const prompt = buildAnalysisPrompt(batch, batch.length);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          format: 'json', // force valid JSON output from the model
          options: { temperature: 0.3 },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        throw new Error(`Ollama request timed out after ${OLLAMA_TIMEOUT_MS / 1000}s`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error('Ollama API error:', errText);
      throw new Error(`Ollama API request failed (${res.status}) — ${errText}`);
    }

    const data = await res.json();
    const text: string = data.response || '[]';

    try {
      const parsed = parseAnalysisResponse(text);
      results.push(...parsed);
    } catch {
      console.error('Failed to parse Ollama response:', text.substring(0, 200));
      throw new Error('Failed to parse Ollama response — will not cache degraded results');
    }
  }

  return results;
}

type AiProvider = 'gemini' | 'ollama' | 'auto';

/**
 * Analyze videos using the configured AI provider.
 *
 * AI_PROVIDER env var controls behaviour:
 * - "gemini" → Gemini only (fails if Gemini is unavailable)
 * - "ollama" → Ollama only (skips Gemini entirely, avoids wasted latency)
 * - "auto" (default) → try Gemini first, fall back to Ollama on failure
 *
 * Returns the analysis results together with the name of the provider that
 * produced them, so the UI can display this for transparency.
 */
async function analyzeVideos(videos: { title: string; description: string }[], overrideProvider?: string): Promise<{ results: { tags: string[]; summary: string[] }[]; provider: string }> {
  // Client-requested provider takes priority; otherwise fall back to env var / "auto".
  const rawProvider = overrideProvider || process.env.AI_PROVIDER || 'auto';
  const validProviders: AiProvider[] = ['gemini', 'ollama', 'auto'];
  const isValid = validProviders.includes(rawProvider as AiProvider);
  const provider: AiProvider = isValid ? (rawProvider as AiProvider) : 'auto';
  if (!isValid) {
    console.warn(`Invalid AI_PROVIDER="${rawProvider}", falling back to "auto". Valid values: ${validProviders.join(', ')}`);
  }

  if (provider === 'ollama') {
    console.log('AI_PROVIDER=ollama — using Ollama directly');
    const results = await analyzeWithOllama(videos);
    return { results, provider: 'ollama' };
  }

  if (provider === 'gemini') {
    console.log('AI_PROVIDER=gemini — using Gemini directly');
    const results = await analyzeWithGemini(videos);
    return { results, provider: 'gemini' };
  }

  // "auto" — try Gemini first, fall back to Ollama
  try {
    console.log('Attempting analysis with Gemini API…');
    const results = await analyzeWithGemini(videos);
    return { results, provider: 'gemini' };
  } catch (geminiError) {
    console.warn('Gemini failed, falling back to Ollama:', geminiError instanceof Error ? geminiError.message : geminiError);
    try {
      console.log('Attempting analysis with Ollama (local LLM)…');
      const results = await analyzeWithOllama(videos);
      return { results, provider: 'ollama' };
    } catch (ollamaError) {
      console.error('Both Gemini and Ollama failed.');
      const geminiMsg = geminiError instanceof Error ? geminiError.message : String(geminiError);
      const ollamaMsg = ollamaError instanceof Error ? ollamaError.message : String(ollamaError);
      throw new Error(`All AI providers failed. Gemini: ${geminiMsg}. Ollama: ${ollamaMsg}`);
    }
  }
}

interface PlaylistAnalysisResult {
  playlistId: string;
  playlistTitle: string;
  videos: VideoItem[];
  allTags: string[];
  videoCount: number;
  analyzedAt: string;
  provider: string;
}

/**
 * Cached helper function that performs the full playlist analysis.
 * Results are cached per playlistId with a 'hours' cache life,
 * so repeated analyses of the same playlist return instantly.
 * Tagged with `playlist-{id}` for on-demand revalidation.
 */
async function getPlaylistAnalysis(playlistId: string, providerOverride?: string): Promise<PlaylistAnalysisResult> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('YouTube API key not configured');

  // Fetch playlist info and items in parallel
  const [playlistTitle, items] = await Promise.all([
    fetchPlaylistTitle(playlistId, apiKey),
    fetchAllPlaylistItems(playlistId, apiKey),
  ]);

  // Analyze videos with AI
  const videoData = items.map(item => ({
    title: item.snippet.title,
    description: item.snippet.description,
  }));

  const { results: analyses, provider } = await analyzeVideos(videoData, providerOverride);

  // Combine data
  const videos = items.map((item, idx) => ({
    id: item.snippet.resourceId.videoId,
    title: item.snippet.title,
    description: item.snippet.description?.substring(0, 200) || '',
    thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    tags: analyses[idx]?.tags || [],
    summary: analyses[idx]?.summary || [],
    url: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
  }));

  // Collect all unique tags
  const allTags = [...new Set(videos.flatMap(v => v.tags))].sort();

  return {
    playlistId,
    playlistTitle,
    videos,
    allTags,
    videoCount: videos.length,
    analyzedAt: new Date().toISOString(),
    provider,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { url, provider: requestedProvider } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const playlistId = extractPlaylistId(url);
    if (!playlistId) {
      return NextResponse.json({ error: 'Invalid YouTube playlist URL' }, { status: 400 });
    }

    const analysis = await getPlaylistAnalysis(playlistId, requestedProvider);

    return NextResponse.json({
      ...analysis,
      playlistUrl: url,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
