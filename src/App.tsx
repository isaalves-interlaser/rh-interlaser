import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import './App.css'

function App() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [verificandoSessao, setVerificandoSessao] = useState(true)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    async function carregarSessao() {
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        console.error('Erro ao recuperar sessão:', error.message)
      }

      setSession(data.session)
      setVerificandoSessao(false)
    }

    carregarSessao()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, novaSessao) => {
      setSession(novaSessao)
      setVerificandoSessao(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMensagem('')

    if (!email.trim() || !senha.trim()) {
      setMensagem('Preencha o e-mail e a senha.')
      return
    }

    setCarregando(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })

    setCarregando(false)

    if (error) {
      console.error('Erro no login:', error.message)
      setMensagem('E-mail ou senha inválidos.')
      return
    }

    setSenha('')
  }

  async function handleLogout() {
    setCarregando(true)

    const { error } = await supabase.auth.signOut()

    setCarregando(false)

    if (error) {
      setMensagem('Não foi possível encerrar a sessão.')
    }
  }

  if (verificandoSessao) {
    return (
      <main className="loading-page">
        <div className="loading-box">
          <div className="loading-logo">RH</div>
          <p>Carregando sistema...</p>
        </div>
      </main>
    )
  }

  if (session) {
    return (
      <main className="authenticated-page">
        <section className="authenticated-card">
          <div className="authenticated-logo">RH</div>

          <span className="login-label">Acesso autorizado</span>

          <h1>Login realizado com sucesso</h1>

          <p>
            O usuário está autenticado pelo Supabase.
          </p>

          <div className="user-information">
            <span>Usuário conectado</span>
            <strong>{session.user.email}</strong>
          </div>

          <button
            className="logout-button"
            type="button"
            onClick={handleLogout}
            disabled={carregando}
          >
            {carregando ? 'Saindo...' : 'Sair do sistema'}
          </button>
        </section>
      </main>
    )
  }

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
          <span className="presentation-label">Sistema interno</span>

          <h1>Recrutamento e gestão de pessoas em um só lugar.</h1>

          <p>
            Controle vagas, candidatos, entrevistas, admissões e atividades de
            integração dos novos colaboradores.
          </p>

          <div className="feature-list">
            <div className="feature-item">
              <span>✓</span>
              Pipeline de candidatos
            </div>

            <div className="feature-item">
              <span>✓</span>
              Controle de vagas e entrevistas
            </div>

            <div className="feature-item">
              <span>✓</span>
              Onboarding e documentos admissionais
            </div>

            <div className="feature-item">
              <span>✓</span>
              Usuários e permissões
            </div>
          </div>
        </div>

        <small>Interlaser Máquinas © 2026</small>
      </section>

      <section className="login-area">
        <div className="login-card">
          <div className="login-header">
            <div className="mobile-logo">RH</div>

            <span className="login-label">Acesso ao sistema</span>
            <h2>Bem-vindo</h2>
            <p>Informe seus dados para entrar no sistema.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">E-mail</label>

              <input
                id="email"
                type="email"
                placeholder="nome@interlaser.com.br"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setMensagem('')
                }}
                autoComplete="email"
                disabled={carregando}
              />
            </div>

            <div className="form-group">
              <label htmlFor="senha">Senha</label>

              <div className="password-field">
                <input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Digite sua senha"
                  value={senha}
                  onChange={(event) => {
                    setSenha(event.target.value)
                    setMensagem('')
                  }}
                  autoComplete="current-password"
                  disabled={carregando}
                />

                <button
                  className="show-password"
                  type="button"
                  onClick={() => setMostrarSenha((valorAtual) => !valorAtual)}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  disabled={carregando}
                >
                  {mostrarSenha ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            <div className="form-options">
              <label className="remember-option">
                <input type="checkbox" disabled={carregando} />
                Manter conectado
              </label>

              <button
                className="forgot-password"
                type="button"
                disabled={carregando}
              >
                Esqueci minha senha
              </button>
            </div>

            {mensagem && (
              <div className="form-message" role="alert">
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

          <p className="login-support">
            Problemas para acessar? Entre em contato com o administrador.
          </p>
        </div>
      </section>
    </main>
  )
}

export default App