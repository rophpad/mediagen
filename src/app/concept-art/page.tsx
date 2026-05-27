import { IMAGE_TEMPLATES } from "@/components/Sidebar";
import { ImageGenerator } from "@/components/media/ImageGenerator";

const conceptTemplate = IMAGE_TEMPLATES.find(
  (template) => template.id === "concept",
);

export default function ConceptArtTemplatePage() {
  return (
    <ImageGenerator
      activeTemplate="concept"
      initialPrompt={conceptTemplate?.prompt ?? ""}
    />
  );
}
