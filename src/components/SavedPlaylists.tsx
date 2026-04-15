'use client';

import { AnalyzedPlaylist } from '@/lib/types';
import { FiList, FiTrash2, FiClock } from 'react-icons/fi';

interface SavedPlaylistsProps {
  playlists: AnalyzedPlaylist[];
  onLoad: (playlist: AnalyzedPlaylist) => void;
  onDelete: (playlistId: string) => void;
}

export default function SavedPlaylists({ playlists, onLoad, onDelete }: SavedPlaylistsProps) {
  if (playlists.length === 0) return null;

  return (
    <div className="w-full max-w-6xl mx-auto">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <FiList className="w-4 h-4" />
        Saved Playlists
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {playlists.map((pl) => (
          <div
            key={pl.id}
            className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-purple-500/30 transition-all group"
          >
            <button
              onClick={() => onLoad(pl)}
              className="text-left w-full"
            >
              <h4 className="text-white font-medium truncate group-hover:text-purple-300 transition-colors">
                {pl.playlistTitle}
              </h4>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                <span>{pl.videoCount} videos</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <FiClock className="w-3 h-3" />
                  {new Date(pl.analyzedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {pl.allTags.slice(0, 5).map((tag) => (
                  <span key={tag} className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded text-xs">
                    {tag}
                  </span>
                ))}
                {pl.allTags.length > 5 && (
                  <span className="text-xs text-gray-500">+{pl.allTags.length - 5} more</span>
                )}
              </div>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (pl.id) onDelete(pl.id);
              }}
              className="mt-2 text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1"
            >
              <FiTrash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
