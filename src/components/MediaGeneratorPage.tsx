"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Download, Edit2, RefreshCw, Settings2, Upload } from "lucide-react";

import {
  IMAGE_TEMPLATES,
  Sidebar,
  VIDEO_TEMPLATES,
  type MediaTool,
} from "@/components/Sidebar";
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
  progress: number;
}

interface CarouselSlideState {
  url: string | null;
  text: string;
  prompt: string;
  error: string | null;
}

interface MediaGeneratorPageProps {
  initialTool?: MediaTool;
  initialTemplateId?: string | null;
}

const TOOL_ROUTES: Record<MediaTool, string> = {
  image: "/image",
  video: "/video",
};

const TEMPLATE_ROUTES: Record<string, string> = {
  product: "/product",
  carousel: "/carousel",
  concept: "/concept-art",
  ugc: "/ugc-video",
  ad: "/short-ad",
};

const GENERATION_FAILURE_MESSAGE =
  'Generation failed for some reasons. Please try again or contact "rophenp@gmail.com".';

type ApiErrorResponse = {
  error?: unknown;
  requestId?: unknown;
  details?: unknown;
};

async function logFailedResponse(response: Response, context: string) {
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? ((await response.json().catch(() => null)) as ApiErrorResponse | null)
    : await response.text().catch(() => null);

  console.error(`${context} failed`, {
    status: response.status,
    statusText: response.statusText,
    requestId:
      payload && typeof payload === "object" ? payload.requestId : undefined,
    error: payload && typeof payload === "object" ? payload.error : undefined,
    details: payload && typeof payload === "object" ? payload.details : payload,
  });
}

function isVideoComplete(status: unknown, progress: number) {
  return status === "completed" || status === "succeeded" || progress >= 100;
}

function createCarouselSlideTexts(count: number, existingTexts: string[] = []) {
  return Array.from(
    { length: count },
    (_, index) => existingTexts[index] ?? `Slide ${index + 1}: `,
  );
}

function createCarouselPrompt({
  basePrompt,
  globalStyle,
  slideText,
  slideNumber,
  totalSlides,
}: {
  basePrompt: string;
  globalStyle: string;
  slideText: string;
  slideNumber: number;
  totalSlides: number;
}) {
  return [
    `Carousel topic and context: ${basePrompt}`,
    `Generate exactly one single image for slide ${slideNumber} of ${totalSlides}.`,
    "This image must be one standalone carousel slide only — do not create a collage, storyboard, grid, contact sheet, or multiple slides inside the same image.",
    `The only slide text/content this image must contain is: ${slideText}`,
    `Use this same global visual style across every generated slide: ${globalStyle}`,
    "Keep typography readable, composition clean, and leave balanced margins for social media viewing.",
  ]
    .filter(Boolean)
    .join("\n");
}

function createInitialMediaState(): MediaState {
  return {
    url: null,
    loading: false,
    originalPrompt: "",
    error: null,
    progress: 0,
  };
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const result = event.target?.result;

      if (typeof result !== "string") {
        reject(new Error("Unable to read file"));
        return;
      }

      resolve(result);
    };

    reader.onerror = () => {
      reject(new Error("Unable to read file"));
    };

    reader.readAsDataURL(file);
  });
}

function parseFrameSize(size: VideoGenerationSettings["size"]) {
  const [widthValue, heightValue] = size.split("x");
  const width = Number(widthValue);
  const height = Number(heightValue);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`Invalid video size: ${size}`);
  }

  return { width, height };
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();

    image.crossOrigin = "anonymous";

    image.onload = () => {
      resolve(image);
    };

    image.onerror = () => {
      reject(new Error("Unable to read source image"));
    };

    image.src = src;
  });
}

async function normalizeVideoSourceImage(
  sourceUrl: string,
  size: VideoGenerationSettings["size"],
) {
  const { width, height } = parseFrameSize(size);
  const image = await loadImageElement(sourceUrl);
  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to prepare source image");
  }

  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  if (!sourceWidth || !sourceHeight) {
    throw new Error("Unable to read source image dimensions");
  }

  const targetAspectRatio = width / height;
  const sourceAspectRatio = sourceWidth / sourceHeight;

  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  let cropX = 0;
  let cropY = 0;

  if (sourceAspectRatio > targetAspectRatio) {
    cropWidth = sourceHeight * targetAspectRatio;
    cropX = (sourceWidth - cropWidth) / 2;
  } else if (sourceAspectRatio < targetAspectRatio) {
    cropHeight = sourceWidth / targetAspectRatio;
    cropY = (sourceHeight - cropHeight) / 2;
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    width,
    height,
  );

  try {
    return canvas.toDataURL("image/png");
  } catch {
    if (/^https?:\/\//i.test(sourceUrl)) {
      return sourceUrl;
    }

    throw new Error("Unable to prepare source image");
  }
}

export default function MediaGeneratorPage({
  initialTool = "image",
  initialTemplateId = null,
}: MediaGeneratorPageProps) {
  const router = useRouter();
  const initialTemplate = [...IMAGE_TEMPLATES, ...VIDEO_TEMPLATES].find(
    (template) => template.id === initialTemplateId,
  );
  const initialPrompt = initialTemplate?.prompt ?? "";
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

  const [activeTool, setActiveTool] = useState<MediaTool>(initialTool);
  const [activeTemplate, setActiveTemplate] = useState<string | null>(
    initialTemplateId,
  );
  const [imageState, setImageState] = useState<MediaState>(
    createInitialMediaState,
  );
  const [videoState, setVideoState] = useState<MediaState>(
    createInitialMediaState,
  );
  const [imagePrompt, setImagePrompt] = useState(
    initialTool === "image" ? initialPrompt : "",
  );
  const [videoPrompt, setVideoPrompt] = useState(
    initialTool === "video" ? initialPrompt : "",
  );
  const [carouselCount, setCarouselCount] = useState(3);
  const [carouselSlideTexts, setCarouselSlideTexts] = useState(() =>
    createCarouselSlideTexts(3),
  );
  const [carouselGlobalStyle, setCarouselGlobalStyle] = useState(
    "Modern minimalist design, consistent brand colors, clean typography, soft background shapes, high contrast readable text.",
  );
  const [carouselSlides, setCarouselSlides] = useState<CarouselSlideState[]>(
    [],
  );
  const [carouselLoading, setCarouselLoading] = useState(false);
  const [carouselError, setCarouselError] = useState<string | null>(null);
  const [imageSettings, setImageSettings] = useState<ImageGenerationSettings>(
    DEFAULT_IMAGE_SETTINGS,
  );
  const [videoSettings, setVideoSettings] = useState<VideoGenerationSettings>(
    DEFAULT_VIDEO_SETTINGS,
  );
  const [editSourceUrl, setEditSourceUrl] = useState<string | null>(null);
  const [videoSourceUrl, setVideoSourceUrl] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

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

  const requestGenerateImage = async (
    nextPrompt: string,
    sourceUrl?: string,
  ) => {
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
          ...(sourceUrl ? { image: sourceUrl } : {}),
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

  const requestGenerateCarousel = async (basePrompt: string) => {
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
        };

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
      setEditSourceUrl(null);
    } catch (error) {
      console.error("Carousel generation failed:", error);
      const message = GENERATION_FAILURE_MESSAGE;

      setCarouselError(message);
      setImageState((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }));
    } finally {
      setCarouselLoading(false);
    }
  };

  const requestEditImage = async (nextPrompt: string, sourceUrl: string) => {
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

  const requestGenerateVideo = async (nextPrompt: string) => {
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

      // Step 1: Initiate video generation
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

      // Step 2: Poll for completion on client-side
      let status = initData.status;
      let progress =
        typeof initData.progress === "number" ? initData.progress : 0;
      const maxAttempts = 60; // Up to 5 minutes at 5s intervals
      let attempts = 0;

      while (!isVideoComplete(status, progress) && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        attempts++;

        const statusResponse = await fetch(`/api/video/${videoId}`, {
          headers: {
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
        });

        if (!statusResponse.ok) {
          await logFailedResponse(statusResponse, "Video status request");
          continue;
        }

        const statusData = await statusResponse.json();
        status = statusData.status;
        progress =
          typeof statusData.progress === "number"
            ? statusData.progress
            : progress;

        setVideoState((prev) => ({ ...prev, progress }));

        if (status === "failed") {
          throw new Error("Video generation failed during processing");
        }
      }

      if (!isVideoComplete(status, progress)) {
        throw new Error("Video generation timed out");
      }

      // Step 3: Get final content URL
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
        progress: 100, // Set to 100% on success
      });
    } catch (error) {
      console.error("Video generation failed:", error);
      setVideoState((prev) => ({
        ...prev,
        loading: false,
        error: GENERATION_FAILURE_MESSAGE,
        progress: 0, // Reset progress on error
      }));
    }
  };

  const handleSelectTool = (tool: MediaTool) => {
    setActiveTool(tool);
    setActiveTemplate(null);
    router.push(TOOL_ROUTES[tool]);
  };

  const handleSelectTemplate = (
    tool: MediaTool,
    templateId: string,
    prompt: string,
  ) => {
    setActiveTool(tool);
    setActiveTemplate(templateId);
    router.push(TEMPLATE_ROUTES[templateId]);
    if (tool === "image") {
      setImagePrompt(prompt);
    } else {
      setVideoPrompt(prompt);
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

  const handleGenerate = () => {
    if (activeTemplate === "carousel") {
      const nextPrompt = imagePrompt.trim();
      if (!nextPrompt) return;

      void requestGenerateCarousel(nextPrompt);
      return;
    }

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

    if (activeTemplate === "carousel") {
      void requestGenerateCarousel(imageState.originalPrompt);
      return;
    }

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
      setActiveTool("image");
    } catch (error) {
      console.error("Image upload failed:", error);
      setImageState((prev) => ({
        ...prev,
        error: "Unable to read the uploaded image. Try a different file.",
      }));
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

  const handleClearImageSource = () => {
    setEditSourceUrl(null);
    setImageState(createInitialMediaState());
    setImagePrompt("");
  };

  const handleClearVideoSource = () => {
    setVideoSourceUrl(null);
  };

  const currentPrompt = activeTool === "video" ? videoPrompt : imagePrompt;
  const currentState = activeTool === "video" ? videoState : imageState;
  const isVideoTool = activeTool === "video";
  const isCarouselTemplate = activeTemplate === "carousel";
  const showPreview =
    currentState.loading ||
    Boolean(currentState.url) ||
    (isCarouselTemplate && carouselSlides.length > 0);
  const primaryActionLabel = isVideoTool
    ? "Generate Video"
    : isCarouselTemplate
      ? "Generate Carousel"
      : editSourceUrl
        ? "Edit Image"
        : "Generate Image";
  const loadingLabel = isVideoTool
    ? "Generating video..."
    : isCarouselTemplate
      ? `Generating carousel (${carouselSlides.length}/${carouselCount})...`
      : editSourceUrl
        ? "Editing image..."
        : "Generating image...";
  const title = isVideoTool
    ? "Generate videos"
    : isCarouselTemplate
      ? "Generate carousel"
      : "Generate and edit images";

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
                        ? videoSourceUrl
                          ? "Describe the shot, action, camera movement, and scene…"
                          : "Describe the video you want to create…"
                        : editSourceUrl
                          ? "Describe the change…"
                          : "Describe the image you want to create…"
                    }
                    className="h-24 flex-1 resize-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                  {isVideoTool ? (
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => videoFileInputRef.current?.click()}
                        className="flex h-24 w-20 items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                        title="Upload source image"
                      >
                        <Upload size={20} />
                      </button>
                      <input
                        ref={videoFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleVideoSourceUpload}
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => imageFileInputRef.current?.click()}
                        className="flex h-24 w-20 items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                        title="Upload image"
                      >
                        <Upload size={20} />
                      </button>
                      <input
                        ref={imageFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </div>
                  )}
                </div>

                {!isVideoTool && !isCarouselTemplate && editSourceUrl && (
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
                        onClick={handleClearImageSource}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={editSourceUrl}
                        alt="Reference image for image generation"
                        className="h-48 w-full object-contain"
                      />
                    </div>
                  </div>
                )}

                {isVideoTool && (
                  <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          Source image
                        </p>
                        <p className="text-xs text-slate-500">
                          Optional. Upload an image to animate, or leave this
                          empty for text-to-video.
                        </p>
                      </div>
                      {videoSourceUrl && (
                        <button
                          type="button"
                          onClick={handleClearVideoSource}
                          className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {videoSourceUrl && (
                      <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={videoSourceUrl}
                          alt="Source image for video generation"
                          className="h-48 w-full object-contain"
                        />
                      </div>
                    )}
                  </div>
                )}

                {isCarouselTemplate && (
                  <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                    <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
                      <label className="text-sm font-medium text-slate-700">
                        Number of slides
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={carouselCount}
                          onChange={(event) =>
                            handleCarouselCountChange(
                              Number(event.target.value),
                            )
                          }
                          className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-1 focus:ring-slate-300"
                        />
                      </label>

                      <label className="text-sm font-medium text-slate-700">
                        Global style for all slides
                        <textarea
                          value={carouselGlobalStyle}
                          onChange={(event) =>
                            setCarouselGlobalStyle(event.target.value)
                          }
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
                        {carouselSlideTexts.map((slideText, index) => (
                          <label
                            key={index}
                            className="grid gap-2 text-xs font-medium uppercase tracking-wide text-slate-400 sm:grid-cols-[80px_1fr] sm:items-center"
                          >
                            Slide {index + 1}
                            <input
                              type="text"
                              value={slideText}
                              onChange={(event) =>
                                handleCarouselSlideTextChange(
                                  index,
                                  event.target.value,
                                )
                              }
                              placeholder={`Text for slide ${index + 1}`}
                              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-1 focus:ring-slate-300"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {(currentState.error || carouselError) && (
                  <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    {carouselError ?? currentState.error}
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
                    disabled={
                      !currentPrompt.trim() ||
                      currentState.loading ||
                      carouselLoading
                    }
                    className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {currentState.loading || carouselLoading
                      ? loadingLabel
                      : primaryActionLabel}
                  </button>
                </div>
              </div>

              {showPreview && (
                <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
                  {currentState.loading ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                      {isVideoTool ? (
                        <div className="w-full px-4">
                          <p className="mb-2 text-sm text-slate-500">
                            Generating video...
                          </p>
                          <div className="h-2 w-full rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-slate-900 transition-all duration-300 ease-out"
                              style={{ width: `${currentState.progress}%` }}
                            ></div>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            {currentState?.progress?.toFixed(0)}%
                          </p>
                        </div>
                      ) : (
                        <>
                          <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
                          <p className="text-sm text-slate-500">
                            {loadingLabel}
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      {isCarouselTemplate && carouselSlides.length > 0 ? (
                        <div className="mb-4 grid gap-4 sm:grid-cols-2">
                          {carouselSlides.map((slide, index) => (
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
                                <p className="mt-1 text-sm text-slate-700">
                                  {slide.text}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mb-4 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                          {isVideoTool ? (
                            <video
                              src={currentState.url ?? ""}
                              controls
                              className="aspect-video w-full bg-black object-contain"
                            />
                          ) : (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={currentState.url ?? ""}
                                alt="Generated media"
                                className="h-auto w-full object-cover"
                              />
                            </>
                          )}
                        </div>
                      )}

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
