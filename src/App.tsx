import {
  useEffect,
  useState,
  type FormEvent,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Dashboard from './components/Dashboard'
import EnvioDocumentos from './components/EnvioDocumentos'
import PortalVagas from './components/PortalVagas'
import './App.css'

type AuthView = 'login' | 'forgot-password' | 'update-password'

function hasRecoveryUrl() {
  return (
    window.location.search.includes('recovery=1') ||
    window.location.hash.includes('type=recovery')
  )
}

function isPortalVagasRoute(pathname: string) {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/'

  return (
    normalizedPath === '/vagas' ||
    normalizedPath.startsWith('/vagas/') ||
    normalizedPath.startsWith('/candidatar/') ||
    normalizedPath === '/candidatura-espontanea'
  )
}

function App() {
  const documentToken = new URLSearchParams(
    window.location.search,
  ).get('documentos')

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [mensagemTipo, setMensagemTipo] =
    useState<'info' | 'success' | 'error'>('info')
  const [carregando, setCarregando] = useState(false)
  const [verificandoSessao, setVerificandoSessao] =
    useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [authView, setAuthView] = useState<AuthView>(
    hasRecoveryUrl() ? 'update-password' : 'login',
  )

  useEffect(() => {
    let mounted = true

    async function carregarSessao() {
      const { data, error } = await supabase.auth.getSession()

      if (!mounted) {
        return
      }

      if (error) {
        console.error(
          'Erro ao recuperar sessão:',
          error.message,
        )
      }

      setSession(data.session)
      setVerificandoSessao(false)
    }

    carregarSessao()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, novaSessao) => {
        if (!mounted) {
          return
        }

        if (event === 'PASSWORD_RECOVERY') {
          setAuthView('update-password')
          setMensagem(
            'Link confirmado. Agora crie uma nova senha.',
          )
          setMensagemTipo('info')
        }

        if (event === 'SIGNED_OUT') {
          setAuthView('login')
        }

        setSession(novaSessao)
        setVerificandoSessao(false)
      },
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  function limparMensagem() {
    setMensagem('')
    setMensagemTipo('info')
  }

  function voltarParaLogin() {
    setAuthView('login')
    setSenha('')
    setNovaSenha('')
    setConfirmarSenha('')
    limparMensagem()

    window.history.replaceState(
      {},
      document.title,
      window.location.pathname,
    )
  }

  async function handleLogin(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    limparMensagem()

    const emailNormalizado = email.trim().toLowerCase()

    if (!emailNormalizado || !senha.trim()) {
      setMensagem('Preencha o e-mail e a senha.')
      setMensagemTipo('error')
      return
    }

    setCarregando(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: emailNormalizado,
      password: senha,
    })

    setCarregando(false)

    if (error) {
      console.error('Erro no login:', error.message)
      setMensagem(
        'Não foi possível entrar. Confira o e-mail e a senha.',
      )
      setMensagemTipo('error')
      return
    }

    setSenha('')
  }

  async function handleForgotPassword(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    limparMensagem()

    const emailNormalizado = email.trim().toLowerCase()

    if (!emailNormalizado) {
      setMensagem('Informe o e-mail usado no sistema.')
      setMensagemTipo('error')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado)) {
      setMensagem('Informe um endereço de e-mail válido.')
      setMensagemTipo('error')
      return
    }

    setCarregando(true)

    const redirectTo = `${window.location.origin}/?recovery=1`

    const { error } =
      await supabase.auth.resetPasswordForEmail(
        emailNormalizado,
        { redirectTo },
      )

    setCarregando(false)

    if (error) {
      console.error(
        'Erro ao solicitar recuperação de senha:',
        error.message,
      )

      setMensagem(
        'Não foi possível enviar o link agora. Aguarde alguns minutos e tente novamente.',
      )
      setMensagemTipo('error')
      return
    }

    setMensagem(
      'Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha. Verifique também a caixa de spam.',
    )
    setMensagemTipo('success')
  }

  async function handleUpdatePassword(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    limparMensagem()

    if (novaSenha.length < 8) {
      setMensagem(
        'A nova senha deve possuir pelo menos 8 caracteres.',
      )
      setMensagemTipo('error')
      return
    }

    if (novaSenha !== confirmarSenha) {
      setMensagem('As senhas informadas não são iguais.')
      setMensagemTipo('error')
      return
    }

    setCarregando(true)

    const { error } = await supabase.auth.updateUser({
      password: novaSenha,
    })

    if (error) {
      console.error(
        'Erro ao atualizar a senha:',
        error.message,
      )
      setCarregando(false)
      setMensagem(
        'Não foi possível atualizar a senha. Solicite um novo link e tente novamente.',
      )
      setMensagemTipo('error')
      return
    }

    const { error: signOutError } =
      await supabase.auth.signOut()

    if (signOutError) {
      console.error(
        'Senha alterada, mas houve erro ao encerrar a sessão:',
        signOutError.message,
      )
    }

    setSession(null)
    setNovaSenha('')
    setConfirmarSenha('')
    setAuthView('login')
    setCarregando(false)

    window.history.replaceState(
      {},
      document.title,
      window.location.pathname,
    )

    setMensagem(
      'Senha atualizada com sucesso. Entre novamente usando a nova senha.',
    )
    setMensagemTipo('success')
  }

  async function handleLogout() {
    setCarregando(true)

    const { error } = await supabase.auth.signOut()

    setCarregando(false)

    if (error) {
      setMensagem('Não foi possível encerrar a sessão.')
      setMensagemTipo('error')
    }
  }

  if (documentToken) {
    return <EnvioDocumentos token={documentToken} />
  }

  if (isPortalVagasRoute(window.location.pathname)) {
    return <PortalVagas />
  }

  if (verificandoSessao) {
    return (
      <div className="app-loading">
        <div className="app-loading-logo">RH</div>
        <strong>Carregando sistema</strong>
        <span>Aguarde um instante...</span>
      </div>
    )
  }

  if (authView === 'update-password') {
    return (
      <AuthLayout>
        <section className="login-card">
          <div className="mobile-logo">RH</div>

          <header className="login-header">
            <span className="login-label">Segurança</span>
            <h2>Criar nova senha</h2>
            <p>
              Escolha uma senha nova para voltar a acessar o
              sistema de RH.
            </p>
          </header>

          <form onSubmit={handleUpdatePassword}>
            <div className="form-group">
              <label htmlFor="new-password">Nova senha</label>

              <div className="password-field">
                <input
                  id="new-password"
                  type={
                    mostrarNovaSenha ? 'text' : 'password'
                  }
                  value={novaSenha}
                  onChange={(event) => {
                    setNovaSenha(event.target.value)
                    limparMensagem()
                  }}
                  minLength={8}
                  autoComplete="new-password"
                  disabled={carregando}
                  autoFocus
                />

                <button
                  className="show-password"
                  type="button"
                  onClick={() =>
                    setMostrarNovaSenha(
                      (current) => !current,
                    )
                  }
                  disabled={carregando}
                >
                  {mostrarNovaSenha ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>

              <small className="field-help">
                Use pelo menos 8 caracteres.
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="confirm-password">
                Confirmar nova senha
              </label>

              <input
                id="confirm-password"
                type={
                  mostrarNovaSenha ? 'text' : 'password'
                }
                value={confirmarSenha}
                onChange={(event) => {
                  setConfirmarSenha(event.target.value)
                  limparMensagem()
                }}
                minLength={8}
                autoComplete="new-password"
                disabled={carregando}
              />
            </div>

            {mensagem && (
              <div
                className={`form-message ${mensagemTipo}`}
                role="alert"
              >
                {mensagem}
              </div>
            )}

            <button
              className="login-button"
              type="submit"
              disabled={carregando}
            >
              {carregando
                ? 'Atualizando senha...'
                : 'Salvar nova senha'}
            </button>
          </form>

          <button
            className="back-to-login"
            type="button"
            onClick={voltarParaLogin}
            disabled={carregando}
          >
            Voltar para o login
          </button>
        </section>
      </AuthLayout>
    )
  }

  if (session) {
    return (
      <Dashboard
        userId={session.user.id}
        userEmail={session.user.email ?? ''}
        loading={carregando}
        onLogout={handleLogout}
      />
    )
  }

  if (authView === 'forgot-password') {
    return (
      <AuthLayout>
        <section className="login-card">
          <div className="mobile-logo">RH</div>

          <header className="login-header">
            <span className="login-label">
              Recuperação de acesso
            </span>
            <h2>Esqueci minha senha</h2>
            <p>
              Informe o e-mail cadastrado. Enviaremos um link
              para você criar uma nova senha.
            </p>
          </header>

          <form onSubmit={handleForgotPassword}>
            <div className="form-group">
              <label htmlFor="recovery-email">E-mail</label>

              <input
                id="recovery-email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  limparMensagem()
                }}
                placeholder="nome@interlaser.com.br"
                autoComplete="email"
                disabled={carregando}
                autoFocus
              />
            </div>

            {mensagem && (
              <div
                className={`form-message ${mensagemTipo}`}
                role="alert"
              >
                {mensagem}
              </div>
            )}

            <button
              className="login-button"
              type="submit"
              disabled={carregando}
            >
              {carregando
                ? 'Enviando link...'
                : 'Enviar link de recuperação'}
            </button>
          </form>

          <button
            className="back-to-login"
            type="button"
            onClick={voltarParaLogin}
            disabled={carregando}
          >
            Voltar para o login
          </button>

          <p className="login-support">
            O link possui validade limitada. Caso não receba,
            confira a caixa de spam.
          </p>
        </section>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <section className="login-card">
        <div className="mobile-logo">RH</div>

        <header className="login-header">
          <span className="login-label">Acesso seguro</span>
          <h2>Entrar no RH</h2>
          <p>
            Use seu e-mail e senha para acessar a gestão de
            vagas, candidaturas e entrevistas.
          </p>
        </header>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">E-mail</label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                limparMensagem()
              }}
              placeholder="nome@interlaser.com.br"
              autoComplete="email"
              disabled={carregando}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Senha</label>

            <div className="password-field">
              <input
                id="password"
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                onChange={(event) => {
                  setSenha(event.target.value)
                  limparMensagem()
                }}
                autoComplete="current-password"
                disabled={carregando}
              />

              <button
                className="show-password"
                type="button"
                onClick={() =>
                  setMostrarSenha((current) => !current)
                }
                aria-label={
                  mostrarSenha
                    ? 'Ocultar senha'
                    : 'Mostrar senha'
                }
                disabled={carregando}
              >
                {mostrarSenha ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          <div className="form-options">
            <span className="secure-access-note">
              Acesso restrito a usuários autorizados
            </span>

            <button
              className="forgot-password"
              type="button"
              onClick={() => {
                setAuthView('forgot-password')
                setSenha('')
                limparMensagem()
              }}
              disabled={carregando}
            >
              Esqueci minha senha
            </button>
          </div>

          {mensagem && (
            <div
              className={`form-message ${mensagemTipo}`}
              role="alert"
            >
              {mensagem}
            </div>
          )}

          <button
            className="login-button"
            type="submit"
            disabled={carregando}
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <a className="public-jobs-link" href="/vagas">
          Ver vagas abertas
        </a>

        <p className="login-support">
          Problemas para acessar? Entre em contato com o
          administrador do sistema.
        </p>
      </section>
    </AuthLayout>
  )
}

function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="login-page">
      <section className="login-presentation">
        <div className="brand">
          <div className="brand-icon">RH</div>

          <div>
            <strong>Interlaser Máquinas</strong>
            <span>Gestão de Recursos Humanos</span>
          </div>
        </div>

        <div className="presentation-content">
          <span className="presentation-label">
            Sistema interno
          </span>

          <h1>
            Gestão do recrutamento do início à contratação.
          </h1>

          <p>
            Acompanhe vagas, candidaturas, entrevistas e a
            integração dos novos colaboradores em um único
            sistema.
          </p>

          <div className="feature-list">
            <div className="feature-item">
              <span>✓</span>
              Vagas e candidaturas em um único fluxo
            </div>

            <div className="feature-item">
              <span>✓</span>
              Pipeline visual por etapa do processo
            </div>

            <div className="feature-item">
              <span>✓</span>
              Agenda de entrevistas e avaliações
            </div>

            <div className="feature-item">
              <span>✓</span>
              Onboarding dos candidatos aprovados
            </div>
          </div>
        </div>

        <small>
          Interlaser Máquinas © {new Date().getFullYear()} · Uso
          interno e restrito
        </small>
      </section>

      <section className="login-area">{children}</section>
    </main>
  )
}

export default App
