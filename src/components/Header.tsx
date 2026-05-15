import { useState } from "react";
import { Key, X } from "lucide-react";

interface HeaderProps {
  apiKey: string;
  setApiKey: (value: string) => void;
}

export function Header({ apiKey, setApiKey }: HeaderProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);

  const handleSave = () => {
    setApiKey(tempKey);
    setIsModalOpen(false);
  };

  return (
    <>
      <header className="flex h-20 items-center justify-end border-b border-slate-200 bg-white/50 px-4 sm:px-6 lg:px-12">
        <button
          onClick={() => {
            setTempKey(apiKey);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
        >
          <Key size={14} />
          {apiKey ? "Key set | Update" : "Connect my key"}
        </button>
      </header>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                API Key Settings
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-6">
              <label
                htmlFor="api-key-input"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Enter your API Key
              </label>
              <input
                id="api-key-input"
                type="password"
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-1 focus:ring-slate-300"
              />
              <p className="mt-2 text-xs text-slate-500">
                Your key is stored locally in your browser and never sent to our
                servers.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
