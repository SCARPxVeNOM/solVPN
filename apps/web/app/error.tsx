"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-6xl font-bold text-red-500">Error</h1>
        <p className="text-xl text-slate-300">Something went wrong!</p>
        <p className="text-sm text-slate-500">{error.message}</p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all"
        >
          Try again
        </button>
        <div className="mt-4">
          <a href="/" className="text-blue-400 hover:text-blue-300 underline">
            Go back home
          </a>
        </div>
      </div>
    </div>
  );
}

