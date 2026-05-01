'use client';

import { useAuth } from '@/contexts/AuthContext';
import { FiLogIn, FiLogOut, FiUser } from 'react-icons/fi';
import Image from 'next/image';

export default function Header() {
  const { user, loading, firebaseReady, signInWithGoogle, logout } = useAuth();

  return (
    <header className="w-full border-b border-white/10 bg-black/20 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
            <span className="text-xl">▶</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Playlist Analyzer</h1>
            <p className="text-xs text-gray-400">AI-powered YouTube playlist insights</p>
          </div>
        </div>

        <div>
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
          ) : user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {user.photoURL ? (
                  <Image
                    src={user.photoURL}
                    alt="Profile"
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                ) : (
                  <FiUser className="w-5 h-5 text-gray-400" />
                )}
                <span className="text-sm text-gray-300 hidden sm:block">
                  {user.displayName || user.email}
                </span>
              </div>
              <button
                onClick={logout}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title="Sign out"
              >
                <FiLogOut className="w-5 h-5" />
              </button>
            </div>
          ) : firebaseReady ? (
            <button
              onClick={signInWithGoogle}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white text-sm transition-all"
            >
              <FiLogIn className="w-4 h-4" />
              Sign in with Google
            </button>
          ) : (
            <span className="text-xs text-gray-500">Firebase not configured</span>
          )}
        </div>
      </div>
    </header>
  );
}
