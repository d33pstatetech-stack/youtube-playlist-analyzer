# YouTube Playlist Analyzer

A modern, reactive web application that analyzes YouTube playlists using AI to generate topic tags and video summaries. Built with Next.js, Firebase, and Google Gemini AI.

![Next.js](https://img.shields.io/badge/Next.js-15-black) ![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-orange) ![Gemini](https://img.shields.io/badge/Gemini-AI-blue)

## Features

- 🔍 **Playlist Analysis** – Paste any public YouTube playlist URL to analyze all videos
- 🏷️ **AI Topic Tagging** – Each video is automatically tagged with relevant topics using Gemini AI
- 📝 **Video Summaries** – Brief bullet-point summaries generated for each video
- 🔎 **Tag Cloud Filtering** – Interactive tag cloud with multi-select to filter videos by topic
- 🔐 **Google Authentication** – Sign in with Google to save and manage analyzed playlists
- 💾 **Cloud Storage** – Analyzed playlists saved to Firestore for later review
- 📱 **Responsive Design** – Modern dark theme, works on all screen sizes

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Auth**: Firebase Authentication (Google provider)
- **Database**: Cloud Firestore
- **AI**: Google Gemini 2.0 Flash
- **APIs**: YouTube Data API v3

## Setup

### Prerequisites

1. Node.js 18+
2. A Google Cloud project with:
   - YouTube Data API v3 enabled
   - Gemini API key (from [Google AI Studio](https://aistudio.google.com/))
3. A Firebase project with:
   - Authentication (Google sign-in enabled)
   - Cloud Firestore database

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/youtube-playlist-analyzer.git
cd youtube-playlist-analyzer
npm install
```

### Configuration

1. Copy the environment example file:
```bash
cp .env.local.example .env.local
```

2. Fill in your credentials in `.env.local`:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
YOUTUBE_API_KEY=YOUR_YOUTUBE_API_KEY_HERE
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
```

### Firestore Security Rules

Add these rules in the Firebase Console → Firestore → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /playlists/{playlistId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null;
    }
  }
}
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

1. **Paste** a YouTube playlist URL into the input field
2. **Click Analyze** – the app fetches all videos and analyzes them with AI
3. **Browse** the tagged and summarized video list
4. **Filter** by clicking tags in the tag cloud (multi-select supported)
5. **Sign in** with Google to save playlists for later
6. **Load** saved playlists from the sidebar

## Deployment

### Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

Add environment variables in the Vercel dashboard.

## License

MIT
