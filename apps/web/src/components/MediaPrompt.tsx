import { useState, useEffect, useRef } from "react";

interface MediaPromptProps {
  reviewId: string;
  onDone: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || "";

export default function MediaPrompt({ reviewId, onDone }: MediaPromptProps) {
  const [mode, setMode] = useState<"prompt" | "text">("prompt");
  const [textContent, setTextContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = () => {
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    autoDismissRef.current = setTimeout(onDone, 3000);
  };

  useEffect(() => {
    if (mode === "prompt") resetTimer();
    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    };
  }, [mode]);

  const submitText = async () => {
    if (!textContent.trim()) return;
    setSubmitting(true);
    try {
      await fetch(`${API_URL}/api/v1/reviews/${reviewId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "text", content: textContent.trim() }),
      });
    } catch {
      // Silently continue to done
    }
    onDone();
  };

  if (mode === "text") {
    const remaining = 280 - textContent.length;
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-8 space-y-5">
        <h2 className="text-xl font-bold text-gray-900">Add a comment</h2>
        <div className="w-full relative">
          <textarea
            autoFocus
            value={textContent}
            onChange={(e) => setTextContent(e.target.value.slice(0, 280))}
            placeholder="What made it great?"
            rows={4}
            className="w-full p-4 border-2 border-gray-300 rounded-xl text-base resize-none focus:outline-none focus:border-primary-600 focus:ring-1 focus:ring-primary-600"
          />
          <span className={`absolute bottom-3 right-3 text-sm ${remaining <= 20 ? "text-red-500 font-medium" : "text-gray-400"}`}>
            {remaining}
          </span>
        </div>
        <div className="flex gap-3 w-full">
          <button
            onClick={() => setMode("prompt")}
            className="flex-1 py-3 text-gray-700 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
          <button
            onClick={submitText}
            disabled={!textContent.trim() || submitting}
            className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
          >
            {submitting ? "Adding..." : "Add"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center h-full px-6 py-8 space-y-6"
      onClick={resetTimer}
    >
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900">Review saved!</h2>
        <p className="text-base text-gray-500">Want to add more?</p>
      </div>

      <div className="flex gap-3 w-full max-w-xs">
        <button
          onClick={() => { if (autoDismissRef.current) clearTimeout(autoDismissRef.current); setMode("text"); }}
          aria-label="Add text review"
          className="flex-1 flex flex-col items-center gap-1 py-4 border-2 border-gray-200 rounded-xl hover:border-primary-400 hover:bg-primary-50 transition-all"
        >
          <span className="text-2xl">✏️</span>
          <span className="text-sm font-medium text-gray-700">Text</span>
        </button>
        <button
          aria-label="Add voice review"
          className="flex-1 flex flex-col items-center gap-1 py-4 border-2 border-gray-200 rounded-xl opacity-50 cursor-not-allowed"
          disabled
        >
          <span className="text-2xl">🎙️</span>
          <span className="text-sm font-medium text-gray-400">Voice</span>
        </button>
        <button
          aria-label="Add video review"
          className="flex-1 flex flex-col items-center gap-1 py-4 border-2 border-gray-200 rounded-xl opacity-50 cursor-not-allowed"
          disabled
        >
          <span className="text-2xl">📹</span>
          <span className="text-sm font-medium text-gray-400">Video</span>
        </button>
      </div>

      <button
        onClick={onDone}
        aria-label="Skip additional feedback"
        className="w-full max-w-xs py-3 text-gray-700 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
      >
        Done
      </button>
    </div>
  );
}
