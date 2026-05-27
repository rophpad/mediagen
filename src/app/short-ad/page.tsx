import { VIDEO_TEMPLATES } from "@/components/Sidebar";
import { VideoGenerator } from "@/components/media/VideoGenerator";

const adTemplate = VIDEO_TEMPLATES.find((template) => template.id === "ad");

export default function ShortAdTemplatePage() {
  return (
    <VideoGenerator
      activeTemplate="ad"
      initialPrompt={adTemplate?.prompt ?? ""}
    />
  );
}
