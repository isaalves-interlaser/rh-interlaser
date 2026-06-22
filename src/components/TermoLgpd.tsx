import './PortalVagas.css'

function TermoLgpd() {
  return (
    <main className="jobs-public-page">
      <header className="jobs-public-header">
        <a className="jobs-brand" href="/vagas">
          <span>RH</span>
          <strong>Interlaser Máquinas</strong>
        </a>

        <nav>
          <a href="/vagas">Vagas abertas</a>
          <a href="/candidatura-espontanea">Banco de talentos</a>
          <a href="/">Área interna</a>
        </nav>
      </header>

      <section className="jobs-terms-hero">
        <span>LGPD · Versão LGPD-RH-001</span>
        <h1>Termo de Consentimento para Tratamento de Dados Pessoais</h1>
        <p>
          Este termo explica como a INTERLASER MÁQUINAS utiliza os dados
          enviados por candidatos no portal de vagas para processos seletivos
          atuais e futuros.
        </p>
      </section>

      <article className="jobs-terms-card">
        <div className="jobs-terms-summary">
          <div>
            <small>Empresa</small>
            <strong>INTERLASER MÁQUINAS</strong>
          </div>
          <div>
            <small>Finalidade</small>
            <strong>Recrutamento, seleção e banco de talentos</strong>
          </div>
          <div>
            <small>Versão do termo</small>
            <strong>LGPD-RH-001</strong>
          </div>
        </div>

        <section>
          <h2>1. Dados coletados</h2>
          <p>
            A INTERLASER poderá coletar e tratar dados como nome completo,
            e-mail, telefone/WhatsApp, cidade, currículo, experiências
            profissionais, cursos, qualificações e demais informações
            fornecidas voluntariamente pelo candidato durante o processo
            seletivo.
          </p>
        </section>

        <section>
          <h2>2. Finalidade do tratamento</h2>
          <p>
            Os dados serão utilizados para análise do perfil profissional,
            participação em processos seletivos, contato com o candidato,
            agendamento de entrevistas, testes, exames e formação de banco de
            talentos para futuras oportunidades.
          </p>
        </section>

        <section>
          <h2>3. Compartilhamento dos dados</h2>
          <p>
            Os dados poderão ser acessados por profissionais autorizados do
            Recursos Humanos, gestores envolvidos no processo seletivo e áreas
            internas relacionadas à contratação. A INTERLASER não comercializa
            dados pessoais de candidatos.
          </p>
        </section>

        <section>
          <h2>4. Armazenamento dos dados</h2>
          <p>
            Os dados e currículos poderão ser armazenados em sistemas internos,
            banco de dados da empresa e ambiente corporativo de armazenamento em
            nuvem, como Google Drive ou ferramenta equivalente utilizada pela
            INTERLASER.
          </p>
        </section>

        <section>
          <h2>5. Prazo de retenção</h2>
          <p>
            Os dados poderão ser mantidos durante o processo seletivo e, caso o
            candidato não seja contratado, poderão permanecer no banco de
            talentos pelo prazo de até 24 meses, salvo solicitação de exclusão
            pelo próprio candidato ou necessidade de retenção por obrigação
            legal.
          </p>
        </section>

        <section>
          <h2>6. Direitos do candidato</h2>
          <p>
            O candidato poderá solicitar acesso, correção, atualização, exclusão
            dos dados ou revogação do consentimento, conforme previsto na
            legislação aplicável.
          </p>
        </section>

        <section>
          <h2>7. Consentimento</h2>
          <p>
            Ao marcar a opção de aceite e enviar o currículo, o candidato declara
            estar ciente e de acordo com o tratamento dos seus dados pessoais
            pela INTERLASER para as finalidades descritas neste termo.
          </p>
        </section>

        <footer className="jobs-terms-actions">
          <a className="jobs-detail-cta" href="/vagas">
            Voltar para vagas
          </a>
          <a className="jobs-terms-secondary" href="/candidatura-espontanea">
            Enviar currículo para banco de talentos
          </a>
        </footer>
      </article>
    </main>
  )
}

export default TermoLgpd
