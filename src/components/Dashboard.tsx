import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './Dashboard.css'

type PageId =
  | 'dashboard'
  | 'candidatos'
  | 'vagas'
  | 'agenda'
  | 'onboarding'
  | 'configuracoes'

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

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrador',
  rh: 'Recursos Humanos',
  gestor: 'Gestor',
  consulta: 'Consulta',
}

const menuItems: Array<{
  id: PageId
  label: string
  icon: string
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦' },
  { id: 'candidatos', label: 'Candidatos', icon: '♙' },
  { id: 'vagas', label: 'Vagas', icon: '▣' },
  { id: 'agenda', label: 'Agenda', icon: '□' },
  { id: 'onboarding', label: 'Onboarding', icon: '✓' },
  { id: 'configuracoes', label: 'Configurações', icon: '⚙' },
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
  const [activePage, setActivePage] =
    useState<PageId>('dashboard')

  const [profile, setProfile] =
    useState<UserProfile | null>(null)

  const [profileError, setProfileError] = useState('')

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

  const activeMenuItem = menuItems.find(
    (item) => item.id === activePage,
  )

  const userName =
    profile?.full_name || formatUserName(userEmail)

  const roleName = profile
    ? roleLabels[profile.role]
    : 'Carregando...'

  if (!profile && !profileError) {
    return (
      <main className="loading-page">
        <div className="loading-box">
          <div className="loading-logo">RH</div>
          <p>Carregando perfil...</p>
        </div>
      </main>
    )
  }

  if (profileError) {
    return (
      <main className="authenticated-page">
        <section className="authenticated-card">
          <div className="authenticated-logo">RH</div>

          <span className="login-label">
            Acesso não autorizado
          </span>

          <h1>Não foi possível acessar o sistema</h1>

          <p>{profileError}</p>

          <button
            className="logout-button"
            type="button"
            onClick={onLogout}
            disabled={loading}
          >
            {loading ? 'Saindo...' : 'Voltar para o login'}
          </button>
        </section>
      </main>
    )
  }

  return (
    <div className="system-layout">
      <aside className="system-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">RH</div>

          <div>
            <strong>Interlaser</strong>
            <span>Gestão de pessoas</span>
          </div>
        </div>

        <nav className="sidebar-navigation">
          <span className="sidebar-section-label">
            Menu principal
          </span>

          {menuItems.map((item) => (
            <button
              key={item.id}
              className={
                activePage === item.id
                  ? 'sidebar-menu-item active'
                  : 'sidebar-menu-item'
              }
              type="button"
              onClick={() => setActivePage(item.id)}
              aria-pressed={activePage === item.id}
            >
              <span className="menu-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
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
            title="Sair do sistema"
            aria-label="Sair do sistema"
          >
            ↪
          </button>
        </div>
      </aside>

      <main className="system-main">
        <header className="system-header">
          <div>
            <span className="header-eyebrow">
              Sistema de Recursos Humanos
            </span>

            <h1>{activeMenuItem?.label}</h1>
          </div>

          <div className="header-actions">
            <button
              className="notification-button"
              type="button"
              aria-label="Notificações"
            >
              ♢
              <span className="notification-dot" />
            </button>

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
          {activePage === 'dashboard' ? (
            <DashboardHome userName={userName} />
          ) : (
            <ModulePlaceholder
              title={activeMenuItem?.label ?? ''}
            />
          )}
        </div>
      </main>
    </div>
  )
}

function DashboardHome({
  userName,
}: {
  userName: string
}) {
  const currentDate = new Date()

  const month = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
  }).format(currentDate)

  const formattedMonth =
    month.charAt(0).toUpperCase() + month.slice(1)

  const year = currentDate.getFullYear()

  return (
    <>
      <section className="welcome-banner">
        <div>
          <span>Visão geral</span>

          <h2>Olá, {userName}</h2>

          <p>
            Acompanhe os principais dados do processo de
            recrutamento e integração.
          </p>
        </div>

        <div className="welcome-date">
          <strong>{formattedMonth}</strong>
          <span>{year}</span>
        </div>
      </section>

      <section className="statistics-grid">
        <article className="statistic-card">
          <div className="statistic-card-header">
            <span>Candidatos ativos</span>
            <div className="statistic-icon">♙</div>
          </div>

          <strong>0</strong>
          <small>Nenhum candidato cadastrado</small>
        </article>

        <article className="statistic-card">
          <div className="statistic-card-header">
            <span>Vagas abertas</span>
            <div className="statistic-icon">▣</div>
          </div>

          <strong>0</strong>
          <small>Nenhuma vaga cadastrada</small>
        </article>

        <article className="statistic-card">
          <div className="statistic-card-header">
            <span>Entrevistas</span>
            <div className="statistic-icon">□</div>
          </div>

          <strong>0</strong>
          <small>Nenhuma entrevista agendada</small>
        </article>

        <article className="statistic-card">
          <div className="statistic-card-header">
            <span>Em onboarding</span>
            <div className="statistic-icon">✓</div>
          </div>

          <strong>0</strong>
          <small>Nenhum onboarding iniciado</small>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h3>Processos recentes</h3>
              <p>Últimas movimentações realizadas</p>
            </div>

            <button type="button">Ver todos</button>
          </div>

          <div className="empty-state">
            <div className="empty-state-icon">▦</div>

            <strong>Nenhuma movimentação</strong>

            <p>
              As movimentações de candidatos aparecerão aqui.
            </p>
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h3>Próximas atividades</h3>
              <p>Entrevistas e tarefas pendentes</p>
            </div>
          </div>

          <div className="empty-state">
            <div className="empty-state-icon">□</div>

            <strong>Nenhuma atividade</strong>

            <p>
              As próximas atividades aparecerão aqui.
            </p>
          </div>
        </article>
      </section>
    </>
  )
}

function ModulePlaceholder({
  title,
}: {
  title: string
}) {
  return (
    <section className="module-placeholder">
      <div className="module-placeholder-icon">RH</div>

      <h2>Módulo de {title}</h2>

      <p>
        A estrutura principal está pronta. Este será o próximo
        módulo conectado ao banco de dados.
      </p>
    </section>
  )
}

export default Dashboard
