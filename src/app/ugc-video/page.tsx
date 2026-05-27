import { VIDEO_TEMPLATES } from "@/components/Sidebar";
import { VideoGenerator } from "@/components/media/VideoGenerator";

const ugcTemplate = VIDEO_TEMPLATES.find((template) => template.id === "ugc");

export default function UgcVideoTemplatePage() {
  return (
    <VideoGenerator
      activeTemplate="ugc"
      initialPrompt={ugcTemplate?.prompt ?? ""}
    />
  );
}
