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