import { useState } from "react";

interface QualityChipProps {
  name: string;
  icon: string;
  selected: boolean;
  onToggle: () => boolean; // returns false if max reached (shake hint)
}

export default function QualityChip({ name, icon, selected, onToggle }: QualityChipProps) {
  const [shaking, setShaking] = useState(false);

  const handleTap = () => {
    const accepted = onToggle();
    if (!accepted) {
      setShaking(true);
      setTimeout(() => setShaking(false), 300);
    } else if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  return (
    <button
      role="checkbox"
      aria-checked={selected}
      aria-label={`${name} quality`}
      onClick={handleTap}
      className={`
        flex items-center justify-center gap-2 px-4 py-3
        rounded-full border-2 text-base font-medium
        transition-all duration-100 ease-out
        min-w-[100px] min-h-[44px] select-none
        ${selected
          ? "border-primary-600 bg-primary-600 text-white scale-105 shadow-md animate-pop-in"
          : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
        }
        ${shaking ? "animate-shake" : ""}
      `}
    >
      <span className="text-lg" aria-hidden="true">{icon}</span>
      <span>{name}</span>
    </button>
  );
}
