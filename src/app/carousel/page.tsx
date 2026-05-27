import { IMAGE_TEMPLATES } from "@/components/Sidebar";
import { CarouselGenerator } from "@/components/media/CarouselGenerator";

const carouselTemplate = IMAGE_TEMPLATES.find(
  (template) => template.id === "carousel",
);

export default function CarouselTemplatePage() {
  return <CarouselGenerator initialPrompt={carouselTemplate?.prompt ?? ""} />;
}
