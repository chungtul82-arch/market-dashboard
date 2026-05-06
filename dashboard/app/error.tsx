'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[App Error]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 gap-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-red-400">오류 발생</h2>
      <div className="w-full bg-card border border-red-500/30 rounded-xl p-4 space-y-2">
        <p className="text-sm font-bold text-red-400">{error.name}: {error.message}</p>
        <pre className="text-xs text-muted-foreground overflow-auto whitespace-pre-wrap leading-relaxed">
          {error.stack}
        </pre>
      </div>
      <button
        onClick={reset}
        className="px-4 py-2 bg-[#6366f1] text-white rounded-lg text-sm"
      >
        다시 시도
      </button>
    </div>
  );
}
