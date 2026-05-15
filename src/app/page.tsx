"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Download, Edit2, RefreshCw, Settings2, Upload } from "lucide-react";

import { Sidebar, type MediaTool } from "@/components/Sidebar";
import { SettingsModal } from "@/components/SettingsModal";
import { Header } from "@/components/Header";

import {
  DEFAULT_IMAGE_SETTINGS,
  DEFAULT_VIDEO_SETTINGS,
  type ImageGenerationSettings,
  type VideoGenerationSettings,
} from "@/lib/image-settings";

interface MediaState {
  url: string | null;
  loading: boolean;
  originalPrompt: string;
  error: string | null;
}

function createInitialMediaState(): MediaState {
  return {
    url: null,
    loading: false,
    originalPrompt: "",
    error: null,
  };
}

export default function MediaGenerator() {
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    // Only access localStorage after initial render to avoid hydration mismatch
    const storedKey = window.localStorage.getItem("mediagen_api_key");
    if (storedKey) {
      // Defer the state update to avoid synchronous setState inside effect warnings
      setTimeout(() => {
        setApiKey(storedKey);
      }, 0);
    }
  }, []);

  const [activeTool, setActiveTool] = useState<MediaTool>("image");
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [imageState, setImageState] = useState<MediaState>(
    createInitialMediaState,
  );
  const [videoState, setVideoState] = useState<MediaState>(
    createInitialMediaState,
  );
  const [imagePrompt, setImagePrompt] = useState("");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [imageSettings, setImageSettings] = useState<ImageGenerationSettings>(
    DEFAULT_IMAGE_SETTINGS,
  );
  const [videoSettings, setVideoSettings] = useState<VideoGenerationSettings>(
    DEFAULT_VIDEO_SETTINGS,
  );
  const [editSourceUrl, setEditSourceUrl] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    window.localStorage.setItem("mediagen_api_key", key);
  };

  useEffect(() => {
    if (!isSettingsOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSettingsOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isSettingsOpen]);

  const imageFileFromUrl = async (url: string) => {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Unable to read image source");
    }

    const blob = await response.blob();

    return new File([blob], "image.png", {
      type: blob.type || "image/png",
    });
  };

  const requestGenerateImage = async (nextPrompt: string) => {
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

      if (!response.ok) throw new Error("Generation failed");

      const data = await response.json();

      setImageState({
        url: data.url,
        loading: false,
        originalPrompt: nextPrompt,
        error: null,
      });
      setEditSourceUrl(null);
    } catch (error) {
      console.error("Image generation failed:", error);
      setImageState((prev) => ({
        ...prev,
        loading: false,
        error:
          "Image generation failed. Check your API configuration and try again.",
      }));
      setEditSourceUrl(null);
    }
  };

  const requestEditImage = async (nextPrompt: string, sourceUrl: string) => {
    setImageState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const formData = new FormData();

      if (sourceUrl.startsWith("data:") || sourceUrl.startsWith("blob:")) {
        const sourceFile = await imageFileFromUrl(sourceUrl);
        formData.append("image", sourceFile, sourceFile.name);
      } else {
        formData.append("imageUrl", sourceUrl);
      }

      formData.append("prompt", nextPrompt);
      formData.append("model", imageSettings.model);
      formData.append("size", imageSettings.size);
      formData.append("quality", imageSettings.quality);

      const headers: HeadersInit = {};
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const response = await fetch("/api/edit-image", {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) throw new Error("Edit failed");

      const data = await response.json();

      setEditSourceUrl(data.url);
      setImageState({
        url: data.url,
        loading: false,
        originalPrompt: nextPrompt,
        error: null,
      });
    } catch (error) {
      console.error("Image edit failed:", error);
      setImageState((prev) => ({
        ...prev,
        loading: false,
        error: "Image edit failed. Check your API configuration and try again.",
      }));
    }
  };

  const requestGenerateVideo = async (nextPrompt: string) => {
    setVideoState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const initResponse = await fetch("/api/generate-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          prompt: nextPrompt,
          settings: videoSettings,
        }),
      });

      if (!initResponse.ok) {
        const errorData = await initResponse.json().catch(() => null);
        throw new Error(
          errorData?.error || "Failed to initiate video generation",
        );
      }

      const initData = await initResponse.json();
      const videoId = initData.id;

      if (!videoId) {
        throw new Error("No video ID returned");
      }

      // Poll for completion
      let status = initData.status;
      let attempts = 0;
      const maxAttempts = 60; // Up to 5 minutes at 5s intervals

      while (status !== "succeeded" && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        attempts++;

        const statusResponse = await fetch(`/api/video/${videoId}`, {
          headers: {
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
        });

        if (!statusResponse.ok) continue;

        const statusData = await statusResponse.json();
        status = statusData.status;

        if (status === "failed") {
          throw new Error("Video generation failed during processing");
        }
      }

      if (status !== "succeeded") {
        throw new Error("Video generation timed out");
      }

      // Get final content URL
      const contentResponse = await fetch(`/api/video/${videoId}/content`, {
        headers: {
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
      });

      if (!contentResponse.ok) {
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
      });
    } catch (error) {
      console.error("Video generation failed:", error);
      setVideoState((prev) => ({
        ...prev,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Video generation failed. Check your API configuration and try again.",
      }));
    }
  };

  const handleSelectTool = (tool: MediaTool) => {
    setActiveTool(tool);
    setActiveTemplate(null);
  };

  const handleSelectTemplate = (
    tool: MediaTool,
    templateId: string,
    prompt: string,
  ) => {
    setActiveTool(tool);
    setActiveTemplate(templateId);
    if (tool === "image") {
      setImagePrompt(prompt);
    } else {
      setVideoPrompt(prompt);
    }
  };

  const handleGenerate = () => {
    if (activeTool === "video") {
      const nextPrompt = videoPrompt.trim();
      if (!nextPrompt) return;

      void requestGenerateVideo(nextPrompt);
      return;
    }

    const nextPrompt = imagePrompt.trim();
    if (!nextPrompt) return;

    if (editSourceUrl) {
      void requestEditImage(nextPrompt, editSourceUrl);
      return;
    }

    void requestGenerateImage(nextPrompt);
  };

  const handleRegenerate = () => {
    if (activeTool === "video") {
      if (!videoState.originalPrompt.trim()) return;

      void requestGenerateVideo(videoState.originalPrompt);
      return;
    }

    if (!imageState.originalPrompt.trim()) return;

    if (editSourceUrl) {
      void requestEditImage(imageState.originalPrompt, editSourceUrl);
      return;
    }

    void requestGenerateImage(imageState.originalPrompt);
  };

  const handleModify = () => {
    setImagePrompt("");
    if (imageState.url) {
      setEditSourceUrl(imageState.url);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDownload = async () => {
    const mediaState = activeTool === "video" ? videoState : imageState;
    if (!mediaState.url) return;

    try {
      const response = await fetch(mediaState.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${activeTool}-${Date.now()}.${activeTool === "video" ? "mp4" : "png"}`;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.[0]) return;

    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = (loadEvent) => {
      const result = loadEvent.target?.result;
      if (typeof result !== "string") return;

      setImagePrompt("");
      setEditSourceUrl(result);
      setImageState({
        url: result,
        loading: false,
        originalPrompt: "",
        error: null,
      });
      setActiveTool("image");
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const currentPrompt = activeTool === "video" ? videoPrompt : imagePrompt;
  const currentState = activeTool === "video" ? videoState : imageState;
  const showPreview = currentState.loading || Boolean(currentState.url);
  const isVideoTool = activeTool === "video";
  const primaryActionLabel = isVideoTool
    ? "Generate Video"
    : editSourceUrl
      ? "Edit Image"
      : "Generate Image";
  const loadingLabel = isVideoTool
    ? "Generating video..."
    : editSourceUrl
      ? "Editing image..."
      : "Generating image...";
  const title = isVideoTool ? "Generate videos" : "Generate and edit images";

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar
          activeTool={activeTool}
          activeTemplate={activeTemplate}
          onSelectTool={handleSelectTool}
          onSelectTemplate={handleSelectTemplate}
        />

        <div className="flex flex-1 flex-col lg:ml-64">
          <Header apiKey={apiKey} setApiKey={handleApiKeyChange} />

          <main className="flex-1 px-4 py-8 sm:px-6 lg:px-12">
            <div className="mx-auto flex w-full max-w-4xl flex-col">
              <div className="mb-8">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {title}
                </h1>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex gap-4">
                  <textarea
                    value={currentPrompt}
                    onChange={(event) =>
                      isVideoTool
                        ? setVideoPrompt(event.target.value)
                        : setImagePrompt(event.target.value)
                    }
                    placeholder={
                      isVideoTool
                        ? "Describe the video you want to create…"
                        : editSourceUrl
                          ? "Describe the change…"
                          : "Describe the image you want to create…"
                    }
                    className="h-24 flex-1 resize-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                  {!isVideoTool && (
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
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>
                  )}
                </div>

                {currentState.error && (
                  <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    {currentState.error}
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    aria-haspopup="dialog"
                    className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                  >
                    <Settings2 size={14} />
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={!currentPrompt.trim() || currentState.loading}
                    className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {currentState.loading ? loadingLabel : primaryActionLabel}
                  </button>
                </div>
              </div>

              {showPreview && (
                <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
                  {currentState.loading ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
                      <p className="text-sm text-slate-500">{loadingLabel}</p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                        {isVideoTool ? (
                          <video
                            src={currentState.url ?? ""}
                            controls
                            className="aspect-video w-full bg-black object-contain"
                          />
                        ) : (
                          <img
                            src={currentState.url ?? ""}
                            alt="Generated media"
                            className="h-auto w-full object-cover"
                          />
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleDownload}
                          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                        >
                          <Download size={14} />
                          Download
                        </button>
                        {!isVideoTool && (
                          <button
                            type="button"
                            onClick={handleModify}
                            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                          >
                            <Edit2 size={14} />
                            Modify
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleRegenerate}
                          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                        >
                          <RefreshCw size={14} />
                          Regenerate
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isVideoTool={isVideoTool}
        videoSettings={videoSettings}
        setVideoSettings={setVideoSettings}
        imageSettings={imageSettings}
        setImageSettings={setImageSettings}
      />
    </div>
  );
}
