import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { supabase } from '../lib/supabase'
import './BancoTalentos.css'

type BancoTalentosArea = 'administrativo' | 'producao'

type CandidatoOrigem =
  | 'indicacao'
  | 'linkedin'
  | 'indeed'
  | 'site'
  | 'email'
  | 'presencial'
  | 'agencia'
  | 'banco_talentos'
  | 'outro'

type CandidaturaEtapa =
  | 'recebido'
  | 'em_analise'
  | 'entrevista_rh'
  | 'entrevista_gestor'
  | 'teste_pratico'
  | 'exame_admissional'
  | 'documentacao'
  | 'contratado'

type CandidaturaStatus =
  | 'ativo'
  | 'reprovado'
  | 'desistente'
  | 'suspenso'
  | 'banco_talentos'
  | 'contratado'

type CandidatoBanco = {
  id: string
  numero: number | null
  nome_completo: string
  email: string | null
  whatsapp: string | null
  cidade: string | null
  uf: string | null
  origem: CandidatoOrigem | null
  observacoes: string | null
  curriculo_path: string | null
  curriculo_drive_file_id: string | null
  curriculo_drive_url: string | null
  curriculo_drive_nome: string | null
  banco_talentos_area: BancoTalentosArea | null
  active: boolean | null
  created_at: string
  updated_at: string | null
}

type CandidaturaBanco = {
  id: string
  candidato_id: string
  vaga_id: string
  etapa: CandidaturaEtapa
  status: CandidaturaStatus
  data_entrada: string
  observacoes: string | null
  updated_at: string | null
}

type VagaAberta = {
  id: string
  numero: number
  cargo: string
  setor: string | null
  status: string
}

type AreaFiltro = 'todos' | BancoTalentosArea | 'sem_area'

const areaLabels: Record<BancoTalentosArea, string> = {
  administrativo: 'Administrativo',
  producao: 'Produção',
}

const etapaLabels: Record<CandidaturaEtapa, string> = {
  recebido: 'Recebido',
  em_analise: 'Em análise',
  entrevista_rh: 'Entrevista RH',
  entrevista_gestor: 'Entrevista com gestor',
  teste_pratico: 'Teste prático',
  exame_admissional: 'Exame admissional',
  documentacao: 'Documentação',
  contratado: 'Contratado',
}

const statusLabels: Record<CandidaturaStatus, string> = {
  ativo: 'Ativo',
  reprovado: 'Reprovado',
  desistente: 'Desistente',
  suspenso: 'Suspenso',
  banco_talentos: 'Banco de talentos',
  contratado: 'Contratado',
}

function codigoCandidato(numero: number | null) {
  if (!numero) {
    return 'CAN-000000'
  }

  return `CAN-${String(numero).padStart(6, '0')}`
}

function codigoVaga(numero: number) {
  return `VAG-${String(numero).padStart(6, '0')}`
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '—'
  }

  return new Intl.DateTimeFormat('pt-BR').format(new Date(value))
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '—'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatPhone(value: string | null) {
  if (!value) {
    return 'Não informado'
  }

  const normalized = value.replace(/\D/g, '')

  if (normalized.length === 11) {
    return `(${normalized.slice(0, 2)}) ${normalized.slice(2, 7)}-${normalized.slice(7)}`
  }

  if (normalized.length === 10) {
    return `(${normalized.slice(0, 2)}) ${normalized.slice(2, 6)}-${normalized.slice(6)}`
  }

  return value
}

function extractDriveFileId(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const byFilePath = value.match(/\/file\/d\/([^/]+)/)

  if (byFilePath?.[1]) {
    return byFilePath[1]
  }

  const byIdParam = value.match(/[?&]id=([^&]+)/)

  if (byIdParam?.[1]) {
    return byIdParam[1]
  }

  return null
}

function getDriveFileId(candidato: CandidatoBanco) {
  return (
    candidato.curriculo_drive_file_id ||
    extractDriveFileId(candidato.curriculo_drive_url) ||
    extractDriveFileId(candidato.curriculo_path)
  )
}

function getCurriculoPreviewUrl(candidato: CandidatoBanco) {
  const fileId = getDriveFileId(candidato)

  if (fileId) {
    return `https://drive.google.com/file/d/${fileId}/preview`
  }

  return candidato.curriculo_drive_url || candidato.curriculo_path || ''
}

function getCurriculoOpenUrl(candidato: CandidatoBanco) {
  const fileId = getDriveFileId(candidato)

  if (fileId) {
    return `https://drive.google.com/file/d/${fileId}/view`
  }

  return candidato.curriculo_drive_url || candidato.curriculo_path || ''
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2)

  return parts
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function getUltimaCandidatura(candidaturas: CandidaturaBanco[]) {
  return [...candidaturas].sort(
    (a, b) =>
      new Date(b.updated_at || b.data_entrada).getTime() -
      new Date(a.updated_at || a.data_entrada).getTime(),
  )[0]
}

function BancoTalentos() {
  const [candidatos, setCandidatos] = useState<CandidatoBanco[]>([])
  const [candidaturas, setCandidaturas] = useState<CandidaturaBanco[]>([])
  const [vagasAbertas, setVagasAbertas] = useState<VagaAberta[]>([])
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const [pesquisa, setPesquisa] = useState('')
  const [filtroArea, setFiltroArea] = useState<AreaFiltro>('todos')
  const [filtroCidade, setFiltroCidade] = useState('todos')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [modalVinculoAberto, setModalVinculoAberto] = useState(false)
  const [vagaSelecionadaId, setVagaSelecionadaId] = useState('')

  const carregarDados = useCallback(async () => {
    setCarregando(true)
    setErro('')

    const [candidatosResult, candidaturasResult, vagasResult] =
      await Promise.all([
        supabase
          .from('candidatos')
          .select(
            `
              id,
              numero,
              nome_completo,
              email,
              whatsapp,
              cidade,
              uf,
              origem,
              observacoes,
              curriculo_path,
              curriculo_drive_file_id,
              curriculo_drive_url,
              curriculo_drive_nome,
              banco_talentos_area,
              active,
              created_at,
              updated_at
            `,
          )
          .order('updated_at', { ascending: false }),
        supabase
          .from('candidaturas')
          .select(
            'id, candidato_id, vaga_id, etapa, status, data_entrada, observacoes, updated_at',
          )
          .order('data_entrada', { ascending: false }),
        supabase
          .from('vagas')
          .select('id, numero, cargo, setor, status')
          .eq('status', 'aberta')
          .order('created_at', { ascending: false }),
      ])

    if (
      candidatosResult.error ||
      candidaturasResult.error ||
      vagasResult.error
    ) {
      console.error(
        candidatosResult.error ||
          candidaturasResult.error ||
          vagasResult.error,
      )
      setErro(
        'Não foi possível carregar o Banco de Talentos. Verifique se o SQL do campo banco_talentos_area já foi aplicado.',
      )
      setCarregando(false)
      return
    }

    setCandidatos((candidatosResult.data ?? []) as CandidatoBanco[])
    setCandidaturas(
      (candidaturasResult.data ?? []) as CandidaturaBanco[],
    )
    setVagasAbertas((vagasResult.data ?? []) as VagaAberta[])
    setCarregando(false)
  }, [])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  const candidaturasPorCandidato = useMemo(() => {
    const map = new Map<string, CandidaturaBanco[]>()

    candidaturas.forEach((candidatura) => {
      const current = map.get(candidatura.candidato_id) ?? []
      current.push(candidatura)
      map.set(candidatura.candidato_id, current)
    })

    return map
  }, [candidaturas])

  const candidatosBanco = useMemo(
    () =>
      candidatos.filter((candidato) => {
        const apps = candidaturasPorCandidato.get(candidato.id) ?? []
        const temStatusBanco = apps.some(
          (candidatura) => candidatura.status === 'banco_talentos',
        )

        return candidato.origem === 'banco_talentos' || temStatusBanco
      }),
    [candidatos, candidaturasPorCandidato],
  )

  const cidades = useMemo(() => {
    const values = new Set<string>()

    candidatosBanco.forEach((candidato) => {
      const cidade = candidato.cidade?.trim()

      if (cidade) {
        values.add(cidade)
      }
    })

    return Array.from(values).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [candidatosBanco])

  const candidatosFiltrados = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase()

    return candidatosBanco.filter((candidato) => {
      const matchesSearch = !termo
        ? true
        : [
            candidato.nome_completo,
            candidato.email,
            candidato.whatsapp,
            candidato.cidade,
            candidato.uf,
            candidato.observacoes,
          ]
            .filter(Boolean)
            .some((value) =>
              String(value).toLowerCase().includes(termo),
            )

      const matchesArea =
        filtroArea === 'todos'
          ? true
          : filtroArea === 'sem_area'
            ? !candidato.banco_talentos_area
            : candidato.banco_talentos_area === filtroArea

      const matchesCidade =
        filtroCidade === 'todos'
          ? true
          : candidato.cidade === filtroCidade

      return matchesSearch && matchesArea && matchesCidade
    })
  }, [candidatosBanco, filtroArea, filtroCidade, pesquisa])

  useEffect(() => {
    if (candidatosFiltrados.length === 0) {
      setSelecionadoId(null)
      return
    }

    const selecionadoAindaExiste = candidatosFiltrados.some(
      (candidato) => candidato.id === selecionadoId,
    )

    if (!selecionadoAindaExiste) {
      setSelecionadoId(candidatosFiltrados[0].id)
    }
  }, [candidatosFiltrados, selecionadoId])

  const selecionado = useMemo(
    () =>
      candidatosFiltrados.find(
        (candidato) => candidato.id === selecionadoId,
      ) ?? candidatosFiltrados[0] ?? null,
    [candidatosFiltrados, selecionadoId],
  )

  const candidaturasSelecionado = useMemo(() => {
    if (!selecionado) {
      return []
    }

    return candidaturasPorCandidato.get(selecionado.id) ?? []
  }, [candidaturasPorCandidato, selecionado])

  const ultimaCandidaturaSelecionado = getUltimaCandidatura(
    candidaturasSelecionado,
  )

  const previewUrl = selecionado
    ? getCurriculoPreviewUrl(selecionado)
    : ''
  const openUrl = selecionado ? getCurriculoOpenUrl(selecionado) : ''

  const totalAdministrativo = candidatosBanco.filter(
    (candidato) => candidato.banco_talentos_area === 'administrativo',
  ).length
  const totalProducao = candidatosBanco.filter(
    (candidato) => candidato.banco_talentos_area === 'producao',
  ).length
  const totalSemArea = candidatosBanco.filter(
    (candidato) => !candidato.banco_talentos_area,
  ).length

  function abrirModalVinculo() {
    setMensagem('')
    setErro('')
    setVagaSelecionadaId('')
    setModalVinculoAberto(true)
  }

  async function vincularCandidatoAVaga(event: FormEvent) {
    event.preventDefault()

    if (!selecionado) {
      setErro('Selecione um candidato para vincular à vaga.')
      return
    }

    if (!vagaSelecionadaId) {
      setErro('Selecione uma vaga aberta.')
      return
    }

    setSalvando(true)
    setErro('')
    setMensagem('')

    const candidaturaExistente = candidaturas.find(
      (candidatura) =>
        candidatura.candidato_id === selecionado.id &&
        candidatura.vaga_id === vagaSelecionadaId,
    )

    if (candidaturaExistente) {
      if (
        candidaturaExistente.status === 'ativo' &&
        candidaturaExistente.etapa !== 'contratado'
      ) {
        setErro('Este candidato já está vinculado a essa vaga.')
        setSalvando(false)
        return
      }

      const { error: updateError } = await supabase
        .from('candidaturas')
        .update({
          etapa: 'recebido',
          status: 'ativo',
          observacoes:
            'Candidato reativado a partir do Banco de Talentos.',
        })
        .eq('id', candidaturaExistente.id)

      if (updateError) {
        console.error(updateError)
        setErro('Não foi possível reativar a candidatura para esta vaga.')
        setSalvando(false)
        return
      }
    } else {
      const { error: insertError } = await supabase
        .from('candidaturas')
        .insert({
          candidato_id: selecionado.id,
          vaga_id: vagaSelecionadaId,
          etapa: 'recebido',
          status: 'ativo',
          observacoes:
            'Candidato vinculado a partir do Banco de Talentos.',
        })

      if (insertError) {
        console.error(insertError)
        setErro('Não foi possível vincular o candidato à vaga.')
        setSalvando(false)
        return
      }
    }

    await carregarDados()
    setModalVinculoAberto(false)
    setSalvando(false)
    setMensagem('Candidato vinculado à vaga com sucesso.')
  }

  return (
    <section className="talent-bank-page">
      <header className="talent-bank-header">
        <div>
          <span className="talent-bank-eyebrow">Banco de Talentos</span>
          <h2>Currículos disponíveis para futuras vagas</h2>
          <p>
            Filtre por área, visualize o currículo pelo Drive e vincule o
            candidato a uma vaga aberta quando surgir oportunidade.
          </p>
        </div>

        <button type="button" onClick={carregarDados} disabled={carregando}>
          {carregando ? 'Atualizando...' : 'Atualizar dados'}
        </button>
      </header>

      {erro && <div className="talent-bank-alert error">{erro}</div>}
      {mensagem && (
        <div className="talent-bank-alert success">{mensagem}</div>
      )}

      <div className="talent-bank-summary-grid">
        <button
          className={filtroArea === 'todos' ? 'active' : ''}
          type="button"
          onClick={() => setFiltroArea('todos')}
        >
          <span>Total no banco</span>
          <strong>{candidatosBanco.length}</strong>
        </button>

        <button
          className={filtroArea === 'administrativo' ? 'active' : ''}
          type="button"
          onClick={() => setFiltroArea('administrativo')}
        >
          <span>Administrativo</span>
          <strong>{totalAdministrativo}</strong>
        </button>

        <button
          className={filtroArea === 'producao' ? 'active' : ''}
          type="button"
          onClick={() => setFiltroArea('producao')}
        >
          <span>Produção</span>
          <strong>{totalProducao}</strong>
        </button>

        <button
          className={filtroArea === 'sem_area' ? 'active' : ''}
          type="button"
          onClick={() => setFiltroArea('sem_area')}
        >
          <span>Sem área</span>
          <strong>{totalSemArea}</strong>
        </button>
      </div>

      <div className="talent-bank-toolbar">
        <label>
          <span>Buscar candidato</span>
          <input
            type="search"
            placeholder="Nome, e-mail, telefone ou observação"
            value={pesquisa}
            onChange={(event) => setPesquisa(event.target.value)}
          />
        </label>

        <label>
          <span>Área</span>
          <select
            value={filtroArea}
            onChange={(event) =>
              setFiltroArea(event.target.value as AreaFiltro)
            }
          >
            <option value="todos">Todas</option>
            <option value="administrativo">Administrativo</option>
            <option value="producao">Produção</option>
            <option value="sem_area">Sem área informada</option>
          </select>
        </label>

        <label>
          <span>Cidade</span>
          <select
            value={filtroCidade}
            onChange={(event) => setFiltroCidade(event.target.value)}
          >
            <option value="todos">Todas</option>
            {cidades.map((cidade) => (
              <option value={cidade} key={cidade}>
                {cidade}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="talent-bank-workspace">
        <aside className="talent-bank-list-panel">
          <div className="talent-bank-list-header">
            <strong>{candidatosFiltrados.length} currículo(s)</strong>
            <span>Banco de talentos</span>
          </div>

          {carregando ? (
            <div className="talent-bank-empty compact">
              Carregando candidatos...
            </div>
          ) : candidatosFiltrados.length === 0 ? (
            <div className="talent-bank-empty compact">
              Nenhum candidato encontrado com os filtros atuais.
            </div>
          ) : (
            <div className="talent-bank-candidate-list">
              {candidatosFiltrados.map((candidato) => {
                const apps =
                  candidaturasPorCandidato.get(candidato.id) ?? []
                const latest = getUltimaCandidatura(apps)

                return (
                  <button
                    className={
                      selecionado?.id === candidato.id
                        ? 'talent-bank-candidate-card active'
                        : 'talent-bank-candidate-card'
                    }
                    type="button"
                    key={candidato.id}
                    onClick={() => setSelecionadoId(candidato.id)}
                  >
                    <span className="talent-bank-avatar">
                      {getInitials(candidato.nome_completo)}
                    </span>

                    <span className="talent-bank-card-main">
                      <strong>{candidato.nome_completo}</strong>
                      <small>{codigoCandidato(candidato.numero)}</small>
                      <span>
                        {candidato.cidade || 'Cidade não informada'}
                        {candidato.uf ? `/${candidato.uf}` : ''}
                      </span>
                    </span>

                    <span className="talent-bank-card-tags">
                      <em>
                        {candidato.banco_talentos_area
                          ? areaLabels[candidato.banco_talentos_area]
                          : 'Sem área'}
                      </em>
                      {latest && <small>{statusLabels[latest.status]}</small>}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </aside>

        <main className="talent-bank-preview-panel">
          {!selecionado ? (
            <div className="talent-bank-empty">
              Selecione um candidato para visualizar o currículo.
            </div>
          ) : (
            <>
              <div className="talent-bank-detail-header">
                <div>
                  <span className="talent-bank-eyebrow">Currículo</span>
                  <h3>{selecionado.nome_completo}</h3>
                  <p>
                    {selecionado.email || 'E-mail não informado'} ·{' '}
                    {formatPhone(selecionado.whatsapp)}
                  </p>
                </div>

                <div className="talent-bank-actions">
                  <button
                    type="button"
                    className="talent-bank-primary-action"
                    onClick={abrirModalVinculo}
                    disabled={vagasAbertas.length === 0}
                  >
                    Vincular a uma vaga
                  </button>

                  {openUrl && (
                    <a
                      className="talent-bank-secondary-action"
                      href={openUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir no Drive
                    </a>
                  )}
                </div>
              </div>

              <div className="talent-bank-info-grid">
                <div>
                  <span>Área de interesse</span>
                  <strong>
                    {selecionado.banco_talentos_area
                      ? areaLabels[selecionado.banco_talentos_area]
                      : 'Não informada'}
                  </strong>
                </div>

                <div>
                  <span>Entrada no banco</span>
                  <strong>{formatDate(selecionado.created_at)}</strong>
                </div>

                <div>
                  <span>Última atualização</span>
                  <strong>{formatDateTime(selecionado.updated_at)}</strong>
                </div>

                <div>
                  <span>Vagas vinculadas</span>
                  <strong>{candidaturasSelecionado.length}</strong>
                </div>
              </div>

              {selecionado.observacoes && (
                <div className="talent-bank-note">
                  <strong>Observações</strong>
                  <p>{selecionado.observacoes}</p>
                </div>
              )}

              {ultimaCandidaturaSelecionado && (
                <div className="talent-bank-last-status">
                  <span>Último status</span>
                  <strong>
                    {statusLabels[ultimaCandidaturaSelecionado.status]} ·{' '}
                    {etapaLabels[ultimaCandidaturaSelecionado.etapa]}
                  </strong>
                  <small>
                    Atualizado em{' '}
                    {formatDateTime(
                      ultimaCandidaturaSelecionado.updated_at ||
                        ultimaCandidaturaSelecionado.data_entrada,
                    )}
                  </small>
                </div>
              )}

              <div className="talent-bank-cv-frame">
                {previewUrl ? (
                  <iframe
                    title={`Currículo de ${selecionado.nome_completo}`}
                    src={previewUrl}
                    loading="lazy"
                  />
                ) : (
                  <div className="talent-bank-empty">
                    Este candidato ainda não possui link de currículo no
                    Google Drive.
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {modalVinculoAberto && selecionado && (
        <div className="talent-bank-modal-backdrop" role="presentation">
          <form
            className="talent-bank-modal"
            onSubmit={vincularCandidatoAVaga}
          >
            <div>
              <span className="talent-bank-eyebrow">Vincular a vaga</span>
              <h3>{selecionado.nome_completo}</h3>
              <p>
                Escolha uma vaga aberta para criar uma candidatura a partir
                do Banco de Talentos.
              </p>
            </div>

            <label>
              <span>Vaga aberta *</span>
              <select
                value={vagaSelecionadaId}
                onChange={(event) =>
                  setVagaSelecionadaId(event.target.value)
                }
                required
              >
                <option value="">Selecione...</option>
                {vagasAbertas.map((vaga) => (
                  <option value={vaga.id} key={vaga.id}>
                    {codigoVaga(vaga.numero)} — {vaga.cargo}
                    {vaga.setor ? ` / ${vaga.setor}` : ''}
                  </option>
                ))}
              </select>
            </label>

            {vagasAbertas.length === 0 && (
              <div className="talent-bank-alert error">
                Não existe vaga aberta disponível para vínculo.
              </div>
            )}

            <div className="talent-bank-modal-actions">
              <button
                type="button"
                className="talent-bank-secondary-action"
                onClick={() => setModalVinculoAberto(false)}
                disabled={salvando}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="talent-bank-primary-action"
                disabled={salvando || vagasAbertas.length === 0}
              >
                {salvando ? 'Vinculando...' : 'Criar candidatura'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

export default BancoTalentos
