'use client';

import { useState } from 'react';
import { FiSearch, FiLoader } from 'react-icons/fi';

interface PlaylistInputProps {
  onAnalyze: (url: string) => void;
  loading: boolean;
}

export default function PlaylistInput({ onAnalyze, loading }: PlaylistInputProps) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim() && !loading) {
      onAnalyze(url.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
      <div className="relative flex items-center gap-3">
        <div className="relative flex-1">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a YouTube playlist URL..."
            className="w-full pl-12 pr-4 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-lg"
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={!url.trim() || loading}
          className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-2xl transition-all duration-200 flex items-center gap-2 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
        >
          {loading ? (
            <>
              <FiLoader className="w-5 h-5 animate-spin" />
              Analyzing...
            </>
          ) : (
            'Analyze'
          )}
        </button>
      </div>
    </form>
  );
}
