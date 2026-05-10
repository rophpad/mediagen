"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Download,
  Edit2,
  RefreshCw,
  Settings2,
  Upload,
  X,
} from "lucide-react";

import {
  DEFAULT_IMAGE_SETTINGS,
  IMAGE_QUALITIES,
  IMAGE_MODELS,
  IMAGE_SIZES,
  type ImageGenerationSettings,
} from "@/lib/image-settings";

interface ImageState {
  url: string | null;
  loading: boolean;
  originalPrompt: string;
}

type SelectOption<T extends string> = {
  value: T;
  label: string;
};

function SelectField<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-900">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function AIImageGenerator() {
  const [imageState, setImageState] = useState<ImageState>({
    url: null,
    loading: false,
    originalPrompt: "",
  });
  const [prompt, setPrompt] = useState("");
  const [settings, setSettings] = useState<ImageGenerationSettings>(
    DEFAULT_IMAGE_SETTINGS,
  );
  const [editSourceUrl, setEditSourceUrl] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const buildMockImageUrl = () =>
    `https://images.unsplash.com/photo-1579783902614-e3fb5141b0cb?w=800&q=80&t=${Date.now()}`;

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
    setImageState((prev) => ({ ...prev, loading: true }));

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: nextPrompt,
          settings,
        }),
      });

      if (!response.ok) throw new Error("Generation failed");

      const data = await response.json();

      setImageState({
        url: data.url,
        loading: false,
        originalPrompt: nextPrompt,
      });
      setEditSourceUrl(null);
    } catch (error) {
      console.error("Error:", error);
      setImageState({
        url: buildMockImageUrl(),
        loading: false,
        originalPrompt: nextPrompt,
      });
      setEditSourceUrl(null);
    }
  };

  const requestEditImage = async (nextPrompt: string, sourceUrl: string) => {
    setImageState((prev) => ({ ...prev, loading: true }));

    try {
      const formData = new FormData();

      if (sourceUrl.startsWith("data:") || sourceUrl.startsWith("blob:")) {
        const sourceFile = await imageFileFromUrl(sourceUrl);
        formData.append("image", sourceFile, sourceFile.name);
      } else {
        formData.append("imageUrl", sourceUrl);
      }

      formData.append("prompt", nextPrompt);
      formData.append("model", settings.model);
      formData.append("size", settings.size);
      formData.append("quality", settings.quality);

      const response = await fetch("/api/edit-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Edit failed");

      const data = await response.json();

      setEditSourceUrl(data.url);
      setImageState({
        url: data.url,
        loading: false,
        originalPrompt: nextPrompt,
      });
    } catch (error) {
      console.error("Error:", error);
      const fallbackUrl = buildMockImageUrl();
      setEditSourceUrl(fallbackUrl);
      setImageState({
        url: fallbackUrl,
        loading: false,
        originalPrompt: nextPrompt,
      });
    }
  };

  const handleGenerateImage = () => {
    const nextPrompt = prompt.trim();
    if (!nextPrompt) return;

    if (editSourceUrl) {
      void requestEditImage(nextPrompt, editSourceUrl);
      return;
    }

    void requestGenerateImage(nextPrompt);
  };

  const handleRegenerate = () => {
    if (!imageState.originalPrompt.trim()) return;

    if (editSourceUrl) {
      void requestEditImage(imageState.originalPrompt, editSourceUrl);
      return;
    }

    void requestGenerateImage(imageState.originalPrompt);
  };

  const handleModify = () => {
    setPrompt("");
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
      anchor.download = `ai-image-${Date.now()}.png`;
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

      setPrompt("");
      setEditSourceUrl(result);
      setImageState({
        url: result,
        loading: false,
        originalPrompt: "",
      });
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const showPreview = imageState.loading || Boolean(imageState.url);
  const primaryActionLabel = editSourceUrl ? "Edit Image" : "Generate Image";
  const loadingLabel = editSourceUrl ? "Editing..." : "Generating...";
  const previewLabel = editSourceUrl ? "Editing..." : "Generating...";

  return (
    <div className="relative min-h-screen overflow-hidden  px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 " />

      <div className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center">
        <div className="mb-8 flex flex-col items-center justify-center">
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl text-center">
            Generate and edit images
          </h1>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
          <div className="flex gap-3">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={
                editSourceUrl
                  ? "Describe the change…"
                  : "Describe the image you want to create…"
              }
              className="h-28 flex-1 resize-none rounded-2xl border border-slate-300 bg-white p-4 text-base text-slate-950 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-28 w-24 items-center justify-center rounded-2xl border border-slate-300 bg-white transition hover:border-slate-400 hover:bg-slate-50"
                title="Upload image"
              >
                <Upload size={22} className="text-slate-900" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleGenerateImage}
              disabled={!prompt.trim() || imageState.loading}
              className="inline-flex flex-1 items-center justify-center rounded-full bg-slate-950 px-5 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {imageState.loading ? loadingLabel : primaryActionLabel}
            </button>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              aria-haspopup="dialog"
              className="inline-flex items-center gap-2 self-start rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-900 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
            >
              <Settings2 size={16} />
              Settings
            </button>
          </div>
        </div>

        {showPreview && (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
            {imageState.loading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-14 text-center">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-950" />
                <p className="text-sm text-slate-600">{previewLabel}</p>
              </div>
            ) : (
              <>
                <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <img
                    src={imageState.url ?? ""}
                    alt="Generated image"
                    className="h-auto w-full object-cover"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-3 font-medium text-white transition hover:bg-slate-800"
                  >
                    <Download size={18} />
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={handleModify}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-3 font-medium text-white transition hover:bg-slate-800"
                  >
                    <Edit2 size={18} />
                    Modify
                  </button>
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-3 font-medium text-white transition hover:bg-slate-800"
                  >
                    <RefreshCw size={18} />
                    Regenerate
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            className="w-full max-w-4xl overflow-hidden rounded-3xl border border-white/20 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h2
                  id="settings-title"
                  className="mt-2 text-2xl font-semibold text-slate-950"
                >
                  Settings
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                aria-label="Close settings"
                className="inline-flex size-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-5 px-6 py-6">
              <SelectField
                label="Model"
                options={IMAGE_MODELS}
                value={settings.model}
                onChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    model: value,
                  }))
                }
              />
              <SelectField
                label="Size"
                options={IMAGE_SIZES}
                value={settings.size}
                onChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    size: value,
                  }))
                }
              />
              <SelectField
                label="Quality"
                options={IMAGE_QUALITIES}
                value={settings.quality}
                onChange={(value) =>
                  setSettings((prev) => ({
                    ...prev,
                    quality: value,
                  }))
                }
              />
            </div>

            <div className="flex justify-end border-t border-slate-200 px-6 py-5">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
