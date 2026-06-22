import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import Usuarios from './Usuarios'
import Vagas from './Vagas'
import Candidatos from './Candidatos'
import Pipeline from './Pipeline'
import Agenda from './Agenda'
import Onboarding from './Onboarding'
import DashboardHome from './DashboardHome'
import EmpresasFiliais from './EmpresasFiliais'
import DocumentosConfiguracao from './DocumentosConfiguracao'
import BeneficiosConfiguracao from './BeneficiosConfiguracao'
import Contratos from './Contratos'
import Relatorios from './Relatorios'
import './Dashboard.css'

type PageId =
  | 'dashboard'
  | 'pipeline'
  | 'candidatos'
  | 'vagas'
  | 'agenda'
  | 'onboarding'
  | 'contratos'
  | 'relatorios'
  | 'usuarios'
  | 'empresas-filiais'
  | 'documentacao-config'
  | 'beneficios-config'

type UserRole = 'admin' | 'rh' | 'gestor' | 'consulta'

type UserProfile = {
  full_name: string
  role: UserRole
  active: boolean
}

type DashboardProps = {
  userId: string
  userEmail: string
  loading: boolean
  onLogout: () => Promise<void>
}

type MenuIconName =
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

type MenuItem = {
  id: PageId
  label: string
  icon: MenuIconName
}

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrador',
  rh: 'Recursos Humanos',
  gestor: 'Gestor',
  consulta: 'Consulta',
}

type SidebarIconName = MenuIconName | 'settings' | 'logout'

function SidebarIcon({ name }: { name: SidebarIconName }) {
  const commonProps = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
  }

  switch (name) {
    case 'dashboard':
      return (
        <svg {...commonProps} aria-hidden="true">
          <rect x="4" y="4" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
          <rect x="14" y="4" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
          <rect x="4" y="14" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
          <rect x="14" y="14" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
    case 'pipeline':
      return (
        <svg {...commonProps} aria-hidden="true">
          <path d="M5 7h10.5a3.5 3.5 0 0 1 0 7H9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 4 5 7l3 3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 20 19 17l-3-3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'candidates':
      return (
        <svg {...commonProps} aria-hidden="true">
          <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5.5 20a6.5 6.5 0 0 1 13 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'vacancies':
      return (
        <svg {...commonProps} aria-hidden="true">
          <path d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <rect x="4" y="7" width="16" height="12" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 12h16M10 12v1.5h4V12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...commonProps} aria-hidden="true">
          <rect x="4" y="5" width="16" height="15" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 3.5v3M16 3.5v3M4 9h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      )
    case 'onboarding':
      return (
        <svg {...commonProps} aria-hidden="true">
          <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="m8 12 2.4 2.4L16 9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'reports':
      return (
        <svg {...commonProps} aria-hidden="true">
          <path d="M5 20V5M19 20H5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <rect x="8" y="12" width="2.8" height="5" rx="1" stroke="currentColor" strokeWidth="1.6" />
          <rect x="13" y="8" width="2.8" height="9" rx="1" stroke="currentColor" strokeWidth="1.6" />
          <rect x="18" y="10" width="2.8" height="7" rx="1" transform="translate(-3 0)" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      )
    case 'contracts':
      return (
        <svg {...commonProps} aria-hidden="true">
          <path d="M7 3.8h7l3 3V20H7a2 2 0 0 1-2-2V5.8a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M14 4v3h3M8.5 11h7M8.5 14.5h7M8.5 18h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      )
    case 'users':
      return (
        <svg {...commonProps} aria-hidden="true">
          <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3.8 19a5.2 5.2 0 0 1 10.4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M16 10.5a2.5 2.5 0 0 0 0-5M17.5 18a4.2 4.2 0 0 0-2.3-3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'companies':
      return (
        <svg {...commonProps} aria-hidden="true">
          <rect x="4.5" y="5" width="8" height="15" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12.5 9h7v11h-7M7.5 8h2M7.5 12h2M7.5 16h2M15.5 12h1.8M15.5 16h1.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      )
    case 'documents':
      return (
        <svg {...commonProps} aria-hidden="true">
          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H10l2 2h5.5A2.5 2.5 0 0 1 20 9.5V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M8 12h8M8 15h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...commonProps} aria-hidden="true">
          <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M18.3 13.2c.08-.4.12-.8.12-1.2s-.04-.8-.12-1.2l2-1.5-2-3.4-2.4 1a7 7 0 0 0-2.1-1.2L13.5 3h-4l-.4 2.7A7 7 0 0 0 7 6.9l-2.4-1-2 3.4 2 1.5A6.5 6.5 0 0 0 4.5 12c0 .4.04.8.12 1.2l-2 1.5 2 3.4 2.4-1c.64.5 1.34.9 2.1 1.2l.4 2.7h4l.4-2.7c.76-.3 1.46-.7 2.1-1.2l2.4 1 2-3.4-2.12-1.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      )
    case 'logout':
      return (
        <svg {...commonProps} aria-hidden="true">
          <path d="M10 5H6.8A1.8 1.8 0 0 0 5 6.8v10.4A1.8 1.8 0 0 0 6.8 19H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M14 8l4 4-4 4M18 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
  }
}

const mainMenuItems: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    icon: 'pipeline',
  },
  {
    id: 'candidatos',
    label: 'Candidatos',
    icon: 'candidates',
  },
  {
    id: 'vagas',
    label: 'Vagas',
    icon: 'vacancies',
  },
  {
    id: 'agenda',
    label: 'Agenda',
    icon: 'calendar',
  },
  {
    id: 'onboarding',
    label: 'Onboarding',
    icon: 'onboarding',
  },
]

const reportsMenuItem: MenuItem = {
  id: 'relatorios',
  label: 'Relatórios',
  icon: 'reports',
}

const contractsMenuItem: MenuItem = {
  id: 'contratos',
  label: 'Contratos',
  icon: 'contracts',
}

const settingsMenuItems: MenuItem[] = [
  {
    id: 'usuarios',
    label: 'Usuários',
    icon: 'users',
  },
  {
    id: 'empresas-filiais',
    label: 'Empresas e filiais',
    icon: 'companies',
  },
  {
    id: 'documentacao-config',
    label: 'Documentação',
    icon: 'documents',
  },
  {
    id: 'beneficios-config',
    label: 'Benefícios',
    icon: 'documents',
  },
]

function formatUserName(email: string) {
  const name = email.split('@')[0]

  return name
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function Dashboard({
  userId,
  userEmail,
  loading,
  onLogout,
}: DashboardProps) {
  const [activePage, setActivePage] = useState<PageId>('dashboard')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileError, setProfileError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    let componentMounted = true

    async function loadProfile() {
      setProfileError('')

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, role, active')
        .eq('id', userId)
        .single()

      if (!componentMounted) {
        return
      }

      if (error) {
        console.error('Erro ao buscar perfil:', error.message)
        setProfileError(
          'Não foi possível carregar seu perfil de usuário.',
        )
        return
      }

      if (!data.active) {
        setProfileError(
          'Este usuário está inativo. Entre em contato com o administrador.',
        )
        return
      }

      setProfile(data as UserProfile)
    }

    loadProfile()

    return () => {
      componentMounted = false
    }
  }, [userId])

  const canManageHrSettings =
    profile?.role === 'admin' || profile?.role === 'rh'

  const canManageUsers = profile?.role === 'admin'

  const visibleMainItems = useMemo(() => {
    if (!canManageHrSettings) {
      return mainMenuItems
    }

    return [...mainMenuItems, reportsMenuItem, contractsMenuItem]
  }, [canManageHrSettings])

  const visibleSettingsItems = useMemo(
    () =>
      settingsMenuItems.filter((item) => {
        if (item.id === 'usuarios') {
          return canManageUsers
        }

        return canManageHrSettings
      }),
    [canManageHrSettings, canManageUsers],
  )

  const allVisibleItems = useMemo(
    () => [...visibleMainItems, ...visibleSettingsItems],
    [visibleMainItems, visibleSettingsItems],
  )

  const activeMenuItem = allVisibleItems.find(
    (item) => item.id === activePage,
  )

  const userName = profile?.full_name || formatUserName(userEmail)

  const roleName = profile
    ? roleLabels[profile.role]
    : 'Carregando...'

  const isSettingsPage = visibleSettingsItems.some(
    (item) => item.id === activePage,
  )

  useEffect(() => {
    if (isSettingsPage) {
      setSettingsOpen(true)
    }
  }, [isSettingsPage])

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
      }
    }

    window.addEventListener('keydown', closeOnEscape)

    return () => {
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  function navigate(page: PageId) {
    setActivePage(page)
    setMobileMenuOpen(false)
  }

  if (!profile && !profileError) {
    return (
      <section className="profile-state">
        <div className="profile-state-logo">RH</div>
        <strong>Carregando perfil...</strong>
      </section>
    )
  }

  if (profileError) {
    return (
      <section className="profile-state">
        <div className="profile-state-logo">RH</div>
        <span>Acesso não autorizado</span>
        <h1>Não foi possível acessar o sistema</h1>
        <p>{profileError}</p>
        <button type="button" onClick={onLogout} disabled={loading}>
          {loading ? 'Saindo...' : 'Voltar para o login'}
        </button>
      </section>
    )
  }

  return (
    <div
      className={
        mobileMenuOpen
          ? 'system-layout menu-open'
          : 'system-layout'
      }
    >
      <button
        className="mobile-menu-overlay"
        type="button"
        aria-label="Fechar menu"
        onClick={() => setMobileMenuOpen(false)}
      />

      <aside
        className={
          mobileMenuOpen
            ? 'system-sidebar mobile-open'
            : 'system-sidebar'
        }
      >
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">RH</div>

          <div>
            <strong>Interlaser</strong>
            <span>Gestão de pessoas</span>
          </div>

          <button
            className="sidebar-mobile-close"
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMobileMenuOpen(false)}
          >
            ×
          </button>
        </div>

        <nav className="sidebar-navigation">
          <span className="sidebar-section-label">
            Menu principal
          </span>

          <div className="sidebar-main-menu">
            {visibleMainItems.map((item) => (
              <button
                className={
                  activePage === item.id
                    ? 'sidebar-menu-item active'
                    : 'sidebar-menu-item'
                }
                type="button"
                key={item.id}
                onClick={() => navigate(item.id)}
                aria-pressed={activePage === item.id}
              >
                <span className="menu-icon" aria-hidden="true">
                  <SidebarIcon name={item.icon} />
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {visibleSettingsItems.length > 0 && (
            <div className="sidebar-settings-group">
              <button
                className={
                  isSettingsPage
                    ? 'sidebar-menu-item settings-parent active'
                    : 'sidebar-menu-item settings-parent'
                }
                type="button"
                onClick={() =>
                  setSettingsOpen((current) => !current)
                }
                aria-expanded={settingsOpen}
              >
                <span className="menu-icon" aria-hidden="true">
                  <SidebarIcon name="settings" />
                </span>

                <span>Configurações</span>

                <span
                  className={
                    settingsOpen
                      ? 'settings-chevron open'
                      : 'settings-chevron'
                  }
                  aria-hidden="true"
                >
                  ›
                </span>
              </button>

              <div
                className={
                  settingsOpen
                    ? 'sidebar-submenu open'
                    : 'sidebar-submenu'
                }
              >
                {visibleSettingsItems.map((item) => (
                  <button
                    className={
                      activePage === item.id
                        ? 'sidebar-submenu-item active'
                        : 'sidebar-submenu-item'
                    }
                    type="button"
                    key={item.id}
                    onClick={() => navigate(item.id)}
                    aria-pressed={activePage === item.id}
                  >
                    <span className="submenu-line" />
                    <span className="menu-icon" aria-hidden="true">
                      <SidebarIcon name={item.icon} />
                    </span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            {userName.charAt(0).toUpperCase()}
          </div>

          <div className="sidebar-user-data">
            <strong>{userName}</strong>
            <span>{userEmail}</span>
          </div>

          <button
            className="sidebar-logout"
            type="button"
            onClick={onLogout}
            disabled={loading}
            aria-label="Sair do sistema"
            title="Sair do sistema"
          >
            <SidebarIcon name="logout" />
          </button>
        </div>
      </aside>

      <main className="system-main">
        <header className="system-header">
          <button
            className="mobile-menu-button"
            type="button"
            aria-label="Abrir menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>

          <div className="system-header-title">
            <span className="header-eyebrow">
              Sistema de Recursos Humanos
            </span>
            <h1>{activeMenuItem?.label ?? 'Dashboard'}</h1>
          </div>

          <div className="header-actions">
            <div className="header-user">
              <div className="header-user-avatar">
                {userName.charAt(0).toUpperCase()}
              </div>

              <div>
                <strong>{userName}</strong>
                <span>{roleName}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="system-content">
          {activePage === 'dashboard' && (
            <DashboardHome
              userName={userName}
              onNavigate={(page) =>
                setActivePage(page as PageId)
              }
            />
          )}

          {activePage === 'pipeline' && <Pipeline />}

          {activePage === 'candidatos' && <Candidatos />}

          {activePage === 'vagas' && (
            <Vagas responsavelRhEmail={userEmail} />
          )}

          {activePage === 'agenda' && <Agenda />}

          {activePage === 'onboarding' && <Onboarding />}

          {activePage === 'relatorios' &&
            canManageHrSettings && <Relatorios />}

          {activePage === 'contratos' &&
            canManageHrSettings && <Contratos />}

          {activePage === 'usuarios' && canManageUsers && (
            <Usuarios currentUserId={userId} />
          )}

          {activePage === 'empresas-filiais' &&
            canManageHrSettings && <EmpresasFiliais />}

          {activePage === 'documentacao-config' &&
            canManageHrSettings && (
              <DocumentosConfiguracao />
            )}

          {activePage === 'beneficios-config' &&
            canManageHrSettings && (
              <BeneficiosConfiguracao />
            )}
        </div>
      </main>
    </div>
  )
}

export default Dashboard