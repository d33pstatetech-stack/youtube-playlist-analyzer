import { NextResponse } from 'next/server';

/**
 * Health-check endpoint for Ollama.
 * Pings the Ollama /api/tags endpoint (lightweight read-only call)
 * and reports whether Ollama is reachable.
 */
export async function GET() {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const timeoutMs = 5_000; // 5s timeout — local network should be fast

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { ollama: false, error: `Ollama returned ${res.status}` },
        { status: 200 }, // still 200 so the client can read the status
      );
    }

    const data = await res.json();
    const models: string[] = (data.models || []).map((m: { name: string }) => m.name);
    const configuredModel = process.env.OLLAMA_MODEL || 'deepseek-r1:8b';
    const modelAvailable = models.some(m => m === configuredModel || m.startsWith(configuredModel.split(':')[0]));

    return NextResponse.json({
      ollama: true,
      models,
      modelAvailable,
      configuredModel,
    });
  } catch (err) {
    const message = err instanceof Error && err.name === 'AbortError'
      ? 'Connection timed out'
      : err instanceof Error
        ? err.message
        : 'Unreachable';

    return NextResponse.json(
      { ollama: false, error: message },
      { status: 200 },
    );
  }
}
