import type { ReactNode } from 'react';

const drawings = {
  agenda: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4m10-4v4M3 10h18m-14 5 3 3 6-6" />
    </>
  ),
  leads: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <circle cx="12" cy="9" r="2.5" />
      <path d="M8 17v-1a4 4 0 0 1 8 0v1M2 7h3m-3 5h3m-3 5h3" />
    </>
  ),
  equipo: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3" />
    </>
  ),
  plantillas: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  automatizaciones: (
    <>
      <rect x="9" y="3" width="6" height="5" rx="1" />
      <rect x="2" y="16" width="6" height="5" rx="1" />
      <rect x="16" y="16" width="6" height="5" rx="1" />
      <path d="M12 8v4m-7 4v-4h14v4" />
    </>
  ),
  canales: (
    <>
      <path d="M14 14H7l-4 4V4h14v6" />
      <path d="M10 17v3h7l4 3V10h-3M7 8h6" />
    </>
  ),
  configuracion: (
    <>
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="3" fill="var(--icon-surface, white)" />
      <circle cx="15" cy="17" r="3" fill="var(--icon-surface, white)" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type NavigationIconName = keyof typeof drawings;

export function NavigationIcon({ name }: { name: NavigationIconName }) {
  return (
    <svg
      className="navigation-icon"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {drawings[name]}
    </svg>
  );
}
