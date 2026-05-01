'use client';

import { FiCpu, FiZap, FiRefreshCw } from 'react-icons/fi';

export type AiProvider = 'auto' | 'gemini' | 'ollama';
export type OllamaStatus = 'unknown' | 'online' | 'partial' | 'offline';

interface ProviderSelectorProps {
  value: AiProvider;
  onChange: (provider: AiProvider) => void;
  disabled?: boolean;
  ollamaStatus?: OllamaStatus;
  ollamaModels?: string[];
}

const PROVIDER_OPTIONS: { value: AiProvider; label: string; description: string; icon: typeof FiZap }[] = [
  {
    value: 'auto',
    label: 'Auto',
    description: 'Gemini → Ollama fallback',
    icon: FiRefreshCw,
  },
  {
    value: 'gemini',
    label: 'Gemini AI',
    description: 'Cloud, fast & accurate',
    icon: FiZap,
  },
  {
    value: 'ollama',
    label: 'Ollama (local)',
    description: 'Local LLM, private & offline',
    icon: FiCpu,
  },
];

export default function ProviderSelector({ value, onChange, disabled, ollamaStatus = 'unknown', ollamaModels = [] }: ProviderSelectorProps) {
  return (
    <div className="relative inline-flex">
      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        {PROVIDER_OPTIONS.map(({ value: optValue, label, icon: Icon, description }) => {
          const isSelected = optValue === value;
          return (
            <button
              key={optValue}
              type="button"
              onClick={() => onChange(optValue)}
              disabled={disabled}
              data-testid={`provider-${optValue}`}
              className={`
                flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all duration-150
                ${isSelected
                  ? 'bg-purple-600/30 text-purple-300 border-r border-white/5 last:border-r-0'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border-r border-white/5 last:border-r-0'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              title={description}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
              {/* Ollama connection status dot */}
              {optValue === 'ollama' && (
                <span
                  className={`
                    inline-block w-2 h-2 rounded-full ml-0.5 transition-colors duration-300
                    ${ollamaStatus === 'online' ? 'bg-emerald-400' : ollamaStatus === 'partial' ? 'bg-amber-400' : ollamaStatus === 'offline' ? 'bg-red-400' : 'bg-gray-500'}
                  `}
                  title={
                    ollamaStatus === 'online'
                      ? `Ollama is running${ollamaModels.length ? ` — ${ollamaModels.join(', ')}` : ''}`
                      : ollamaStatus === 'partial'
                        ? `Ollama is running but the configured model is not pulled${ollamaModels.length ? ` — available: ${ollamaModels.join(', ')}` : ''}`
                        : ollamaStatus === 'offline'
                          ? 'Ollama is not reachable — make sure it\'s running on localhost:11434'
                          : 'Checking Ollama connection...'
                  }
                  data-testid="ollama-status-dot"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Human-readable label for a given provider value. */
export function providerLabel(provider: AiProvider): string {
  switch (provider) {
    case 'ollama': return 'Ollama (local)';
    case 'gemini': return 'Gemini AI';
    case 'auto': return 'AI (auto)';
  }
}

/** Whether the provider is a local LLM. */
export function isLocalProvider(provider: AiProvider): boolean {
  return provider === 'ollama';
}
