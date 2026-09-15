'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="loading-panel">
      <h1>No se pudo abrir el espacio</h1>
      <p>Inténtalo nuevamente. Tus datos guardados se conservan.</p>
      <button onClick={reset}>Reintentar</button>
    </div>
  );
}
