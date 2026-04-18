import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPlaylistsByUser, savePlaylist } from '@/lib/db';

// GET /api/playlists — list all saved playlists for current user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as any).id as string;
  const playlists = getPlaylistsByUser(userId);
  return NextResponse.json(playlists);
}

// POST /api/playlists — save a new analyzed playlist
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as any).id as string;

  const body = await req.json();
  const saved = savePlaylist({ ...body, userId });
  return NextResponse.json(saved, { status: 201 });
}
