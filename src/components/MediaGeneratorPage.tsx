"use client";

import {
  IMAGE_TEMPLATES,
  VIDEO_TEMPLATES,
  type MediaTool,
} from "@/components/Sidebar";
import { CarouselGenerator } from "@/components/media/CarouselGenerator";
import { ImageGenerator } from "@/components/media/ImageGenerator";
import { VideoGenerator } from "@/components/media/VideoGenerator";

interface MediaGeneratorPageProps {
  initialTool?: MediaTool;
  initialTemplateId?: string | null;
}

export default function MediaGeneratorPage({
  initialTool = "image",
  initialTemplateId = null,
}: MediaGeneratorPageProps) {
  const template = [...IMAGE_TEMPLATES, ...VIDEO_TEMPLATES].find(
    (item) => item.id === initialTemplateId,
  );
  const initialPrompt = template?.prompt ?? "";

  if (initialTemplateId === "carousel") {
    return <CarouselGenerator initialPrompt={initialPrompt} />;
  }

  if (initialTool === "video") {
    return (
      <VideoGenerator
        activeTemplate={initialTemplateId}
        initialPrompt={initialPrompt}
        title="Generate videos"
      />
    );
  }

  return (
    <ImageGenerator
      activeTemplate={initialTemplateId}
      initialPrompt={initialPrompt}
      title="Generate and edit images"
    />
  );
}
