"use client";

import { useState } from "react";
import { Download, RefreshCw, Settings2 } from "lucide-react";

import { MediaShell } from "./MediaShell";
import {
  createCarouselPrompt,
  createCarouselSlideTexts,
  createInitialMediaState,
  GENERATION_FAILURE_MESSAGE,
  logFailedResponse,
  type CarouselSlideState,
  type MediaState,
} from "./media-utils";
import {
  DEFAULT_IMAGE_SETTINGS,
  DEFAULT_VIDEO_SETTINGS,
  type ImageGenerationSettings,
  type VideoGenerationSettings,
} from "@/lib/image-settings";

interface CarouselGeneratorProps {
  initialPrompt?: string;
}

interface CarouselInputProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  count: number;
  slideTexts: string[];
  globalStyle: string;
  loading: boolean;
  error: string | null;
  generatedCount: number;
  onCountChange: (count: number) => void;
  onSlideTextChange: (index: number, text: string) => void;
  onGlobalStyleChange: (style: string) => void;
  onGenerate: () => void;
  onOpenSettings: () => void;
}

interface CarouselResultProps {
  slides: CarouselSlideState[];
  loading: boolean;
  count: number;
  onDownload: () => void;
  onRegenerate: () => void;
}

export function CarouselGenerator({ initialPrompt = "" }: CarouselGeneratorProps) {
  const [imageSettings, setImageSettings] = useState<ImageGenerationSettings>(
    DEFAULT_IMAGE_SETTINGS,
  );
  const [videoSettings, setVideoSettings] = useState<VideoGenerationSettings>(
    DEFAULT_VIDEO_SETTINGS,
  );
  const [imageState, setImageState] = useState<MediaState>(
    createInitialMediaState,
  );
  const [carouselPrompt, setCarouselPrompt] = useState(initialPrompt);
  const [carouselCount, setCarouselCount] = useState(3);
  const [carouselSlideTexts, setCarouselSlideTexts] = useState(() =>
    createCarouselSlideTexts(3),
  );
  const [carouselGlobalStyle, setCarouselGlobalStyle] = useState(
    "Modern minimalist design, consistent brand colors, clean typography, soft background shapes, high contrast readable text.",
  );
  const [carouselSlides, setCarouselSlides] = useState<CarouselSlideState[]>([]);
  const [carouselLoading, setCarouselLoading] = useState(false);
  const [carouselError, setCarouselError] = useState<string | null>(null);

  const requestGenerateCarousel = async (apiKey: string, basePrompt: string) => {
    setCarouselLoading(true);
    setCarouselError(null);
    setCarouselSlides([]);
    setImageState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const generatedSlides: CarouselSlideState[] = [];
      const slideTexts = carouselSlideTexts.slice(0, carouselCount);

      for (const [index, slideText] of slideTexts.entries()) {
        const slidePrompt = createCarouselPrompt({
          basePrompt,
          globalStyle: carouselGlobalStyle,
          slideText: slideText.trim() || `Slide ${index + 1}`,
          slideNumber: index + 1,
          totalSlides: carouselCount,
        });

        const response = await fetch("/api/generate-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            prompt: slidePrompt,
            settings: imageSettings,
          }),
        });

        if (!response.ok) {
          await logFailedResponse(
            response,
            `Carousel slide ${index + 1} generation request`,
          );
          throw new Error(`Carousel slide ${index + 1} generation failed`);
        }

        const data = await response.json();
        const nextSlide = {
          url: data.url,
          text: slideText,
          prompt: slidePrompt,
          error: null,
        } satisfies CarouselSlideState;

        generatedSlides.push(nextSlide);
        setCarouselSlides([...generatedSlides]);
      }

      setImageState({
        url: generatedSlides[0]?.url ?? null,
        loading: false,
        originalPrompt: basePrompt,
        error: null,
        progress: 0,
      });
    } catch (error) {
      console.error("Carousel generation failed:", error);
      setCarouselError(GENERATION_FAILURE_MESSAGE);
      setImageState((prev) => ({
        ...prev,
        loading: false,
        error: GENERATION_FAILURE_MESSAGE,
      }));
    } finally {
      setCarouselLoading(false);
    }
  };

  const handleGenerate = (apiKey: string) => {
    const nextPrompt = carouselPrompt.trim();
    if (!nextPrompt) return;

    void requestGenerateCarousel(apiKey, nextPrompt);
  };

  const handleRegenerate = (apiKey: string) => {
    if (!imageState.originalPrompt.trim()) return;

    void requestGenerateCarousel(apiKey, imageState.originalPrompt);
  };

  const handleDownload = async () => {
    const firstSlideUrl = carouselSlides[0]?.url ?? imageState.url;
    if (!firstSlideUrl) return;

    try {
      const response = await fetch(firstSlideUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `carousel-${Date.now()}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const handleCarouselCountChange = (count: number) => {
    const nextCount = Math.min(Math.max(count, 1), 10);
    setCarouselCount(nextCount);
    setCarouselSlideTexts((prev) => createCarouselSlideTexts(nextCount, prev));
  };

  const handleCarouselSlideTextChange = (index: number, text: string) => {
    setCarouselSlideTexts((prev) =>
      prev.map((slideText, slideIndex) =>
        slideIndex === index ? text : slideText,
      ),
    );
  };

  return (
    <MediaShell
      activeTool="image"
      activeTemplate="carousel"
      title="Generate carousel"
      imageSettings={imageSettings}
      setImageSettings={setImageSettings}
      videoSettings={videoSettings}
      setVideoSettings={setVideoSettings}
    >
      {(apiKey, openSettings) => {
        const showPreview = carouselLoading || carouselSlides.length > 0;

        return (
          <>
            <CarouselInput
              prompt={carouselPrompt}
              setPrompt={setCarouselPrompt}
              count={carouselCount}
              slideTexts={carouselSlideTexts}
              globalStyle={carouselGlobalStyle}
              loading={carouselLoading}
              error={carouselError ?? imageState.error}
              generatedCount={carouselSlides.length}
              onCountChange={handleCarouselCountChange}
              onSlideTextChange={handleCarouselSlideTextChange}
              onGlobalStyleChange={setCarouselGlobalStyle}
              onGenerate={() => handleGenerate(apiKey)}
              onOpenSettings={openSettings}
            />

            {showPreview && (
              <CarouselResult
                slides={carouselSlides}
                loading={carouselLoading}
                count={carouselCount}
                onDownload={handleDownload}
                onRegenerate={() => handleRegenerate(apiKey)}
              />
            )}
          </>
        );
      }}
    </MediaShell>
  );
}

function CarouselInput({
  prompt,
  setPrompt,
  count,
  slideTexts,
  globalStyle,
  loading,
  error,
  generatedCount,
  onCountChange,
  onSlideTextChange,
  onGlobalStyleChange,
  onGenerate,
  onOpenSettings,
}: CarouselInputProps) {
  const loadingLabel = `Generating carousel (${generatedCount}/${count})...`;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Describe the carousel topic or campaign…"
        className="h-24 w-full resize-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
      />

      <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <label className="text-sm font-medium text-slate-700">
            Number of slides
            <input
              type="number"
              min={1}
              max={10}
              value={count}
              onChange={(event) => onCountChange(Number(event.target.value))}
              className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-1 focus:ring-slate-300"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Global style for all slides
            <textarea
              value={globalStyle}
              onChange={(event) => onGlobalStyleChange(event.target.value)}
              placeholder="Minimalist, bold typography, warm neutral palette..."
              className="mt-2 h-20 w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-1 focus:ring-slate-300"
            />
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">
            Text on each carousel slide
          </p>
          <div className="grid gap-2">
            {slideTexts.map((slideText, index) => (
              <label
                key={index}
                className="grid gap-2 text-xs font-medium uppercase tracking-wide text-slate-400 sm:grid-cols-[80px_1fr] sm:items-center"
              >
                Slide {index + 1}
                <input
                  type="text"
                  value={slideText}
                  onChange={(event) =>
                    onSlideTextChange(index, event.target.value)
                  }
                  placeholder={`Text for slide ${index + 1}`}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-1 focus:ring-slate-300"
                />
              </label>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onOpenSettings}
          aria-haspopup="dialog"
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
        >
          <Settings2 size={14} />
          Settings
        </button>
        <button
          type="button"
          onClick={onGenerate}
          disabled={!prompt.trim() || loading}
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? loadingLabel : "Generate Carousel"}
        </button>
      </div>
    </div>
  );
}

function CarouselResult({
  slides,
  loading,
  count,
  onDownload,
  onRegenerate,
}: CarouselResultProps) {
  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">
            Generating carousel ({slides.length}/{count})...
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            {slides.map((slide, index) => (
              <div
                key={`${slide.url}-${index}`}
                className="overflow-hidden rounded-md border border-slate-200 bg-slate-50"
              >
                {slide.url && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={slide.url}
                      alt={`Carousel slide ${index + 1}`}
                      className="h-auto w-full object-cover"
                    />
                  </>
                )}
                <div className="border-t border-slate-200 bg-white p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Slide {index + 1}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{slide.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <Download size={14} />
              Download first slide
            </button>
            <button
              type="button"
              onClick={onRegenerate}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <RefreshCw size={14} />
              Regenerate
            </button>
          </div>
        </>
      )}
    </div>
  );
}
