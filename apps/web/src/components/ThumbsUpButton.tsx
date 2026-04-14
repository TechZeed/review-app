interface ThumbsUpButtonProps {
  disabled: boolean;
  loading: boolean;
  submitted: boolean;
  onClick: () => void;
}

export default function ThumbsUpButton({ disabled, loading, submitted, onClick }: ThumbsUpButtonProps) {
  if (submitted) {
    return (
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-500 text-white animate-check-morph mx-auto">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }

  return (
    <button
      aria-label="Submit review"
      aria-disabled={disabled}
      disabled={disabled || loading}
      onClick={() => {
        if (navigator.vibrate) navigator.vibrate(30);
        onClick();
      }}
      className={`
        flex items-center justify-center gap-2
        w-full max-w-[240px] h-14 mx-auto
        rounded-full text-lg font-semibold
        transition-all duration-150
        ${disabled
          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
          : "bg-primary-600 text-white hover:bg-primary-700 active:scale-95 shadow-lg"
        }
      `}
    >
      {loading ? (
        <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <>
          <span className="text-2xl">👍</span>
          <span>Submit</span>
        </>
      )}
    </button>
  );
}
