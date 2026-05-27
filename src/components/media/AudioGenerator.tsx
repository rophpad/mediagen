"use client";

import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, Settings2 } from "lucide-react";

import { MediaShell } from "./MediaShell";
import {
  createInitialMediaState,
  GENERATION_FAILURE_MESSAGE,
  logFailedResponse,
  type MediaState,
} from "./media-utils";
import {
  DEFAULT_AUDIO_SETTINGS,
  DEFAULT_IMAGE_SETTINGS,
  DEFAULT_VIDEO_SETTINGS,
  type AudioFormat,
  type AudioGenerationSettings,
  type ImageGenerationSettings,
  type VideoGenerationSettings,
} from "@/lib/image-settings";

interface AudioGeneratorProps {
  activeTemplate?: string | null;
  initialPrompt?: string;
  title?: string;
}

interface AudioInputProps {
  input: string;
  setInput: (input: string) => void;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
  onOpenSettings: () => void;
}

interface AudioResultProps {
  state: MediaState;
  onDownload: () => void;
  onRegenerate: () => void;
}

export function AudioGenerator({
  activeTemplate = null,
  initialPrompt = "",
  title = "Generate audio",
}: AudioGeneratorProps) {
  const [imageSettings, setImageSettings] = useState<ImageGenerationSettings>(
    DEFAULT_IMAGE_SETTINGS,
  );
  const [videoSettings, setVideoSettings] = useState<VideoGenerationSettings>(
    DEFAULT_VIDEO_SETTINGS,
  );
  const [audioSettings, setAudioSettings] = useState<AudioGenerationSettings>(
    DEFAULT_AUDIO_SETTINGS,
  );
  const [audioState, setAudioState] = useState<MediaState>(
    createInitialMediaState,
  );
  const [audioInput, setAudioInput] = useState(initialPrompt);
  const [generatedFormat, setGeneratedFormat] = useState<AudioFormat>(
    DEFAULT_AUDIO_SETTINGS.format,
  );
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrlRef.current) {
        window.URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  const requestGenerateAudio = async (apiKey: string, nextInput: string) => {
    setAudioState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch("/api/generate-audio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          input: nextInput,
          settings: audioSettings,
        }),
      });

      if (!response.ok) {
        await logFailedResponse(response, "Audio generation request");
        throw new Error("Audio generation failed");
      }

      const blob = await response.blob();
      const audioUrl = window.URL.createObjectURL(blob);

      if (audioUrlRef.current) {
        window.URL.revokeObjectURL(audioUrlRef.current);
      }

      audioUrlRef.current = audioUrl;
      setGeneratedFormat(audioSettings.format);
      setAudioState({
        url: audioUrl,
        loading: false,
        originalPrompt: nextInput,
        error: null,
        progress: 0,
      });
    } catch (error) {
      console.error("Audio generation failed:", error);
      setAudioState((prev) => ({
        ...prev,
        loading: false,
        error: GENERATION_FAILURE_MESSAGE,
      }));
    }
  };

  const handleGenerate = (apiKey: string) => {
    const nextInput = audioInput.trim();
    if (!nextInput) return;

    void requestGenerateAudio(apiKey, nextInput);
  };

  const handleRegenerate = (apiKey: string) => {
    if (!audioState.originalPrompt.trim()) return;

    void requestGenerateAudio(apiKey, audioState.originalPrompt);
  };

  const handleDownload = () => {
    if (!audioState.url) return;

    const anchor = document.createElement("a");
    anchor.href = audioState.url;
    anchor.download = `speech-${Date.now()}.${generatedFormat}`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  return (
    <MediaShell
      activeTool="audio"
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
        const showPreview = audioState.loading || Boolean(audioState.url);

        return (
          <>
            <AudioInput
              input={audioInput}
              setInput={setAudioInput}
              loading={audioState.loading}
              error={audioState.error}
              onGenerate={() => handleGenerate(apiKey)}
              onOpenSettings={openSettings}
            />

            {showPreview && (
              <AudioResult
                state={audioState}
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

function AudioInput({
  input,
  setInput,
  loading,
  error,
  onGenerate,
  onOpenSettings,
}: AudioInputProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="Enter the text you want to turn into natural speech…"
        className="h-40 w-full resize-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
      />

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
          disabled={!input.trim() || loading}
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? "Generating audio..." : "Generate Audio"}
        </button>
      </div>
    </div>
  );
}

function AudioResult({ state, onDownload, onRegenerate }: AudioResultProps) {
  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
      {state.loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">Generating audio...</p>
        </div>
      ) : (
        <>
          <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-4">
            <audio src={state.url ?? ""} controls className="w-full" />
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
