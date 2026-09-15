import type { Metadata } from 'next';
import { connection } from 'next/server';
import './globals.css';
export const metadata: Metadata = {
  title: 'Pulso · Seguimiento comercial',
  description: 'CRM independiente para dar seguimiento a cada oportunidad.',
};
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
