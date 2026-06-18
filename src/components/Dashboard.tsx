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

const menuIcons: Record<MenuIconName, string> = {
  dashboard: '▦',
  pipeline: '⇄',
  candidates: '○',
  vacancies: '▣',
  calendar: '▤',
  onboarding: '☑',
  reports: '▥',
  contracts: '▧',
  users: '◉',
  companies: '▨',
  documents: '◫',
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
                  {menuIcons[item.icon]}
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
                  ⚙
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
                      {menuIcons[item.icon]}
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
            ↪
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

          {activePage === 'vagas' && <Vagas />}

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
        </div>
      </main>
    </div>
  )
}

export default Dashboard