'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AnalyzedPlaylist, VideoItem } from '@/lib/types';
import PlaylistInput from '@/components/PlaylistInput';
import TagCloud from '@/components/TagCloud';
import VideoCard from '@/components/VideoCard';
import SavedPlaylists from '@/components/SavedPlaylists';
import Header from '@/components/Header';
import { FiSave, FiLoader, FiAlertCircle, FiVideo } from 'react-icons/fi';

export default function Home() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPlaylist, setCurrentPlaylist] = useState<AnalyzedPlaylist | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [savedPlaylists, setSavedPlaylists] = useState<AnalyzedPlaylist[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<string>('');

  // Load saved playlists from SQLite API
  useEffect(() => {
    if (!user) {
      setSavedPlaylists([]);
      return;
    }
    const loadSaved = async () => {
      try {
        const res = await fetch('/api/playlists');
        if (!res.ok) return;
        const playlists: AnalyzedPlaylist[] = await res.json();
        setSavedPlaylists(
          playlists.sort(
            (a, b) =>
              new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime()
          )
        );
      } catch (err) {
        console.error('Error loading saved playlists:', err);
      }
    };
    loadSaved();
  }, [user]);

  const handleAnalyze = async (url: string) => {
    setLoading(true);
    setError(null);
    setProgress('Fetching playlist videos and analyzing with AI...');
    setSelectedTags([]);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Analysis failed');
      }

      const data = await res.json();
      setCurrentPlaylist({
        ...data,
        userId: user?.uid || 'anonymous',
      });
      setProgress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setProgress('');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !currentPlaylist) return;
    setSaving(true);
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...currentPlaylist, userId: user.uid }),
      });
      if (!res.ok) throw new Error('Save failed');
      const saved: AnalyzedPlaylist = await res.json();
      setCurrentPlaylist(saved);
      setSavedPlaylists(prev => [saved, ...prev.filter(p => p.id !== saved.id)]);
    } catch (err) {
      console.error('Error saving playlist:', err);
      setError('Failed to save playlist');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (playlistId: string) => {
    try {
      const res = await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setSavedPlaylists(prev => prev.filter(p => p.id !== playlistId));
      if (currentPlaylist?.id === playlistId) {
        setCurrentPlaylist(prev => (prev ? { ...prev, id: undefined } : null));
      }
    } catch (err) {
      console.error('Error deleting playlist:', err);
    }
  };

  const handleLoadSaved = (playlist: AnalyzedPlaylist) => {
    setCurrentPlaylist(playlist);
    setSelectedTags([]);
    setError(null);
  };

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }, []);

  const filteredVideos: VideoItem[] = useMemo(() => {
    if (!currentPlaylist) return [];
    if (selectedTags.length === 0) return currentPlaylist.videos;
    return currentPlaylist.videos.filter(video =>
      selectedTags.some(tag => video.tags.includes(tag))
    );
  }, [currentPlaylist, selectedTags]);

  const isSaved = currentPlaylist?.id !== undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-purple-950">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Hero / Input Section */}
        <div className="text-center space-y-6 py-4">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Analyze Any YouTube Playlist
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Paste a playlist URL to get AI-powered topic tags and summaries for every video.
            Filter by topics, save for later.
          </p>
          <PlaylistInput onAnalyze={handleAnalyze} loading={loading} />
        </div>

        {/* Progress */}
        {loading && (
          <div className="text-center py-12">
            <FiLoader className="w-10 h-10 text-purple-400 animate-spin mx-auto" />
            <p className="text-gray-400 mt-4">{progress}</p>
            <p className="text-gray-500 text-sm mt-1">This may take a minute for large playlists...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="max-w-3xl mx-auto bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
            <FiAlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 font-medium">Analysis Error</p>
              <p className="text-red-400/80 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Saved Playlists */}
        {!currentPlaylist && !loading && (
          <SavedPlaylists
            playlists={savedPlaylists}
            onLoad={handleLoadSaved}
            onDelete={handleDelete}
          />
        )}

        {/* Results */}
        {currentPlaylist && !loading && (
          <>
            {/* Playlist Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <h3 className="text-2xl font-bold text-white">{currentPlaylist.playlistTitle}</h3>
                <p className="text-gray-400 mt-1 flex items-center gap-2">
                  <FiVideo className="w-4 h-4" />
                  {currentPlaylist.videoCount} videos
                  {selectedTags.length > 0 && (
                    <span className="text-purple-400">
                      · {filteredVideos.length} matching
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-3">
                {user && !isSaved && (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 text-white rounded-xl transition-colors text-sm font-medium"
                  >
                    {saving ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiSave className="w-4 h-4" />}
                    {saving ? 'Saving...' : 'Save Playlist'}
                  </button>
                )}
                {!user && (
                  <p className="text-sm text-gray-500 italic">Sign in to save playlists</p>
                )}
                {isSaved && (
                  <span className="text-sm text-green-400 flex items-center gap-1">✓ Saved</span>
                )}
              </div>
            </div>

            {/* Tag Cloud */}
            <TagCloud
              tags={currentPlaylist.allTags}
              selectedTags={selectedTags}
              onToggleTag={toggleTag}
              onClearAll={() => setSelectedTags([])}
            />

            {/* Video List */}
            <div className="space-y-4">
              {filteredVideos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
              {filteredVideos.length === 0 && selectedTags.length > 0 && (
                <div className="text-center py-12 text-gray-500">
                  No videos match the selected tags. Try different filters.
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-white/10 py-6 text-center text-gray-500 text-sm">
        YouTube Playlist Analyzer · Built with Next.js, SQLite &amp; Gemini AI
      </footer>
    </div>
  );
}
