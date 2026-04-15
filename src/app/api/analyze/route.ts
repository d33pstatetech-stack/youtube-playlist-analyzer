import { NextRequest, NextResponse } from 'next/server';

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

interface PlaylistSnippet {
  title: string;
}

interface PlaylistInfo {
  snippet: PlaylistSnippet;
}

function extractPlaylistId(url: string): string | null {
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
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

async function analyzeWithGemini(videos: { title: string; description: string }[]): Promise<{ tags: string[]; summary: string[] }[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key not configured');

  const BATCH_SIZE = 20;
  const results: { tags: string[]; summary: string[] }[] = [];

  for (let i = 0; i < videos.length; i += BATCH_SIZE) {
    const batch = videos.slice(i, i + BATCH_SIZE);
    const prompt = `Analyze these YouTube videos. For each video, provide:
1. 2-5 topic tags (short, lowercase, single or two words)
2. 2-4 bullet point summary (brief, informative)

Return ONLY valid JSON array. Each element: {"tags": ["tag1", "tag2"], "summary": ["point 1", "point 2"]}

Videos:
${batch.map((v, idx) => `${idx + 1}. Title: ${v.title}\nDescription: ${v.description?.substring(0, 300) || 'No description'}`).join('\n\n')}

Return exactly ${batch.length} objects in the JSON array. ONLY the JSON array, no markdown.`;

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
      // Fallback: generate basic tags from title
      results.push(...batch.map(v => ({
        tags: v.title.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 3),
        summary: ['Video content - analysis unavailable'],
      })));
      continue;
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    try {
      // Extract JSON from possible markdown code blocks
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      results.push(...parsed);
    } catch {
      console.error('Failed to parse Gemini response');
      results.push(...batch.map(v => ({
        tags: v.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3).slice(0, 3),
        summary: ['Video content - analysis unavailable'],
      })));
    }
  }

  return results;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const playlistId = extractPlaylistId(url);
    if (!playlistId) {
      return NextResponse.json({ error: 'Invalid YouTube playlist URL' }, { status: 400 });
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 });
    }

    // Fetch playlist info and items
    const [playlistTitle, items] = await Promise.all([
      fetchPlaylistTitle(playlistId, apiKey),
      fetchAllPlaylistItems(playlistId, apiKey),
    ]);

    // Analyze videos with AI
    const videoData = items.map(item => ({
      title: item.snippet.title,
      description: item.snippet.description,
    }));

    const analyses = await analyzeWithGemini(videoData);

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

    return NextResponse.json({
      playlistId,
      playlistTitle,
      playlistUrl: url,
      videos,
      allTags,
      videoCount: videos.length,
      analyzedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
