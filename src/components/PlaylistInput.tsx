'use client';

import { useState } from 'react';
import { FiSearch, FiLoader, FiAlertTriangle, FiWifiOff } from 'react-icons/fi';
import ProviderSelector, { AiProvider, OllamaStatus } from './ProviderSelector';

interface PlaylistInputProps {
  onAnalyze: (url: string, provider: AiProvider) => void;
  loading: boolean;
  provider: AiProvider;
  onProviderChange: (provider: AiProvider) => void;
  ollamaStatus?: OllamaStatus;
  ollamaModels?: string[];
}

export default function PlaylistInput({ onAnalyze, loading, provider, onProviderChange, ollamaStatus, ollamaModels }: PlaylistInputProps) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim() && !loading) {
      onAnalyze(url.trim(), provider);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto space-y-3">
      {/* Provider selector row */}
      <div className="flex items-center justify-center gap-3">
        <span className="text-gray-400 text-sm">AI Provider:</span>
        <ProviderSelector value={provider} onChange={onProviderChange} disabled={loading} ollamaStatus={ollamaStatus} ollamaModels={ollamaModels} />
      </div>
      {/* Ollama status warning banner */}
      {provider === 'ollama' && ollamaStatus !== 'online' && (
        <div
          data-testid="ollama-warning-banner"
          className={`
            flex items-center gap-3 px-4 py-3 rounded-xl border text-sm
            ${ollamaStatus === 'offline'
              ? 'bg-red-500/10 border-red-500/30 text-red-300'
              : ollamaStatus === 'partial'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-gray-500/10 border-gray-500/30 text-gray-400'
            }
          `}
        >
          {ollamaStatus === 'offline' ? (
            <>
              <FiWifiOff className="w-4 h-4 flex-shrink-0" />
              <span>Ollama is not reachable — analysis will likely fail. Make sure Ollama is running on <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono">localhost:11434</code>.</span>
            </>
          ) : ollamaStatus === 'partial' ? (
            <>
              <FiAlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Ollama is running but the configured model is not pulled — analysis may fail. Pull the model first or switch providers.</span>
            </>
          ) : (
            <>
              <FiLoader className="w-4 h-4 flex-shrink-0 animate-spin" />
              <span>Checking Ollama connection…</span>
            </>
          )}
        </div>
      )}

      <div className="relative flex items-center gap-3">
        <div className="relative flex-1">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a YouTube playlist URL..."
            data-testid="playlist-url-input"
            className="w-full pl-12 pr-4 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-lg"
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={!url.trim() || loading}
          data-testid="analyze-button"
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
