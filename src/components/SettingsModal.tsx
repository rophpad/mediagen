import { X } from "lucide-react";
import {
  IMAGE_MODELS,
  IMAGE_QUALITIES,
  IMAGE_SIZES,
  VIDEO_DURATIONS,
  VIDEO_MODELS,
  VIDEO_SIZES,
  type ImageGenerationSettings,
  type VideoGenerationSettings,
} from "@/lib/image-settings";
import type { Dispatch, SetStateAction } from "react";

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
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-0"
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

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isVideoTool: boolean;
  videoSettings: VideoGenerationSettings;
  setVideoSettings: Dispatch<SetStateAction<VideoGenerationSettings>>;
  imageSettings: ImageGenerationSettings;
  setImageSettings: Dispatch<SetStateAction<ImageGenerationSettings>>;
}

export function SettingsModal({
  isOpen,
  onClose,
  isVideoTool,
  videoSettings,
  setVideoSettings,
  imageSettings,
  setImageSettings,
}: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 px-4 py-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2
            id="settings-title"
            className="text-base font-semibold text-slate-900"
          >
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="inline-flex size-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid gap-4 px-5 py-5">
          {isVideoTool ? (
            <>
              <SelectField
                label="Model"
                options={VIDEO_MODELS}
                value={videoSettings.model}
                onChange={(value) =>
                  setVideoSettings((prev) => ({
                    ...prev,
                    model: value,
                  }))
                }
              />
              <SelectField
                label="Size"
                options={VIDEO_SIZES}
                value={videoSettings.size}
                onChange={(value) =>
                  setVideoSettings((prev) => ({
                    ...prev,
                    size: value,
                  }))
                }
              />
              <SelectField
                label="Duration"
                options={VIDEO_DURATIONS}
                value={videoSettings.duration}
                onChange={(value) =>
                  setVideoSettings((prev) => ({
                    ...prev,
                    duration: value,
                  }))
                }
              />
            </>
          ) : (
            <>
              <SelectField
                label="Model"
                options={IMAGE_MODELS}
                value={imageSettings.model}
                onChange={(value) =>
                  setImageSettings((prev) => ({
                    ...prev,
                    model: value,
                  }))
                }
              />
              <SelectField
                label="Size"
                options={IMAGE_SIZES}
                value={imageSettings.size}
                onChange={(value) =>
                  setImageSettings((prev) => ({
                    ...prev,
                    size: value,
                  }))
                }
              />
              <SelectField
                label="Quality"
                options={IMAGE_QUALITIES}
                value={imageSettings.quality}
                onChange={(value) =>
                  setImageSettings((prev) => ({
                    ...prev,
                    quality: value,
                  }))
                }
              />
            </>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
