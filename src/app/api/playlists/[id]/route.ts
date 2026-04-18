import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPlaylistWithVideos, deletePlaylist } from '@/lib/db';

// GET /api/playlists/[id] — fetch playlist + videos
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as any).id as string;
  const playlist = getPlaylistWithVideos(params.id, userId);
  if (!playlist) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(playlist);
}

// DELETE /api/playlists/[id] — remove a saved playlist
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as any).id as string;
  const deleted = deletePlaylist(params.id, userId);
  if (!deleted) {
    return NextResponse.json({ error: 'Not found or not yours' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
