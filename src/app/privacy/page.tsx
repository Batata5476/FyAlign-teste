import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, Lock, Database } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function PrivacyPage() {
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
            <Shield size={28} color="var(--emerald-success)" />
            <h1 style={{ fontSize: '1.7rem', fontWeight: 800 }}>Política de Privacidade & Proteção de Dados de Saúde</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '24px' }}>
            Em conformidade estrita com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD) e as Resoluções do CFO.
          </p>

          <section style={{ marginBottom: '24px', lineHeight: 1.6, fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
            <h3 style={{ color: 'var(--green-emerald)', fontSize: '1.15rem', marginBottom: '8px' }}>1. Tratamento de Dados Pessoais Sensíveis de Saúde</h3>
            <p>
              Os dados coletados (fotografias intraorais e extraorais, radiografias panorâmicas e escaneamentos 3D de arcadas) constituem <strong>dados sensíveis de saúde</strong> (Art. 5º, II da LGPD) e são processados com a finalidade exclusiva de tutela da saúde e planejamento ortodôntico personalizado.
            </p>
          </section>

          <section style={{ marginBottom: '24px', lineHeight: 1.6, fontSize: '0.92rem', color: '#cbd5e1' }}>
            <h3 style={{ color: 'var(--green-emerald)', fontSize: '1.15rem', marginBottom: '8px' }}>2. Política de Anonimização no Armazenamento (F6.03)</h3>
            <p>
              Nenhum exame radiográfico ou arquivo de malha 3D (.STL/.PLY) é armazenado com nomes próprios, CPFs ou dados identificáveis no nome físico do arquivo ou na chave do bucket S3. Todos os arquivos recebem identificadores únicos gerados criptograficamente através de <strong>UUIDv4</strong> e são isolados por partição de clínica.
            </p>
          </section>

          <section style={{ marginBottom: '24px', lineHeight: 1.6, fontSize: '0.92rem', color: '#cbd5e1' }}>
            <h3 style={{ color: 'var(--green-emerald)', fontSize: '1.15rem', marginBottom: '8px' }}>3. Padrões de Segurança Criptográfica (F6.01 e F6.02)</h3>
            <p>
              Todos os dados trafegam exclusivamente por conexões criptografadas com protocolo <strong>TLS 1.3</strong> e cabeçalhos forçados de HSTS e CSP. Em repouso, todos os volumes de banco de dados e repositórios de exames são protegidos por criptografia de padrão militar <strong>AES-256</strong>.
            </p>
          </section>

          <section style={{ marginBottom: '24px', lineHeight: 1.6, fontSize: '0.92rem', color: '#cbd5e1' }}>
            <h3 style={{ color: 'var(--green-emerald)', fontSize: '1.15rem', marginBottom: '8px' }}>4. Prazo de Retenção e Guarda Obrigatória (RNF-08)</h3>
            <p>
              Em obediência ao Código de Ética Odontológica e às normas sanitárias vigentes, os prontuários, prescrições eletrônicas e registros de setup virtual são mantidos sob custódia segura e trilha de auditoria inalterável por um prazo mínimo de <strong>5 (cinco) anos</strong>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
