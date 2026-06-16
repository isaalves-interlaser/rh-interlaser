import { useState, type FormEvent } from 'react'
import './App.css'

function App() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [mensagem, setMensagem] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email.trim() || !senha.trim()) {
      setMensagem('Preencha o e-mail e a senha.')
      return
    }

    setMensagem(
      'Tela funcionando. No próximo passo conectaremos o login ao Supabase.',
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
                />

                <button
                  className="show-password"
                  type="button"
                  onClick={() => setMostrarSenha((valorAtual) => !valorAtual)}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {mostrarSenha ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            <div className="form-options">
              <label className="remember-option">
                <input type="checkbox" />
                Manter conectado
              </label>

              <button className="forgot-password" type="button">
                Esqueci minha senha
              </button>
            </div>

            {mensagem && (
              <div className="form-message" role="alert">
                {mensagem}
              </div>
            )}

            <button className="login-button" type="submit">
              Entrar
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