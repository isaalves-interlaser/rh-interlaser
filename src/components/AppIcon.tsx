import type { ReactElement } from 'react'

type IconProps = {
  name: AppIconName
  width?: number
  height?: number
  className?: string
}

export type AppIconName =
  | 'dashboard'
  | 'pipeline'
  | 'candidates'
  | 'vacancies'
  | 'calendar'
  | 'onboarding'
  | 'reports'
  | 'contracts'
  | 'users'
  | 'companies'
  | 'documents'
  | 'settings'
  | 'chevron'
  | 'logout'

const iconPaths: Record<AppIconName, ReactElement> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),

  pipeline: (
    <>
      <path d="M4 6h6" />
      <path d="M14 6h6" />
      <path d="M10 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0" />
      <path d="M4 18h6" />
      <path d="M14 18h6" />
      <path d="M10 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0" />
      <path d="M12 8v8" />
    </>
  ),

  candidates: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.6-4.2 4.3-6 8-6s6.4 1.8 8 6" />
    </>
  ),

  vacancies: (
    <>
      <rect x="4" y="7" width="16" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M4 12h16" />
    </>
  ),

  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4" />
      <path d="M8 3v4" />
      <path d="M3 10h18" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
    </>
  ),

  onboarding: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 12l3 3l5-6" />
    </>
  ),

  reports: (
    <>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <rect x="7" y="11" width="3" height="5" rx="1" />
      <rect x="12" y="8" width="3" height="8" rx="1" />
      <rect x="17" y="5" width="3" height="11" rx="1" />
    </>
  ),

  contracts: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5" />
      <path d="M10 13h6" />
      <path d="M10 17h6" />
      <path d="M10 9h2" />
    </>
  ),

  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c1.1-3.5 3.2-5 6-5s4.9 1.5 6 5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15 15c2.5.2 4.4 1.7 5.5 5" />
    </>
  ),

  companies: (
    <>
      <rect x="4" y="4" width="16" height="17" rx="2" />
      <path d="M8 8h2" />
      <path d="M14 8h2" />
      <path d="M8 12h2" />
      <path d="M14 12h2" />
      <path d="M9 21v-5h6v5" />
    </>
  ),

  documents: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5" />
      <path d="M10 12h6" />
      <path d="M10 16h6" />
    </>
  ),

  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.8 1.8 0 0 0 .36 2l.05.05a2 2 0 0 1-2.83 2.83l-.05-.05a1.8 1.8 0 0 0-2-.36a1.8 1.8 0 0 0-1 1.63V21a2 2 0 0 1-4 0v-.07a1.8 1.8 0 0 0-1-1.63a1.8 1.8 0 0 0-2 .36l-.05.05a2 2 0 0 1-2.83-2.83l.05-.05a1.8 1.8 0 0 0 .36-2a1.8 1.8 0 0 0-1.63-1H3a2 2 0 0 1 0-4h.07a1.8 1.8 0 0 0 1.63-1a1.8 1.8 0 0 0-.36-2l-.05-.05a2 2 0 0 1 2.83-2.83l.05.05a1.8 1.8 0 0 0 2 .36h.01a1.8 1.8 0 0 0 1-1.63V3a2 2 0 0 1 4 0v.07a1.8 1.8 0 0 0 1 1.63a1.8 1.8 0 0 0 2-.36l.05-.05a2 2 0 0 1 2.83 2.83l-.05.05a1.8 1.8 0 0 0-.36 2v.01a1.8 1.8 0 0 0 1.63 1H21a2 2 0 0 1 0 4h-.07a1.8 1.8 0 0 0-1.53 1Z" />
    </>
  ),

  chevron: <path d="M9 6l6 6l-6 6" />,

  logout: (
    <>
      <path d="M10 17l5-5l-5-5" />
      <path d="M15 12H3" />
      <path d="M21 3v18" />
    </>
  ),
}

function AppIcon({
  name,
  width = 20,
  height = 20,
  className,
}: IconProps) {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  )
}

export default AppIcon