import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { supabase } from '../lib/supabase'
import { enviarCurriculoParaDrive } from '../lib/googleDriveRh'
import './PortalVagas.css'

type VagaStatus =
  | 'aberta'
  | 'em_selecao'
  | 'suspensa'
  | 'preenchida'

type VagaContrato =
  | 'clt'
  | 'pj'
  | 'temporario'
  | 'estagio'
  | 'aprendiz'
  | 'terceiro'

type VagaModalidade = 'presencial' | 'hibrido' | 'remoto'

type Empresa = {
  id: string
  nome_fantasia: string
}

type Filial = {
  id: string
  empresa_id: string
  codigo: string
  nome: string
  cidade: string | null
  uf: string | null
}

type VagaPublica = {
  id: string
  numero: number
  empresa_id: string
  filial_id: string
  cargo: string
  setor: string
  tipo_contrato: VagaContrato
  modalidade: VagaModalidade
  status: VagaStatus
  data_limite: string | null
  created_at: string
  drive_folder_id: string | null
  drive_folder_url: string | null
}

type FormularioCandidatura = {
  nomeCompleto: string
  email: string
  whatsapp: string
  cidade: string
  uf: string
  observacoes: string
  consentimento: boolean
}

type PortalView =
  | { type: 'list' }
  | { type: 'details'; vagaId: string }
  | { type: 'apply'; vagaId: string }
  | { type: 'talent-bank' }

const initialForm: FormularioCandidatura = {
  nomeCompleto: '',
  email: '',
  whatsapp: '',
  cidade: '',
  uf: '',
  observacoes: '',
  consentimento: false,
}

const contratoLabels: Record<VagaContrato, string> = {
  clt: 'CLT',
  pj: 'PJ',
  temporario: 'Temporário',
  estagio: 'Estágio',
  aprendiz: 'Aprendiz',
  terceiro: 'Terceiro',
}

const modalidadeLabels: Record<VagaModalidade, string> = {
  presencial: 'Presencial',
  hibrido: 'Híbrido',
  remoto: 'Remoto',
}

const MAX_FILE_SIZE_MB = 10
const acceptedExtensions = ['pdf', 'doc', 'docx']

function parsePortalView(pathname: string): PortalView {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/'

  if (normalizedPath === '/candidatura-espontanea') {
    return { type: 'talent-bank' }
  }

  const candidatarMatch = normalizedPath.match(/^\/candidatar\/([^/]+)$/)
  if (candidatarMatch?.[1]) {
    return { type: 'apply', vagaId: candidatarMatch[1] }
  }

  const detalhesMatch = normalizedPath.match(/^\/vagas\/([^/]+)$/)
  if (detalhesMatch?.[1]) {
    return { type: 'details', vagaId: detalhesMatch[1] }
  }

  return { type: 'list' }
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '')
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function nullableText(value: string) {
  const normalized = value.trim()
  return normalized || null
}

function formatDate(value: string | null) {
  if (!value) return 'Sem prazo informado'

  return new Intl.DateTimeFormat('pt-BR').format(
    new Date(`${value}T12:00:00`),
  )
}

function buildVacancyCode(numero: number) {
  return `VAG-${String(numero).padStart(6, '0')}`
}

function getFileExtension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

function validateResume(file: File | null) {
  if (!file) {
    return 'Anexe seu currículo em PDF, DOC ou DOCX.'
  }

  const extension = getFileExtension(file.name)

  if (!acceptedExtensions.includes(extension)) {
    return 'Envie o currículo em PDF, DOC ou DOCX.'
  }

  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return `O currículo deve ter no máximo ${MAX_FILE_SIZE_MB} MB.`
  }

  return ''
}

function vacancyLocation(filial: Filial | null | undefined) {
  if (!filial) return 'Local não informado'

  const cityUf = [filial.cidade, filial.uf]
    .filter(Boolean)
    .join('/')

  return cityUf || filial.nome
}

function PortalVagas() {
  const [path, setPath] = useState(window.location.pathname)
  const [vagas, setVagas] = useState<VagaPublica[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [filiais, setFiliais] = useState<Filial[]>([])
  const [pesquisa, setPesquisa] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [form, setForm] =
    useState<FormularioCandidatura>(initialForm)
  const [curriculo, setCurriculo] = useState<File | null>(null)

  const view = useMemo(() => parsePortalView(path), [path])

  const navegar = useCallback((nextPath: string) => {
    window.history.pushState({}, '', nextPath)
    setPath(window.location.pathname)
    setErro('')
    setMensagem('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const carregarVagas = useCallback(async () => {
    setCarregando(true)
    setErro('')

    const [vagasResult, empresasResult, filiaisResult] =
      await Promise.all([
        supabase
          .from('vagas')
          .select(
            'id, numero, empresa_id, filial_id, cargo, setor, tipo_contrato, modalidade, status, data_limite, created_at, drive_folder_id, drive_folder_url',
          )
          .eq('status', 'aberta')
          .order('created_at', { ascending: false }),
        supabase
          .from('empresas')
          .select('id, nome_fantasia')
          .eq('active', true)
          .order('nome_fantasia'),
        supabase
          .from('filiais')
          .select('id, empresa_id, codigo, nome, cidade, uf')
          .eq('active', true)
          .order('nome'),
      ])

    const firstError =
      vagasResult.error ?? empresasResult.error ?? filiaisResult.error

    if (firstError) {
      console.error('Erro no portal de vagas:', firstError.message)
      setErro(
        'Não foi possível carregar as vagas públicas. Verifique as permissões públicas do Supabase.',
      )
      setCarregando(false)
      return
    }

    setVagas((vagasResult.data ?? []) as VagaPublica[])
    setEmpresas((empresasResult.data ?? []) as Empresa[])
    setFiliais((filiaisResult.data ?? []) as Filial[])
    setCarregando(false)
  }, [])

  useEffect(() => {
    carregarVagas()
  }, [carregarVagas])

  useEffect(() => {
    function handlePopState() {
      setPath(window.location.pathname)
      setErro('')
      setMensagem('')
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const vagasFiltradas = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase()

    if (!termo) return vagas

    return vagas.filter((vaga) => {
      const filial = filiais.find(
        (item) => item.id === vaga.filial_id,
      )
      const empresa = empresas.find(
        (item) => item.id === vaga.empresa_id,
      )

      return (
        vaga.cargo.toLowerCase().includes(termo) ||
        vaga.setor.toLowerCase().includes(termo) ||
        empresa?.nome_fantasia.toLowerCase().includes(termo) ||
        filial?.nome.toLowerCase().includes(termo) ||
        filial?.cidade?.toLowerCase().includes(termo)
      )
    })
  }, [empresas, filiais, pesquisa, vagas])

  const vagaSelecionada = useMemo(() => {
    if (view.type !== 'details' && view.type !== 'apply') {
      return null
    }

    return vagas.find((vaga) => vaga.id === view.vagaId) ?? null
  }, [vagas, view])

  const empresaSelecionada = vagaSelecionada
    ? empresas.find(
        (empresa) => empresa.id === vagaSelecionada.empresa_id,
      )
    : null

  const filialSelecionada = vagaSelecionada
    ? filiais.find(
        (filial) => filial.id === vagaSelecionada.filial_id,
      )
    : null

  function updateForm<K extends keyof FormularioCandidatura>(
    key: K,
    value: FormularioCandidatura[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }))
    setErro('')
    setMensagem('')
  }

  function handleCurriculoChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0] ?? null
    setCurriculo(file)
    setErro(validateResume(file))
    setMensagem('')
  }

  async function uploadCurriculoDrive(
    file: File,
    nomeCompleto: string,
    email: string,
    whatsapp: string,
  ) {
    return enviarCurriculoParaDrive({
      arquivo: file,
      nomeCompleto,
      email,
      whatsapp,
      vagaId:
        view.type === 'apply' && vagaSelecionada
          ? vagaSelecionada.id
          : null,
      destino: view.type === 'talent-bank' ? 'banco_talentos' : 'vaga',
    })
  }

  async function enviarCandidatura(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setErro('')
    setMensagem('')

    const nomeCompleto = form.nomeCompleto.trim()
    const email = normalizeEmail(form.email)
    const whatsapp = normalizePhone(form.whatsapp)
    const cidade = form.cidade.trim()
    const uf = form.uf.trim().toUpperCase()
    const resumeError = validateResume(curriculo)

    if (view.type === 'apply' && !vagaSelecionada) {
      setErro('Esta vaga não está disponível para candidatura.')
      return
    }

    if (nomeCompleto.length < 3) {
      setErro('Informe seu nome completo.')
      return
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErro('Informe um e-mail válido.')
      return
    }

    if (whatsapp.length < 10 || whatsapp.length > 13) {
      setErro('Informe um WhatsApp válido com DDD.')
      return
    }

    if (uf && !/^[A-Z]{2}$/.test(uf)) {
      setErro('Informe a UF com duas letras, por exemplo SP.')
      return
    }

    if (resumeError || !curriculo) {
      setErro(resumeError)
      return
    }

    if (!form.consentimento) {
      setErro(
        'Para enviar o currículo, é necessário aceitar o consentimento de tratamento de dados.',
      )
      return
    }

    setEnviando(true)

    try {
      const curriculoDrive = await uploadCurriculoDrive(
        curriculo,
        nomeCompleto,
        email,
        whatsapp,
      )

      const observacoesPortal = [
        nullableText(form.observacoes),
        view.type === 'apply' && vagaSelecionada
          ? `Candidatura enviada pelo portal público para ${buildVacancyCode(vagaSelecionada.numero)} — ${vagaSelecionada.cargo}.`
          : 'Currículo enviado pelo portal público para banco de talentos.',
      ]
        .filter(Boolean)
        .join('\n\n')

      const { data: candidatoCriado, error: candidatoError } =
        await supabase
          .from('candidatos')
          .insert({
            nome_completo: nomeCompleto,
            email,
            whatsapp,
            cidade: nullableText(cidade),
            uf: uf || null,
            origem:
              view.type === 'talent-bank'
                ? 'banco_talentos'
                : 'site',
            observacoes: observacoesPortal,
            curriculo_path: curriculoDrive.fileUrl,
            curriculo_drive_file_id: curriculoDrive.fileId,
            curriculo_drive_url: curriculoDrive.fileUrl,
            curriculo_drive_nome: curriculoDrive.fileName,
            curriculo_drive_folder_id: curriculoDrive.folderId,
            active: true,
          })
          .select('id')
          .single()

      if (candidatoError || !candidatoCriado) {
        console.error(
          'Erro ao cadastrar candidato:',
          candidatoError?.message,
        )

        if (candidatoError?.code === '23505') {
          throw new Error(
            'Já existe um cadastro com esse e-mail ou WhatsApp. Entre em contato com o RH para atualizar seu currículo.',
          )
        }

        throw new Error(
          'Não foi possível registrar sua candidatura. Verifique as permissões públicas da tabela candidatos no Supabase.',
        )
      }

      if (view.type === 'apply' && vagaSelecionada) {
        const { error: candidaturaError } = await supabase
          .from('candidaturas')
          .insert({
            candidato_id: candidatoCriado.id,
            vaga_id: vagaSelecionada.id,
            etapa: 'recebido',
            status: 'ativo',
            observacoes: 'Candidatura enviada pelo portal público. Currículo armazenado no Google Drive.',
          })

        if (candidaturaError) {
          console.error(
            'Erro ao criar candidatura:',
            candidaturaError.message,
          )
          throw new Error(
            'Seu currículo foi salvo, mas não foi possível vincular automaticamente à vaga. O RH poderá localizar seu cadastro na lista de candidatos.',
          )
        }
      }

      setMensagem(
        view.type === 'talent-bank'
          ? 'Currículo enviado com sucesso para o banco de talentos.'
          : 'Candidatura enviada com sucesso. Nossa equipe de RH analisará seu perfil.',
      )
      setForm(initialForm)
      setCurriculo(null)
    } catch (submissionError) {
      setErro(
        submissionError instanceof Error
          ? submissionError.message
          : 'Não foi possível enviar sua candidatura.',
      )
    } finally {
      setEnviando(false)
    }
  }

  function renderVacancyCard(vaga: VagaPublica) {
    const empresa = empresas.find(
      (item) => item.id === vaga.empresa_id,
    )
    const filial = filiais.find(
      (item) => item.id === vaga.filial_id,
    )

    return (
      <article className="jobs-card" key={vaga.id}>
        <div className="jobs-card-topline">
          <span>{buildVacancyCode(vaga.numero)}</span>
          <strong>{modalidadeLabels[vaga.modalidade]}</strong>
        </div>

        <h3>{vaga.cargo}</h3>
        <p>{vaga.setor}</p>

        <div className="jobs-card-meta">
          <span>{empresa?.nome_fantasia ?? 'Interlaser'}</span>
          <span>{vacancyLocation(filial)}</span>
          <span>{contratoLabels[vaga.tipo_contrato]}</span>
          <span>Prazo: {formatDate(vaga.data_limite)}</span>
        </div>

        <div className="jobs-card-actions">
          <button
            type="button"
            onClick={() => navegar(`/vagas/${vaga.id}`)}
          >
            Ver detalhes
          </button>

          <button
            className="primary"
            type="button"
            onClick={() => navegar(`/candidatar/${vaga.id}`)}
          >
            Enviar currículo
          </button>
        </div>
      </article>
    )
  }

  function renderApplicationForm() {
    const isTalentBank = view.type === 'talent-bank'
    const title = isTalentBank
      ? 'Enviar currículo para banco de talentos'
      : `Candidatar-se para ${vagaSelecionada?.cargo ?? 'vaga'}`

    return (
      <section className="jobs-form-section">
        <div className="jobs-form-intro">
          <span>Trabalhe conosco</span>
          <h1>{title}</h1>
          <p>
            Preencha seus dados e anexe seu currículo. O RH da
            Interlaser receberá as informações no sistema interno e o currículo será armazenado no Google Drive do RH.
          </p>
        </div>

        {!isTalentBank && vagaSelecionada && (
          <aside className="jobs-selected-vacancy">
            <strong>{vagaSelecionada.cargo}</strong>
            <span>{vagaSelecionada.setor}</span>
            <small>
              {contratoLabels[vagaSelecionada.tipo_contrato]} ·{' '}
              {modalidadeLabels[vagaSelecionada.modalidade]}
            </small>
          </aside>
        )}

        <form className="jobs-form" onSubmit={enviarCandidatura}>
          <div className="jobs-form-grid">
            <label>
              Nome completo *
              <input
                type="text"
                value={form.nomeCompleto}
                onChange={(event) =>
                  updateForm('nomeCompleto', event.target.value)
                }
                disabled={enviando}
                autoComplete="name"
              />
            </label>

            <label>
              E-mail *
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  updateForm('email', event.target.value)
                }
                disabled={enviando}
                autoComplete="email"
              />
            </label>

            <label>
              WhatsApp com DDD *
              <input
                type="tel"
                value={form.whatsapp}
                onChange={(event) =>
                  updateForm('whatsapp', event.target.value)
                }
                disabled={enviando}
                autoComplete="tel"
                placeholder="(19) 99999-9999"
              />
            </label>

            <label>
              Cidade
              <input
                type="text"
                value={form.cidade}
                onChange={(event) =>
                  updateForm('cidade', event.target.value)
                }
                disabled={enviando}
                autoComplete="address-level2"
              />
            </label>

            <label>
              UF
              <input
                type="text"
                value={form.uf}
                onChange={(event) =>
                  updateForm('uf', event.target.value.toUpperCase())
                }
                disabled={enviando}
                maxLength={2}
                autoComplete="address-level1"
                placeholder="SP"
              />
            </label>

            <label className="full">
              Currículo *
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleCurriculoChange}
                disabled={enviando}
              />
              <small>PDF, DOC ou DOCX até {MAX_FILE_SIZE_MB} MB. O arquivo será salvo no Google Drive do RH.</small>
            </label>

            <label className="full">
              Observação opcional
              <textarea
                value={form.observacoes}
                onChange={(event) =>
                  updateForm('observacoes', event.target.value)
                }
                disabled={enviando}
                rows={4}
                placeholder="Conte brevemente sua experiência, disponibilidade ou observações importantes."
              />
            </label>
          </div>

          <label className="jobs-consent">
            <input
              type="checkbox"
              checked={form.consentimento}
              onChange={(event) =>
                updateForm('consentimento', event.target.checked)
              }
              disabled={enviando}
            />
            <span>
              Autorizo a INTERLASER a armazenar meus dados pessoais e
              currículo para participação em processos seletivos, conforme
              a LGPD.
            </span>
          </label>

          {(erro || mensagem) && (
            <div
              className={`jobs-message ${erro ? 'error' : 'success'}`}
              role={erro ? 'alert' : 'status'}
            >
              {erro || mensagem}
            </div>
          )}

          <footer className="jobs-form-actions">
            <button
              type="button"
              onClick={() => navegar('/vagas')}
              disabled={enviando}
            >
              Voltar para vagas
            </button>

            <button
              className="primary"
              type="submit"
              disabled={enviando}
            >
              {enviando ? 'Enviando...' : 'Enviar currículo'}
            </button>
          </footer>
        </form>
      </section>
    )
  }

  function renderDetails() {
    if (carregando) {
      return <JobsLoading />
    }

    if (!vagaSelecionada) {
      return (
        <section className="jobs-empty-state">
          <strong>Vaga não encontrada</strong>
          <p>
            A vaga pode ter sido encerrada ou removida do portal público.
          </p>
          <button type="button" onClick={() => navegar('/vagas')}>
            Ver vagas abertas
          </button>
        </section>
      )
    }

    return (
      <section className="jobs-detail">
        <button
          className="jobs-back-button"
          type="button"
          onClick={() => navegar('/vagas')}
        >
          ← Voltar para vagas
        </button>

        <div className="jobs-detail-card">
          <span>{buildVacancyCode(vagaSelecionada.numero)}</span>
          <h1>{vagaSelecionada.cargo}</h1>
          <p>
            Oportunidade para atuação no setor de{' '}
            <strong>{vagaSelecionada.setor}</strong>.
          </p>

          <div className="jobs-detail-grid">
            <div>
              <small>Empresa</small>
              <strong>
                {empresaSelecionada?.nome_fantasia ?? 'Interlaser'}
              </strong>
            </div>
            <div>
              <small>Local</small>
              <strong>{vacancyLocation(filialSelecionada)}</strong>
            </div>
            <div>
              <small>Contrato</small>
              <strong>
                {contratoLabels[vagaSelecionada.tipo_contrato]}
              </strong>
            </div>
            <div>
              <small>Modalidade</small>
              <strong>
                {modalidadeLabels[vagaSelecionada.modalidade]}
              </strong>
            </div>
            <div>
              <small>Prazo</small>
              <strong>{formatDate(vagaSelecionada.data_limite)}</strong>
            </div>
          </div>

          <div className="jobs-detail-description">
            <h2>Como funciona a candidatura</h2>
            <p>
              Envie seus dados e currículo pelo formulário. O RH irá
              avaliar o perfil e, caso exista aderência à vaga, entrará em
              contato pelos canais informados.
            </p>
          </div>

          <button
            className="jobs-detail-cta"
            type="button"
            onClick={() => navegar(`/candidatar/${vagaSelecionada.id}`)}
          >
            Quero me candidatar
          </button>
        </div>
      </section>
    )
  }

  function renderList() {
    if (carregando) {
      return <JobsLoading />
    }

    return (
      <>
        <section className="jobs-hero">
          <div>
            <span>Trabalhe conosco</span>
            <h1>Faça parte do time Interlaser</h1>
            <p>
              Veja nossas vagas abertas ou envie seu currículo para o
              banco de talentos. O cadastro é simples, rápido e seguro.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navegar('/candidatura-espontanea')}
          >
            Enviar currículo espontâneo
          </button>
        </section>

        <section className="jobs-toolbar">
          <label htmlFor="busca-vagas">Buscar vaga</label>
          <input
            id="busca-vagas"
            type="search"
            value={pesquisa}
            onChange={(event) => setPesquisa(event.target.value)}
            placeholder="Cargo, setor ou cidade..."
          />
        </section>

        {(erro || mensagem) && (
          <div
            className={`jobs-message ${erro ? 'error' : 'success'}`}
            role={erro ? 'alert' : 'status'}
          >
            {erro || mensagem}
          </div>
        )}

        <section className="jobs-grid">
          {vagasFiltradas.map(renderVacancyCard)}
        </section>

        {vagasFiltradas.length === 0 && (
          <section className="jobs-empty-state">
            <strong>Nenhuma vaga aberta no momento</strong>
            <p>
              Você pode deixar seu currículo no banco de talentos para
              futuras oportunidades.
            </p>
            <button
              type="button"
              onClick={() => navegar('/candidatura-espontanea')}
            >
              Enviar currículo espontâneo
            </button>
          </section>
        )}
      </>
    )
  }

  return (
    <main className="jobs-public-page">
      <header className="jobs-public-header">
        <button
          className="jobs-brand"
          type="button"
          onClick={() => navegar('/vagas')}
        >
          <span>RH</span>
          <strong>Interlaser Máquinas</strong>
        </button>

        <nav>
          <button type="button" onClick={() => navegar('/vagas')}>
            Vagas abertas
          </button>
          <button
            type="button"
            onClick={() => navegar('/candidatura-espontanea')}
          >
            Banco de talentos
          </button>
          <a href="/">Área interna</a>
        </nav>
      </header>

      {view.type === 'list' && renderList()}
      {view.type === 'details' && renderDetails()}
      {(view.type === 'apply' || view.type === 'talent-bank') &&
        renderApplicationForm()}
    </main>
  )
}

function JobsLoading() {
  return (
    <section className="jobs-loading">
      <div>RH</div>
      <strong>Carregando vagas</strong>
      <p>Aguarde um instante...</p>
    </section>
  )
}

export default PortalVagas
