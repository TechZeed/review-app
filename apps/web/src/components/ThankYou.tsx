interface ThankYouProps {
  name: string;
}

export default function ThankYou({ name }: ThankYouProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8 space-y-6 text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
        <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Thank you!</h1>
        <p className="text-base text-gray-500">
          Your review for <span className="font-semibold text-gray-800">{name}</span> has been submitted.
        </p>
      </div>
      <p className="text-sm text-gray-400">You can close this page.</p>
    </div>
  );
}
