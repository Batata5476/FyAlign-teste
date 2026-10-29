import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, FileText } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-main)', padding: '40px 20px' }}>
      <div style={{ maxWidth: '840px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <Link href="/" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
            <ArrowLeft size={16} /> Voltar ao Portal
          </Link>
          <ThemeToggle />
        </div>

        <div className="glass-panel" style={{ padding: '36px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <FileText size={28} color="var(--cyan-primary)" />
            <h1 style={{ fontSize: '1.7rem', fontWeight: 800 }}>Termos de Adesão e Uso B2B - Portal FyAlign</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '24px' }}>
            Última atualização: Outubro de 2026 • Em conformidade com o Código de Ética Odontológica (CFO) e LGPD (Lei 13.709/18).
          </p>

          <section style={{ marginBottom: '24px', lineHeight: 1.6, fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
            <h3 style={{ color: 'var(--cyan-primary)', fontSize: '1.15rem', marginBottom: '8px' }}>1. Objeto e Natureza dos Serviços</h3>
            <p>
              A plataforma <strong>FyAlign B2B</strong> provê infraestrutura tecnológica em nuvem, planejamento tridimensional assistido por computador (CAD) e manufatura aditiva de alinhadores ortodônticos invisíveis sob encomenda para clínicas e Cirurgiões-Dentistas devidamente credenciados.
            </p>
          </section>

          <section style={{ marginBottom: '24px', lineHeight: 1.6, fontSize: '0.92rem', color: '#cbd5e1' }}>
            <h3 style={{ color: 'var(--cyan-primary)', fontSize: '1.15rem', marginBottom: '8px' }}>2. Responsabilidade Técnica e Legal Odontológica (RN-02)</h3>
            <p>
              O diagnóstico, indicação clínica, plano de movimentação dentária, aprovação do Setup Virtual e acompanhamento presencial do tratamento são de competência e responsabilidade exclusiva do <strong>Cirurgião-Dentista Responsável</strong>, devidamente inscrito no Conselho Regional de Odontologia (CRO). A equipe da FyAlign atua estritamente como suporte técnico e laboratorial.
            </p>
          </section>

          <section style={{ marginBottom: '24px', lineHeight: 1.6, fontSize: '0.92rem', color: '#cbd5e1' }}>
            <h3 style={{ color: 'var(--cyan-primary)', fontSize: '1.15rem', marginBottom: '8px' }}>3. Termo de Consentimento Livre e Esclarecido (TCLE)</h3>
            <p>
              A clínica parceira compromete-se a coletar e manter arquivado o TCLE físico ou digital assinado pelo paciente ou seu responsável legal antes de iniciar a transmissão de dados ou escaneamentos (RN-05).
            </p>
          </section>

          <section style={{ marginBottom: '24px', lineHeight: 1.6, fontSize: '0.92rem', color: '#cbd5e1' }}>
            <h3 style={{ color: 'var(--cyan-primary)', fontSize: '1.15rem', marginBottom: '8px' }}>4. Imutabilidade e Ordens de Produção (RN-03)</h3>
            <p>
              Uma vez aprovado formalmente o Setup Virtual 3D pelo Cirurgião-Dentista com seu carimbo eletrônico, o caso entra imediatamente em fase de manufatura (termoformagem e corte a laser), tornando-se imutável. Eventuais alterações posteriores requererão solicitação de refinamento vinculado.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
