/**
 * Extracts a YouTube playlist ID from a URL.
 *
 * Supports any URL containing a `list` query parameter whose value
 * consists of letters, digits, underscores, and hyphens
 * (e.g. PLrAXtmErZfOvBR05mWkPoVYmYK7R1wjNO).
 *
 * @returns The playlist ID string, or `null` if no valid ID is found.
 */
export function extractPlaylistId(url: string): string | null {
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}
