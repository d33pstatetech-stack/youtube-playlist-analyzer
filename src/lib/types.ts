export interface VideoItem {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  tags: string[];
  summary: string[];
  url: string;
}

export interface AnalyzedPlaylist {
  id?: string;
  userId: string;
  playlistId: string;
  playlistTitle: string;
  playlistUrl: string;
  videos: VideoItem[];
  allTags: string[];
  analyzedAt: string;
  videoCount: number;
}
