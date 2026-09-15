import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="loading-panel">
      <h1>Página no encontrada</h1>
      <Link href="/agenda">Volver al CRM</Link>
    </div>
  );
}
