'use client';

interface TagCloudProps {
  tags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onClearAll: () => void;
}

export default function TagCloud({ tags, selectedTags, onToggleTag, onClearAll }: TagCloudProps) {
  if (tags.length === 0) return null;

  return (
    <div data-testid="tag-cloud-section" className="w-full max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Filter by Topics</h3>
        {selectedTags.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            Clear all ({selectedTags.length})
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2" data-testid="tag-cloud">
        {tags.map((tag) => {
          const isSelected = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              onClick={() => onToggleTag(tag)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                isSelected
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30 scale-105'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
