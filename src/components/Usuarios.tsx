import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import './Usuarios.css'

type UserRole = 'admin' | 'rh' | 'gestor' | 'consulta'

type UserProfile = {
  id: string
  full_name: string
  role: UserRole
  active: boolean
  created_at: string
  updated_at: string
}

type UsuariosProps = {
  currentUserId: string
}

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrador',
  rh: 'Recursos Humanos',
  gestor: 'Gestor',
  consulta: 'Consulta',
}

function Usuarios({ currentUserId }: UsuariosProps) {
  const [usuarios, setUsuarios] = useState<UserProfile[]>([])
  const [pesquisa, setPesquisa] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [usuarioEditando, setUsuarioEditando] =
    useState<UserProfile | null>(null)

  useEffect(() => {
    carregarUsuarios()
  }, [])

  async function carregarUsuarios() {
    setCarregando(true)
    setErro('')

    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, full_name, role, active, created_at, updated_at',
      )
      .order('full_name', { ascending: true })

    if (error) {
      console.error('Erro ao carregar usuários:', error.message)
      setErro('Não foi possível carregar os usuários.')
      setCarregando(false)
      return
    }

    setUsuarios((data ?? []) as UserProfile[])
    setCarregando(false)
  }

  const usuariosFiltrados = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase()

    if (!termo) {
      return usuarios
    }

    return usuarios.filter((usuario) => {
      const nome = usuario.full_name.toLowerCase()
      const perfil = roleLabels[usuario.role].toLowerCase()

      return nome.includes(termo) || perfil.includes(termo)
    })
  }, [pesquisa, usuarios])

  function abrirEdicao(usuario: UserProfile) {
    setErro('')
    setMensagem('')
    setUsuarioEditando({ ...usuario })
  }

  function fecharEdicao() {
    if (salvando) {
      return
    }

    setUsuarioEditando(null)
  }

  async function salvarUsuario() {
    if (!usuarioEditando) {
      return
    }

    const nome = usuarioEditando.full_name.trim()

    if (!nome) {
      setErro('Informe o nome completo do usuário.')
      return
    }

    if (
      usuarioEditando.id === currentUserId &&
      !usuarioEditando.active
    ) {
      setErro('Você não pode bloquear seu próprio usuário.')
      return
    }

    if (
      usuarioEditando.id === currentUserId &&
      usuarioEditando.role !== 'admin'
    ) {
      setErro(
        'Você não pode remover o perfil de administrador do seu próprio usuário.',
      )
      return
    }

    setSalvando(true)
    setErro('')
    setMensagem('')

    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: nome,
        role: usuarioEditando.role,
        active: usuarioEditando.active,
      })
      .eq('id', usuarioEditando.id)
      .select(
        'id, full_name, role, active, created_at, updated_at',
      )
      .single()

    setSalvando(false)

    if (error) {
      console.error('Erro ao atualizar usuário:', error.message)
      setErro('Não foi possível atualizar o usuário.')
      return
    }

    setUsuarios((usuariosAtuais) =>
      usuariosAtuais.map((usuario) =>
        usuario.id === data.id
          ? (data as UserProfile)
          : usuario,
      ),
    )

    setUsuarioEditando(null)
    setMensagem('Usuário atualizado com sucesso.')
  }

  function formatarData(data: string) {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(data))
  }

  if (carregando) {
    return (
      <section className="users-panel users-loading">
        <div className="users-loading-icon">RH</div>
        <p>Carregando usuários...</p>
      </section>
    )
  }

  return (
    <>
      <section className="users-panel">
        <div className="users-header">
          <div>
            <span className="users-eyebrow">Configurações</span>
            <h2>Usuários e permissões</h2>
            <p>
              Gerencie os nomes, perfis de acesso e situação dos
              usuários.
            </p>
          </div>

          <button
            className="secondary-button"
            type="button"
            onClick={carregarUsuarios}
          >
            Atualizar lista
          </button>
        </div>

        <div className="users-toolbar">
          <div className="users-search">
            <label htmlFor="pesquisa-usuario">
              Pesquisar usuário
            </label>

            <input
              id="pesquisa-usuario"
              type="search"
              placeholder="Digite o nome ou perfil..."
              value={pesquisa}
              onChange={(event) => setPesquisa(event.target.value)}
            />
          </div>

          <div className="users-total">
            <span>Total de usuários</span>
            <strong>{usuarios.length}</strong>
          </div>

          <div className="users-total">
            <span>Usuários ativos</span>
            <strong>
              {usuarios.filter((usuario) => usuario.active).length}
            </strong>
          </div>
        </div>

        {erro && (
          <div className="users-message error" role="alert">
            {erro}
          </div>
        )}

        {mensagem && (
          <div className="users-message success" role="status">
            {mensagem}
          </div>
        )}

        <div className="users-table-wrapper">
          <table className="users-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Perfil</th>
                <th>Situação</th>
                <th>Cadastrado em</th>
                <th aria-label="Ações" />
              </tr>
            </thead>

            <tbody>
              {usuariosFiltrados.map((usuario) => (
                <tr key={usuario.id}>
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar">
                        {usuario.full_name
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div>
                        <strong>{usuario.full_name}</strong>

                        {usuario.id === currentUserId && (
                          <span>Usuário conectado</span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td>
                    <span
                      className={`role-badge role-${usuario.role}`}
                    >
                      {roleLabels[usuario.role]}
                    </span>
                  </td>

                  <td>
                    <span
                      className={
                        usuario.active
                          ? 'status-badge active'
                          : 'status-badge inactive'
                      }
                    >
                      {usuario.active ? 'Ativo' : 'Bloqueado'}
                    </span>
                  </td>

                  <td>{formatarData(usuario.created_at)}</td>

                  <td className="users-actions">
                    <button
                      type="button"
                      onClick={() => abrirEdicao(usuario)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}

              {usuariosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="users-empty">
                      <strong>Nenhum usuário encontrado</strong>
                      <p>
                        Altere o termo usado na pesquisa.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {usuarioEditando && (
        <div
          className="users-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              fecharEdicao()
            }
          }}
        >
          <section
            className="users-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-editar-usuario"
          >
            <div className="users-modal-header">
              <div>
                <span className="users-eyebrow">
                  Configurações
                </span>

                <h2 id="titulo-editar-usuario">
                  Editar usuário
                </h2>
              </div>

              <button
                className="modal-close-button"
                type="button"
                onClick={fecharEdicao}
                disabled={salvando}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className="users-form-group">
              <label htmlFor="usuario-nome">
                Nome completo
              </label>

              <input
                id="usuario-nome"
                type="text"
                value={usuarioEditando.full_name}
                onChange={(event) =>
                  setUsuarioEditando({
                    ...usuarioEditando,
                    full_name: event.target.value,
                  })
                }
                disabled={salvando}
              />
            </div>

            <div className="users-form-group">
              <label htmlFor="usuario-perfil">
                Perfil de acesso
              </label>

              <select
                id="usuario-perfil"
                value={usuarioEditando.role}
                onChange={(event) =>
                  setUsuarioEditando({
                    ...usuarioEditando,
                    role: event.target.value as UserRole,
                  })
                }
                disabled={
                  salvando ||
                  usuarioEditando.id === currentUserId
                }
              >
                <option value="admin">Administrador</option>
                <option value="rh">Recursos Humanos</option>
                <option value="gestor">Gestor</option>
                <option value="consulta">Consulta</option>
              </select>

              {usuarioEditando.id === currentUserId && (
                <small>
                  Seu próprio perfil de administrador não pode ser
                  alterado nesta tela.
                </small>
              )}
            </div>

            <label className="users-status-option">
              <input
                type="checkbox"
                checked={usuarioEditando.active}
                onChange={(event) =>
                  setUsuarioEditando({
                    ...usuarioEditando,
                    active: event.target.checked,
                  })
                }
                disabled={
                  salvando ||
                  usuarioEditando.id === currentUserId
                }
              />

              <span>
                <strong>Usuário ativo</strong>
                <small>
                  Usuários bloqueados não devem acessar o sistema.
                </small>
              </span>
            </label>

            {erro && (
              <div className="users-message error" role="alert">
                {erro}
              </div>
            )}

            <div className="users-modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={fecharEdicao}
                disabled={salvando}
              >
                Cancelar
              </button>

              <button
                className="primary-button"
                type="button"
                onClick={salvarUsuario}
                disabled={salvando}
              >
                {salvando ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}

export default Usuarios