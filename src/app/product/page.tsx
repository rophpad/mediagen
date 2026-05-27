import { IMAGE_TEMPLATES } from "@/components/Sidebar";
import { ImageGenerator } from "@/components/media/ImageGenerator";

const productTemplate = IMAGE_TEMPLATES.find(
  (template) => template.id === "product",
);

export default function ProductTemplatePage() {
  return (
    <ImageGenerator
      activeTemplate="product"
      initialPrompt={productTemplate?.prompt ?? ""}
    />
  );
}
