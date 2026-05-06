'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ background: '#0f172a', color: '#f8fafc', fontFamily: 'monospace', padding: '2rem' }}>
        <h2 style={{ color: '#f87171' }}>Global Error: {error.name}</h2>
        <p style={{ color: '#fca5a5' }}>{error.message}</p>
        <pre style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'pre-wrap' }}>
          {error.stack}
        </pre>
        <button onClick={reset} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
          다시 시도
        </button>
      </body>
    </html>
  );
}
