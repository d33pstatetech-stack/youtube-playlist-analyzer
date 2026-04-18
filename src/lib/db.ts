import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = process.env.SQLITE_DB_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'playlists.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  // Ensure data directory exists
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id        TEXT PRIMARY KEY,
      email     TEXT UNIQUE NOT NULL,
      name      TEXT,
      image     TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      playlist_id     TEXT NOT NULL,
      playlist_title  TEXT NOT NULL,
      video_count     INTEGER NOT NULL DEFAULT 0,
      all_tags        TEXT NOT NULL DEFAULT '[]',
      analyzed_at     TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, playlist_id)
    );

    CREATE TABLE IF NOT EXISTS videos (
      id           TEXT PRIMARY KEY,
      playlist_row TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      video_id     TEXT NOT NULL,
      title        TEXT NOT NULL,
      description  TEXT,
      thumbnail    TEXT,
      channel      TEXT,
      published_at TEXT,
      duration     TEXT,
      tags         TEXT NOT NULL DEFAULT '[]',
      summary      TEXT NOT NULL DEFAULT '[]',
      position     INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON playlists(user_id);
    CREATE INDEX IF NOT EXISTS idx_videos_playlist_row ON videos(playlist_row);
  `);

  return _db;
}

// ─── Users ──────────────────────────────────────────────────────────────────

export function upsertUser(user: {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO users (id, email, name, image)
    VALUES (@id, @email, @name, @image)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      name  = excluded.name,
      image = excluded.image
  `).run(user);
}

// ─── Playlists ───────────────────────────────────────────────────────────────

export interface DbPlaylist {
  id: string;
  userId: string;
  playlistId: string;
  playlistTitle: string;
  videoCount: number;
  allTags: string[];
  analyzedAt: string;
  videos?: DbVideo[];
}

export interface DbVideo {
  id: string;
  videoId: string;
  title: string;
  description?: string;
  thumbnail?: string;
  channel?: string;
  publishedAt?: string;
  duration?: string;
  tags: string[];
  summary: string[];
  position: number;
}

export function getPlaylistsByUser(userId: string): DbPlaylist[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM playlists WHERE user_id = ? ORDER BY created_at DESC
  `).all(userId) as any[];

  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    playlistId: row.playlist_id,
    playlistTitle: row.playlist_title,
    videoCount: row.video_count,
    allTags: JSON.parse(row.all_tags),
    analyzedAt: row.analyzed_at,
  }));
}

export function getPlaylistWithVideos(id: string, userId: string): DbPlaylist | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM playlists WHERE id = ? AND user_id = ?
  `).get(id, userId) as any;

  if (!row) return null;

  const videoRows = db.prepare(`
    SELECT * FROM videos WHERE playlist_row = ? ORDER BY position ASC
  `).all(id) as any[];

  return {
    id: row.id,
    userId: row.user_id,
    playlistId: row.playlist_id,
    playlistTitle: row.playlist_title,
    videoCount: row.video_count,
    allTags: JSON.parse(row.all_tags),
    analyzedAt: row.analyzed_at,
    videos: videoRows.map(v => ({
      id: v.id,
      videoId: v.video_id,
      title: v.title,
      description: v.description,
      thumbnail: v.thumbnail,
      channel: v.channel,
      publishedAt: v.published_at,
      duration: v.duration,
      tags: JSON.parse(v.tags),
      summary: JSON.parse(v.summary),
      position: v.position,
    })),
  };
}

export function savePlaylist(data: DbPlaylist & { videos: DbVideo[] }): DbPlaylist {
  const db = getDb();
  const id = data.id || crypto.randomUUID();

  const insert = db.transaction(() => {
    db.prepare(`
      INSERT INTO playlists (id, user_id, playlist_id, playlist_title, video_count, all_tags, analyzed_at)
      VALUES (@id, @userId, @playlistId, @playlistTitle, @videoCount, @allTags, @analyzedAt)
      ON CONFLICT(user_id, playlist_id) DO UPDATE SET
        playlist_title = excluded.playlist_title,
        video_count    = excluded.video_count,
        all_tags       = excluded.all_tags,
        analyzed_at    = excluded.analyzed_at
    `).run({
      id,
      userId: data.userId,
      playlistId: data.playlistId,
      playlistTitle: data.playlistTitle,
      videoCount: data.videoCount,
      allTags: JSON.stringify(data.allTags),
      analyzedAt: data.analyzedAt,
    });

    // Replace videos
    db.prepare('DELETE FROM videos WHERE playlist_row = ?').run(id);
    const insertVideo = db.prepare(`
      INSERT INTO videos
        (id, playlist_row, video_id, title, description, thumbnail, channel, published_at, duration, tags, summary, position)
      VALUES
        (@id, @playlistRow, @videoId, @title, @description, @thumbnail, @channel, @publishedAt, @duration, @tags, @summary, @position)
    `);
    data.videos.forEach((v, i) => {
      insertVideo.run({
        id: v.id || crypto.randomUUID(),
        playlistRow: id,
        videoId: v.videoId,
        title: v.title,
        description: v.description ?? null,
        thumbnail: v.thumbnail ?? null,
        channel: v.channel ?? null,
        publishedAt: v.publishedAt ?? null,
        duration: v.duration ?? null,
        tags: JSON.stringify(v.tags),
        summary: JSON.stringify(v.summary),
        position: v.position ?? i,
      });
    });
  });

  insert();
  return { ...data, id };
}

export function deletePlaylist(id: string, userId: string): boolean {
  const db = getDb();
  const result = db.prepare(
    'DELETE FROM playlists WHERE id = ? AND user_id = ?'
  ).run(id, userId);
  return result.changes > 0;
}
