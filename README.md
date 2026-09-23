# Mediagen

Generate and modify media with AI — images, audio, and video from a single web app.

Live: [aimediagen.vercel.app](https://aimediagen.vercel.app)

## What it does

- **Image generation & editing** — text-to-image and image-to-image editing
- **Video generation** — create videos from a prompt, optionally starting from an image
- **Audio generation** — text-to-speech narration
- **Media templates** — dedicated flows for concept art, product shots, short ads, and UGC-style videos
- **Carousel builder** — generate carousel content

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- Server-side AI generation via API routes that proxy a provider with the model key
- [shadcn/ui](https://ui.shadcn.com)-style components with Tailwind CSS

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The generation API routes expect an `Authorization: Bearer <api-key>` header, so supply a valid model provider key for image, video, and audio calls to work.

## Project structure

- `src/app/api/generate-image` — image generation and editing
- `src/app/api/generate-video` — video generation
- `src/app/api/generate-audio` — text-to-speech
- `src/app/image`, `src/app/video`, `src/app/audio`, `src/app/carousel`, `src/app/concept-art`, `src/app/product`, `src/app/short-ad`, `src/app/ugc-video` — corresponding UI flows

## Status

Active project. Default template README replaced on 2026-09; feature set reflects the current codebase.