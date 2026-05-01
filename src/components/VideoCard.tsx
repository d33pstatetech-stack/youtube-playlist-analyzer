'use client';

import { VideoItem } from '@/lib/types';
import Image from 'next/image';
import { FiExternalLink, FiCalendar } from 'react-icons/fi';

interface VideoCardProps {
  video: VideoItem;
}

export default function VideoCard({ video }: VideoCardProps) {
  return (
    <div data-testid="video-card" className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden hover:border-purple-500/30 transition-all duration-300 group">
      <div className="flex flex-col sm:flex-row">
        {/* Thumbnail */}
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative w-full sm:w-64 h-40 sm:h-auto flex-shrink-0 overflow-hidden"
        >
          <Image
            src={video.thumbnail || '/placeholder.png'}
            alt={video.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, 256px"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <FiExternalLink className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </a>

        {/* Content */}
        <div className="flex-1 p-5">
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-lg font-semibold text-white hover:text-purple-300 transition-colors line-clamp-2"
          >
            {video.title}
          </a>

          <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">
            <span>{video.channelTitle}</span>
            {video.publishedAt && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <FiCalendar className="w-3.5 h-3.5" />
                  {new Date(video.publishedAt).toLocaleDateString()}
                </span>
              </>
            )}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {video.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full text-xs font-medium"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Summary */}
          {video.summary.length > 0 && (
            <ul className="mt-3 space-y-1">
              {video.summary.map((point, idx) => (
                <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-purple-400 mt-1 flex-shrink-0">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
