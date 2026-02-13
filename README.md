# Backstage — Artist Management App

A mobile-first PWA for managing music artists, built with Next.js. Includes ABOSS integration for syncing show calendars.

## Features

- **Dashboard** — Overview of releases, shows, and social content
- **Releases** — Track singles, EPs, remixes with status and label info
- **Shows** — Full gig management with fees, venue, countdown timers
- **Social** — Content planner across Instagram, TikTok, YouTube, etc.
- **Multi-artist** — Switch between artists with the roster picker
- **ABOSS Integration** — Sync shows directly from your ABOSS account
- **PWA** — Add to iPhone home screen for native app feel

## Deploy to Vercel (Free)

### 1. Push to GitHub

```bash
# In this folder:
git init
git add .
git commit -m "Initial commit"

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/backstage.git
git branch -M main
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign up with GitHub
2. Click **"Add New Project"**
3. Import your `backstage` repository
4. Click **Deploy** — that's it!

You'll get a URL like `backstage-xyz.vercel.app`

### 3. Add to iPhone Home Screen

1. Open your Vercel URL in Safari on your iPhone
2. Tap the **Share** button (box with arrow)
3. Tap **"Add to Home Screen"**
4. Name it "Backstage" and tap Add

It will look and feel like a native app.

## Connect ABOSS

1. Open the app → go to **Settings** tab
2. Select your account type (Artist or Agency)
3. Paste your **API token** from ABOSS → Profile Settings → OAuth 2.0 credentials
4. Enter your **Project ID** (found in your ABOSS URL after `projects/`)
5. For Agency accounts, also enter your **Agency ID**
6. Tap **Connect & Sync**

Your ABOSS token is stored in your browser's localStorage and API calls are proxied through the app's server — your token is never exposed client-side to ABOSS directly (avoiding CORS issues).

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Tech Stack

- Next.js 14 (App Router)
- React 18
- No external UI libraries — custom Apple-style components
- localStorage for data persistence
- Server-side API proxy for ABOSS integration
