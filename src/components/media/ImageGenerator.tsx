"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Download, Edit2, RefreshCw, Settings2, Upload } from "lucide-react";

import { MediaShell } from "./MediaShell";
import {
  createInitialMediaState,
  GENERATION_FAILURE_MESSAGE,
  logFailedResponse,
  readFileAsDataUrl,
  type MediaState,
} from "./media-utils";
import {
  DEFAULT_AUDIO_SETTINGS,
  DEFAULT_IMAGE_SETTINGS,
  DEFAULT_VIDEO_SETTINGS,
  type AudioGenerationSettings,
  type ImageGenerationSettings,
  type VideoGenerationSettings,
} from "@/lib/image-settings";

interface ImageGeneratorProps {
  activeTemplate?: string | null;
  initialPrompt?: string;
  title?: string;
}

interface ImageInputProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  sourceUrl: string | null;
  loading: boolean;
  error: string | null;
  actionLabel: string;
  loadingLabel: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onClearSource: () => void;
  onGenerate: () => void;
  onOpenSettings: () => void;
}

interface ImageResultProps {
  state: MediaState;
  loadingLabel: string;
  onDownload: () => void;
  onModify: () => void;
  onRegenerate: () => void;
}

export function ImageGenerator({
  activeTemplate = null,
  initialPrompt = "",
  title = "Generate and edit images",
}: ImageGeneratorProps) {
  const [imageSettings, setImageSettings] = useState<ImageGenerationSettings>(
    DEFAULT_IMAGE_SETTINGS,
  );
  const [videoSettings, setVideoSettings] = useState<VideoGenerationSettings>(
    DEFAULT_VIDEO_SETTINGS,
  );
  const [audioSettings, setAudioSettings] = useState<AudioGenerationSettings>(
    DEFAULT_AUDIO_SETTINGS,
  );
  const [imageState, setImageState] = useState<MediaState>(
    createInitialMediaState,
  );
  const [imagePrompt, setImagePrompt] = useState(initialPrompt);
  const [editSourceUrl, setEditSourceUrl] = useState<string | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  const requestGenerateImage = async (apiKey: string, nextPrompt: string) => {
    setImageState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          prompt: nextPrompt,
          settings: imageSettings,
        }),
      });

      if (!response.ok) {
        await logFailedResponse(response, "Image generation request");
        throw new Error("Generation failed");
      }

      const data = await response.json();

      setImageState({
        url: data.url,
        loading: false,
        originalPrompt: nextPrompt,
        error: null,
        progress: 0,
      });
      setEditSourceUrl(data.url);
    } catch (error) {
      console.error("Image generation failed:", error);
      setImageState((prev) => ({
        ...prev,
        loading: false,
        error: GENERATION_FAILURE_MESSAGE,
      }));
    }
  };

  const requestEditImage = async (
    apiKey: string,
    nextPrompt: string,
    sourceUrl: string,
  ) => {
    setImageState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch("/api/edit-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          prompt: nextPrompt,
          image: sourceUrl,
          settings: imageSettings,
        }),
      });

      if (!response.ok) {
        await logFailedResponse(response, "Image edit request");
        throw new Error("Edit failed");
      }

      const data = await response.json();

      setEditSourceUrl(data.url);
      setImageState({
        url: data.url,
        loading: false,
        originalPrompt: nextPrompt,
        error: null,
        progress: 0,
      });
    } catch (error) {
      console.error("Image edit failed:", error);
      setImageState((prev) => ({
        ...prev,
        loading: false,
        error: GENERATION_FAILURE_MESSAGE,
      }));
    }
  };

  const handleGenerate = (apiKey: string) => {
    const nextPrompt = imagePrompt.trim();
    if (!nextPrompt) return;

    if (editSourceUrl) {
      void requestEditImage(apiKey, nextPrompt, editSourceUrl);
      return;
    }

    void requestGenerateImage(apiKey, nextPrompt);
  };

  const handleRegenerate = (apiKey: string) => {
    if (!imageState.originalPrompt.trim()) return;

    if (editSourceUrl) {
      void requestEditImage(apiKey, imageState.originalPrompt, editSourceUrl);
      return;
    }

    void requestGenerateImage(apiKey, imageState.originalPrompt);
  };

  const handleModify = () => {
    setImagePrompt("");
    if (imageState.url) {
      setEditSourceUrl(imageState.url);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDownload = async () => {
    if (!imageState.url) return;

    try {
      const response = await fetch(imageState.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `image-${Date.now()}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    try {
      const result = await readFileAsDataUrl(file);

      setImagePrompt("");
      setEditSourceUrl(result);
      setImageState({
        url: result,
        loading: false,
        originalPrompt: "",
        error: null,
        progress: 0,
      });
    } catch (error) {
      console.error("Image upload failed:", error);
      setImageState((prev) => ({
        ...prev,
        error: "Unable to read the uploaded image. Try a different file.",
      }));
    }
  };

  const handleClearImageSource = () => {
    setEditSourceUrl(null);
    setImageState(createInitialMediaState());
    setImagePrompt("");
  };

  return (
    <MediaShell
      activeTool="image"
      activeTemplate={activeTemplate}
      title={title}
      imageSettings={imageSettings}
      setImageSettings={setImageSettings}
      videoSettings={videoSettings}
      setVideoSettings={setVideoSettings}
      audioSettings={audioSettings}
      setAudioSettings={setAudioSettings}
    >
      {(apiKey, openSettings) => {
        const actionLabel = editSourceUrl ? "Edit Image" : "Generate Image";
        const loadingLabel = editSourceUrl
          ? "Editing image..."
          : "Generating image...";
        const showPreview = imageState.loading || Boolean(imageState.url);

        return (
          <>
            <ImageInput
              prompt={imagePrompt}
              setPrompt={setImagePrompt}
              sourceUrl={editSourceUrl}
              loading={imageState.loading}
              error={imageState.error}
              actionLabel={actionLabel}
              loadingLabel={loadingLabel}
              fileInputRef={imageFileInputRef}
              onUpload={handleImageUpload}
              onClearSource={handleClearImageSource}
              onGenerate={() => handleGenerate(apiKey)}
              onOpenSettings={openSettings}
            />

            {showPreview && (
              <ImageResult
                state={imageState}
                loadingLabel={loadingLabel}
                onDownload={handleDownload}
                onModify={handleModify}
                onRegenerate={() => handleRegenerate(apiKey)}
              />
            )}
          </>
        );
      }}
    </MediaShell>
  );
}

function ImageInput({
  prompt,
  setPrompt,
  sourceUrl,
  loading,
  error,
  actionLabel,
  loadingLabel,
  fileInputRef,
  onUpload,
  onClearSource,
  onGenerate,
  onOpenSettings,
}: ImageInputProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex gap-4">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={
            sourceUrl
              ? "Describe the change…"
              : "Describe the image you want to create…"
          }
          className="h-24 flex-1 resize-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-24 w-20 items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            title="Upload image"
          >
            <Upload size={20} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onUpload}
            className="hidden"
          />
        </div>
      </div>

      {sourceUrl && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-700">
                Reference image
              </p>
              <p className="text-xs text-slate-500">
                Your next prompt will use this image as the source.
              </p>
            </div>
            <button
              type="button"
              onClick={onClearSource}
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              Remove
            </button>
          </div>

          <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sourceUrl}
              alt="Reference image for image generation"
              className="h-48 w-full object-contain"
            />
          </div>
        </div>
      )}

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
          {loading ? loadingLabel : actionLabel}
        </button>
      </div>
    </div>
  );
}

function ImageResult({
  state,
  loadingLabel,
  onDownload,
  onModify,
  onRegenerate,
}: ImageResultProps) {
  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
      {state.loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">{loadingLabel}</p>
        </div>
      ) : (
        <>
          <div className="mb-4 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={state.url ?? ""}
              alt="Generated media"
              className="h-auto w-full object-cover"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <Download size={14} />
              Download
            </button>
            <button
              type="button"
              onClick={onModify}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <Edit2 size={14} />
              Modify
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
