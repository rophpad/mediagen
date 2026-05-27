import {
  Film,
  GalleryHorizontal,
  ImageIcon,
  Megaphone,
  Palette,
  ShoppingBag,
  Smartphone,
  Volume2,
} from "lucide-react";

export type MediaTool = "image" | "video" | "audio";

export const IMAGE_TEMPLATES = [
  {
    id: "product",
    label: "Product marketing",
    icon: ShoppingBag,
    prompt:
      "A highly detailed product shot of [Product Name], resting on a [Surface type], with [Lighting style] lighting, soft background blur, 8k resolution.",
  },
  {
    id: "carousel",
    label: "Social carousel",
    icon: GalleryHorizontal,
    prompt:
      "A vibrant, eye-catching background graphic for an Instagram carousel post about [Topic], featuring clean space for text overlays, modern minimalist aesthetic.",
  },
  {
    id: "concept",
    label: "Concept art",
    icon: Palette,
    prompt:
      "A stunning piece of digital concept art depicting [Scene/Character], trending on ArtStation, cinematic lighting, epic composition, unreal engine 5 render.",
  },
];

export const VIDEO_TEMPLATES = [
  {
    id: "ugc",
    label: "UGC video",
    icon: Smartphone,
    prompt:
      "A vertical smartphone style video of a person holding and demonstrating [Product], casual lighting, authentic social media feel, dynamic motion.",
  },
  {
    id: "ad",
    label: "Short ad commercial",
    icon: Megaphone,
    prompt:
      "A high-quality cinematic slow-motion pan of [Product/Scene], professional studio lighting, depth of field, vivid colors, 4k.",
  },
];

interface SidebarProps {
  activeTool: MediaTool;
  activeTemplate: string | null;
  onSelectTool: (tool: MediaTool) => void;
  onSelectTemplate: (
    tool: MediaTool,
    templateId: string,
    prompt: string,
  ) => void;
}

export function Sidebar({
  activeTool,
  activeTemplate,
  onSelectTool,
  onSelectTemplate,
}: SidebarProps) {
  return (
    <aside className="border-b border-slate-200 bg-white px-4 py-4 lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:border-b-0 lg:border-r lg:px-6 lg:py-8">
      <div className="mb-6 flex items-center gap-2">
        <span className="text-base font-semibold tracking-tight text-slate-900">
          mediagen
        </span>
      </div>

      <div className="mt-8 space-y-6">
        <div>
          <h3 className="mb-2 px-3 text-xs font-semibold tracking-wider text-slate-400">
            TOOLS
          </h3>
          <nav className="grid gap-1">
            <button
              type="button"
              onClick={() => onSelectTool("image")}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTool === "image" && !activeTemplate
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <ImageIcon size={16} />
              Image generation
            </button>
            <button
              type="button"
              onClick={() => onSelectTool("video")}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTool === "video" && !activeTemplate
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Film size={16} />
              Video generation
            </button>
            <button
              type="button"
              onClick={() => onSelectTool("audio")}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTool === "audio" && !activeTemplate
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Volume2 size={16} />
              Audio generation
            </button>
          </nav>
        </div>

        <div>
          <h3 className="mb-2 px-3 text-xs font-semibold tracking-wider text-slate-400">
            IMAGE TEMPLATES
          </h3>
          <nav className="grid gap-1">
            {IMAGE_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() =>
                  onSelectTemplate("image", template.id, template.prompt)
                }
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeTemplate === template.id
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <template.icon size={16} />
                {template.label}
              </button>
            ))}
          </nav>
        </div>

        <div>
          <h3 className="mb-2 px-3 text-xs font-semibold tracking-wider text-slate-400">
            VIDEO TEMPLATES
          </h3>
          <nav className="grid gap-1">
            {VIDEO_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() =>
                  onSelectTemplate("video", template.id, template.prompt)
                }
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeTemplate === template.id
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <template.icon size={16} />
                {template.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </aside>
  );
}
