"use client";

import {
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";

import { Header } from "@/components/Header";
import { SettingsModal } from "@/components/SettingsModal";
import { Sidebar, type MediaTool } from "@/components/Sidebar";
import type {
  AudioGenerationSettings,
  ImageGenerationSettings,
  VideoGenerationSettings,
} from "@/lib/image-settings";

const TOOL_ROUTES: Record<MediaTool, string> = {
  image: "/image",
  video: "/video",
  audio: "/audio",
};

const TEMPLATE_ROUTES: Record<string, string> = {
  product: "/product",
  carousel: "/carousel",
  concept: "/concept-art",
  ugc: "/ugc-video",
  ad: "/short-ad",
};

interface MediaShellProps {
  activeTool: MediaTool;
  activeTemplate: string | null;
  title: string;
  imageSettings: ImageGenerationSettings;
  setImageSettings: Dispatch<SetStateAction<ImageGenerationSettings>>;
  videoSettings: VideoGenerationSettings;
  setVideoSettings: Dispatch<SetStateAction<VideoGenerationSettings>>;
  audioSettings: AudioGenerationSettings;
  setAudioSettings: Dispatch<SetStateAction<AudioGenerationSettings>>;
  children: (apiKey: string, openSettings: () => void) => ReactNode;
}

export function MediaShell({
  activeTool,
  activeTemplate,
  title,
  imageSettings,
  setImageSettings,
  videoSettings,
  setVideoSettings,
  audioSettings,
  setAudioSettings,
  children,
}: MediaShellProps) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const storedKey = window.localStorage.getItem("mediagen_api_key");

    if (storedKey) {
      setTimeout(() => {
        setApiKey(storedKey);
      }, 0);
    }
  }, []);

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

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    window.localStorage.setItem("mediagen_api_key", key);
  };

  const handleSelectTool = (tool: MediaTool) => {
    router.push(TOOL_ROUTES[tool]);
  };

  const handleSelectTemplate = (_tool: MediaTool, templateId: string) => {
    router.push(TEMPLATE_ROUTES[templateId]);
  };

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

              {children(apiKey, () => setIsSettingsOpen(true))}
            </div>
          </main>
        </div>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeTool={activeTool}
        videoSettings={videoSettings}
        setVideoSettings={setVideoSettings}
        imageSettings={imageSettings}
        setImageSettings={setImageSettings}
        audioSettings={audioSettings}
        setAudioSettings={setAudioSettings}
      />
    </div>
  );
}
