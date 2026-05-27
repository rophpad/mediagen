"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Download, RefreshCw, Settings2, Upload } from "lucide-react";

import { MediaShell } from "./MediaShell";
import {
  createInitialMediaState,
  GENERATION_FAILURE_MESSAGE,
  isVideoComplete,
  logFailedResponse,
  normalizeVideoSourceImage,
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

interface VideoGeneratorProps {
  activeTemplate?: string | null;
  initialPrompt?: string;
  title?: string;
}

interface VideoInputProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  sourceUrl: string | null;
  loading: boolean;
  error: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onClearSource: () => void;
  onGenerate: () => void;
  onOpenSettings: () => void;
}

interface VideoResultProps {
  state: MediaState;
  onDownload: () => void;
  onRegenerate: () => void;
}

async function pollVideoUntilComplete({
  apiKey,
  videoId,
  initialStatus,
  initialProgress,
  onProgress,
}: {
  apiKey: string;
  videoId: string;
  initialStatus: unknown;
  initialProgress: number;
  onProgress: (progress: number) => void;
}) {
  const poll = async (
    currentStatus: unknown,
    currentProgress: number,
    attempts: number,
  ): Promise<{ status: unknown; progress: number }> => {
    if (isVideoComplete(currentStatus, currentProgress) || attempts >= 60) {
      return { status: currentStatus, progress: currentProgress };
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));

    const statusResponse = await fetch(`/api/video/${videoId}`, {
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
    });

    if (!statusResponse.ok) {
      await logFailedResponse(statusResponse, "Video status request");
      return poll(currentStatus, currentProgress, attempts + 1);
    }

    const statusData = await statusResponse.json();
    const nextStatus = statusData.status;
    const nextProgress =
      typeof statusData.progress === "number"
        ? statusData.progress
        : currentProgress;

    onProgress(nextProgress);

    if (nextStatus === "failed") {
      throw new Error("Video generation failed during processing");
    }

    return poll(nextStatus, nextProgress, attempts + 1);
  };

  return poll(initialStatus, initialProgress, 0);
}

export function VideoGenerator({
  activeTemplate = null,
  initialPrompt = "",
  title = "Generate videos",
}: VideoGeneratorProps) {
  const [imageSettings, setImageSettings] = useState<ImageGenerationSettings>(
    DEFAULT_IMAGE_SETTINGS,
  );
  const [videoSettings, setVideoSettings] = useState<VideoGenerationSettings>(
    DEFAULT_VIDEO_SETTINGS,
  );
  const [audioSettings, setAudioSettings] = useState<AudioGenerationSettings>(
    DEFAULT_AUDIO_SETTINGS,
  );
  const [videoState, setVideoState] = useState<MediaState>(
    createInitialMediaState,
  );
  const [videoPrompt, setVideoPrompt] = useState(initialPrompt);
  const [videoSourceUrl, setVideoSourceUrl] = useState<string | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  const requestGenerateVideo = async (apiKey: string, nextPrompt: string) => {
    setVideoState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      progress: 0,
    }));

    try {
      const preparedVideoSource = videoSourceUrl
        ? await normalizeVideoSourceImage(videoSourceUrl, videoSettings.size)
        : null;

      const initResponse = await fetch("/api/generate-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          prompt: nextPrompt,
          ...(preparedVideoSource ? { image: preparedVideoSource } : {}),
          settings: videoSettings,
        }),
      });

      if (!initResponse.ok) {
        await logFailedResponse(initResponse, "Video generation request");
        throw new Error("Failed to initiate video generation");
      }

      const initData = await initResponse.json();
      const videoId = initData.id;

      if (!videoId) {
        throw new Error("No video ID returned");
      }

      const initialProgress =
        typeof initData.progress === "number" ? initData.progress : 0;
      const finalVideoStatus = await pollVideoUntilComplete({
        apiKey,
        videoId,
        initialStatus: initData.status,
        initialProgress,
        onProgress: (progress) => {
          setVideoState((prev) => ({ ...prev, progress }));
        },
      });

      if (
        !isVideoComplete(finalVideoStatus.status, finalVideoStatus.progress)
      ) {
        throw new Error("Video generation timed out");
      }

      const contentResponse = await fetch(`/api/video/${videoId}/content`, {
        headers: {
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
      });

      if (!contentResponse.ok) {
        await logFailedResponse(contentResponse, "Video content request");
        throw new Error("Failed to retrieve video content URL");
      }

      const contentData = await contentResponse.json();
      const videoUrl = contentData.url;

      if (!videoUrl) {
        throw new Error("No video URL returned");
      }

      setVideoState({
        url: videoUrl,
        loading: false,
        originalPrompt: nextPrompt,
        error: null,
        progress: 100,
      });
    } catch (error) {
      console.error("Video generation failed:", error);
      setVideoState((prev) => ({
        ...prev,
        loading: false,
        error: GENERATION_FAILURE_MESSAGE,
        progress: 0,
      }));
    }
  };

  const handleGenerate = (apiKey: string) => {
    const nextPrompt = videoPrompt.trim();
    if (!nextPrompt) return;

    void requestGenerateVideo(apiKey, nextPrompt);
  };

  const handleRegenerate = (apiKey: string) => {
    if (!videoState.originalPrompt.trim()) return;

    void requestGenerateVideo(apiKey, videoState.originalPrompt);
  };

  const handleDownload = async () => {
    if (!videoState.url) return;

    try {
      const response = await fetch(videoState.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `video-${Date.now()}.mp4`;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const handleVideoSourceUpload = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    try {
      const result = await readFileAsDataUrl(file);

      setVideoSourceUrl(result);
      setVideoState((prev) => ({
        ...prev,
        error: null,
      }));
    } catch (error) {
      console.error("Video source upload failed:", error);
      setVideoState((prev) => ({
        ...prev,
        error:
          "Unable to read the uploaded source image. Try a different file.",
      }));
    }
  };

  const handleClearVideoSource = () => {
    setVideoSourceUrl(null);
  };

  return (
    <MediaShell
      activeTool="video"
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
        const showPreview = videoState.loading || Boolean(videoState.url);

        return (
          <>
            <VideoInput
              prompt={videoPrompt}
              setPrompt={setVideoPrompt}
              sourceUrl={videoSourceUrl}
              loading={videoState.loading}
              error={videoState.error}
              fileInputRef={videoFileInputRef}
              onUpload={handleVideoSourceUpload}
              onClearSource={handleClearVideoSource}
              onGenerate={() => handleGenerate(apiKey)}
              onOpenSettings={openSettings}
            />

            {showPreview && (
              <VideoResult
                state={videoState}
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

function VideoInput({
  prompt,
  setPrompt,
  sourceUrl,
  loading,
  error,
  fileInputRef,
  onUpload,
  onClearSource,
  onGenerate,
  onOpenSettings,
}: VideoInputProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex gap-4">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={
            sourceUrl
              ? "Describe the shot, action, camera movement, and scene…"
              : "Describe the video you want to create…"
          }
          className="h-24 flex-1 resize-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-24 w-20 items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            title="Upload source image"
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

      <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-700">Source image</p>
            <p className="text-xs text-slate-500">
              Optional. Upload an image to animate, or leave this empty for
              text-to-video.
            </p>
          </div>
          {sourceUrl && (
            <button
              type="button"
              onClick={onClearSource}
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              Remove
            </button>
          )}
        </div>

        {sourceUrl && (
          <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sourceUrl}
              alt="Source image for video generation"
              className="h-48 w-full object-contain"
            />
          </div>
        )}
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
          {loading ? "Generating video..." : "Generate Video"}
        </button>
      </div>
    </div>
  );
}

function VideoResult({ state, onDownload, onRegenerate }: VideoResultProps) {
  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
      {state.loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="w-full px-4">
            <p className="mb-2 text-sm text-slate-500">Generating video...</p>
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-slate-900 transition-all duration-300 ease-out"
                style={{ width: `${state.progress}%` }}
              ></div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {state.progress.toFixed(0)}%
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
            <video
              src={state.url ?? ""}
              controls
              className="aspect-video w-full bg-black object-contain"
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
