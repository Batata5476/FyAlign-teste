'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  X,
  Camera,
  Activity,
  Box,
  Layers,
  HelpCircle,
  FileText,
} from 'lucide-react';
import { SlotSchematicDrawing } from './SlotSchematicDrawing';

interface ClinicalProtocolExampleGuideProps {
  onGoToSlots: (category?: string) => void;
  completedSlotsCount: number;
  totalSlotsCount?: number;
}

interface ExampleCardMeta {
  slotNumber: number;
  title: string;
  category: 'EXTRAORAL' | 'INTRAORAL' | 'RADIOGRAPH' | 'SCAN_3D';
  badgeLabel: string;
  captionTip: string;
  framingGuide: string;
  acceptanceCriteria: string[];
  commonMistakes: string[];
  idealFormat: string;
}

const EXAMPLES_METADATA: ExampleCardMeta[] = [
  {
    slotNumber: 1,
    title: 'Foto frontal',
    category: 'EXTRAORAL',
    badgeLabel: 'Extraoral',
    captionTip: 'Repouso • Sem sorrir',
    framingGuide: 'Face frontal do paciente sem sorrir, lábios em posição natural de repouso, olhos abertos e plano de Camper paralelo ao solo.',
    acceptanceCriteria: [
      'Lábios relaxados em repouso sem tensão no queixo (mento)',
      'Plano bipupilar estritamente horizontal',
      'Iluminação uniforme sem sombras no fundo neutro cinza ou branco',
      'Cabelos presos atrás das orelhas e testa desobstruída',
    ],
    commonMistakes: [
      'Paciente sorrindo ou com boca entreaberta forçada',
      'Cabeça inclinada para os lados ou para baixo',
      'Uso de flash pontual com reflexo excessivo na pele',
    ],
    idealFormat: '.JPG ou .PNG de alta resolução',
  },
  {
    slotNumber: 2,
    title: 'Foto de perfil direito',
    category: 'EXTRAORAL',
    badgeLabel: 'Extraoral',
    captionTip: 'Perfil 90° rigoroso',
    framingGuide: 'Perfil lateral direito a 90° rigorosos. Postura neutra da cabeça com plano de Frankfurt horizontal paralelo ao solo.',
    acceptanceCriteria: [
      'Ângulo de 90° exato (não fotografar em semi-perfil)',
      'Contorno da ponta do nariz, lábios e mento nítidos',
      'Orelha direita desobstruída para referência craniofacial',
      'Coluna cervical relaxada na postura habitual',
    ],
    commonMistakes: [
      'Semi-perfil (aparecendo o outro olho ou sobrancelha)',
      'Queixo erguido ou abaixado alterando o perfil ósseo',
      'Cabelo cobrindo a orelha ou o contorno mandibular',
    ],
    idealFormat: '.JPG ou .PNG (90° estrito)',
  },
  {
    slotNumber: 3,
    title: 'Foto frontal sorrindo',
    category: 'EXTRAORAL',
    badgeLabel: 'Extraoral',
    captionTip: 'Sorriso espontâneo amplo',
    framingGuide: 'Face frontal com sorriso amplo espontâneo, evidenciando corredor bucal, exposição gengival e linha do sorriso.',
    acceptanceCriteria: [
      'Sorriso máximo e espontâneo do paciente',
      'Corredor bucal visível em ambos os lados',
      'Exibição nítida dos incisivos superiores e linha gengival',
      'Enquadramento frontal idêntico ao da foto em repouso',
    ],
    commonMistakes: [
      'Sorriso tímido ou "social" que não revela os dentes posteriores',
      'Lábio superior cobrindo a margem cervical dos incisivos',
      'Fotografia tremida ou fora de foco nos dentes',
    ],
    idealFormat: '.JPG ou .PNG de alta nitidez',
  },
  {
    slotNumber: 4,
    title: 'Mordida direita',
    category: 'INTRAORAL',
    badgeLabel: 'Intraoral',
    captionTip: 'Chave canino e molares D',
    framingGuide: 'Fotografia intraoral lateral direita com afastador em máxima intercuspidação habitual, focada na chave de canino e molares.',
    acceptanceCriteria: [
      'Foco nítido na relação molar e canina (Classe I, II ou III)',
      'Afastador tracionando o lábio para visualizar até o 1º/2º molar',
      'Dentes completamente secos, sem saliva ou espuma excessiva',
      'Plano oclusal horizontalizado na foto',
    ],
    commonMistakes: [
      'Paciente não ocluindo totalmente (mordida aberta forçada)',
      'Afastador labial cobrindo os molares posteriores',
      'Espelho ou lente embaçados por respiração bucal',
    ],
    idealFormat: '.JPG ou .PNG com afastador lateral',
  },
  {
    slotNumber: 5,
    title: 'Mordida anterior',
    category: 'INTRAORAL',
    badgeLabel: 'Intraoral',
    captionTip: 'Afastador duplo • Oclusão',
    framingGuide: 'Fotografia intraoral frontal com afastador labial duplo em máxima intercuspidação. Foco na linha média e trespasses.',
    acceptanceCriteria: [
      'Afastador labial duplo expondo de pré-molar a pré-molar',
      'Máxima intercuspidação habitual evidente (dentes fechados)',
      'Linha média dentária visível e sem sombras',
      'Sobremordida (overbite) e sobressaliência (overjet) avaliáveis',
    ],
    commonMistakes: [
      'Dentes em topo-a-topo em vez de oclusão cêntrica',
      'Lábios relaxando sobre os incisivos inferiores',
      'Iluminação deficiente causando penumbra nos molares',
    ],
    idealFormat: '.JPG ou .PNG (afastador duplo)',
  },
  {
    slotNumber: 6,
    title: 'Mordida esquerda',
    category: 'INTRAORAL',
    badgeLabel: 'Intraoral',
    captionTip: 'Chave canino e molares E',
    framingGuide: 'Fotografia intraoral lateral esquerda focada na chave de canino e molares do lado esquerdo em oclusão máxima.',
    acceptanceCriteria: [
      'Foco rigoroso na cúspide do canino superior e ranhura molar',
      'Visualização límpida do dente 23 ao 26/27 e 33 ao 36/37',
      'Ausência de resíduos alimentares ou saliva acumulada',
      'Paralelismo do plano oclusal',
    ],
    commonMistakes: [
      'Afastador frouxo escondendo a relação molar',
      'Ângulo oblíquo que distorce a chave de Classe',
    ],
    idealFormat: '.JPG ou .PNG com afastador lateral',
  },
  {
    slotNumber: 7,
    title: 'Oclusal superior',
    category: 'INTRAORAL',
    badgeLabel: 'Intraoral',
    captionTip: 'Arco superior • 17 ao 27',
    framingGuide: 'Espelho oclusal superior enquadrando todo o arco em ferradura, desde os incisivos centrais até os segundos molares superiores (17 a 27).',
    acceptanceCriteria: [
      'Visualização completa de todas as faces oclusais de 17 a 27',
      'Palato e rugas palatinas nítidas sem corte',
      'Espelho sem embaçamento térmico',
      'Lábio superior e afastador fora do campo dentário',
    ],
    commonMistakes: [
      'Corte dos segundos molares na parte posterior',
      'Dedo do operador ou borda do espelho cobrindo dentes',
      'Embaçamento por vapor respiratório',
    ],
    idealFormat: '.JPG ou .PNG com espelho oclusal aquecido',
  },
  {
    slotNumber: 8,
    title: 'Oclusal inferior',
    category: 'INTRAORAL',
    badgeLabel: 'Intraoral',
    captionTip: 'Arco inferior • 47 ao 37',
    framingGuide: 'Espelho oclusal inferior exibindo toda a arcada mandibular de 47 a 37, com a língua devidamente retraída para trás.',
    acceptanceCriteria: [
      'Todas as faces oclusais e bordas incisais inferiores visíveis',
      'Língua retraída para trás do espelho sem cobrir dentes',
      'Fundo de vestíbulo livre de afastadores sobrepostos',
    ],
    commonMistakes: [
      'Língua do paciente cobrindo as faces linguais dos molares',
      'Corte dos segundos molares',
      'Presença de excesso de saliva no assoalho bucal',
    ],
    idealFormat: '.JPG ou .PNG com espelho oclusal',
  },
  {
    slotNumber: 9,
    title: 'Radiografia panorâmica',
    category: 'RADIOGRAPH',
    badgeLabel: 'Radiografia',
    captionTip: 'Ortopantomografia recente',
    framingGuide: 'Ortopantomografia panorâmica digital recente (máx. 6 meses), nítida, com côndilos mandibulares e ápices radiculares visíveis.',
    acceptanceCriteria: [
      'Exame recente com menos de 6 meses de realização',
      'Côndilos mandibulares esquerdo e direito íntegros na imagem',
      'Ápices radiculares de todos os dentes visíveis sem cortes',
      'Ausência de sobreposição por colar de chumbo ou brincos metálicos',
    ],
    commonMistakes: [
      'Radiografia analógica fotografada com celular e reflexos',
      'Artefatos de movimento durante a tomada panorâmica',
      'Imagem cortada nos ápices dos dentes anteriores',
    ],
    idealFormat: '.JPG, .PNG ou .DCM original digital',
  },
  {
    slotNumber: 10,
    title: 'Radiografia lateral',
    category: 'RADIOGRAPH',
    badgeLabel: 'Radiografia',
    captionTip: 'Telerradiografia cefalométrica',
    framingGuide: 'Telerradiografia cefalométrica de perfil com contraste equilibrado entre tecidos ósseos e perfil mole para traçado digital.',
    acceptanceCriteria: [
      'Sela túrcica, násio e perfil mole visíveis com clareza',
      'Dentes em máxima intercuspidação habitual',
      'Oliva auricular e posicionador cefalométrico ajustados',
      'Contraste calibrado para análise esquelética computadorizada',
    ],
    commonMistakes: [
      'Perfil mole apagado por superexposição radiológica',
      'Paciente em oclusão incorreta durante a tomada',
    ],
    idealFormat: '.JPG, .PNG ou .DCM original digital',
  },
  {
    slotNumber: 11,
    title: 'Escaneamento superior',
    category: 'SCAN_3D',
    badgeLabel: 'Malha 3D',
    captionTip: 'Malha digital (.STL / .OBJ)',
    framingGuide: 'Malha tridimensional digital (.STL, .PLY ou .OBJ) da arcada superior completa, incluindo fundo de vestíbulo e anatomia palatina.',
    acceptanceCriteria: [
      'Malha limpa sem furos, degraus ou artefatos de movimento',
      'Palato e margem gengival livre escaneados com perfeição',
      'Superfície oclusal nítida com cúspides bem definidas',
      'Arquivo exportado em oclusão desarticulada ou coordenada',
    ],
    commonMistakes: [
      'Furos na região interproximal ou no palato duro',
      'Excesso de tecido mole móvel (bochecha) capturado na malha',
    ],
    idealFormat: '.STL, .PLY ou .OBJ fechado (sem buracos)',
  },
  {
    slotNumber: 12,
    title: 'Escaneamento inferior',
    category: 'SCAN_3D',
    badgeLabel: 'Malha 3D',
    captionTip: 'Malha digital (.STL / .OBJ)',
    framingGuide: 'Malha tridimensional digital da arcada inferior, capturando do dente 47 ao 37, com trígonos retromolares e gengiva inserida.',
    acceptanceCriteria: [
      'Bordas incisais e ameias interproximais nítidas',
      'Gengiva inserida vestibular e lingual bem delineadas',
      'Ausência de dobras ou deformidades por saliva na lente',
    ],
    commonMistakes: [
      'Língua capturada como parte da arcada dentária',
      'Áreas ausentes na face lingual dos molares inferiores',
    ],
    idealFormat: '.STL, .PLY ou .OBJ fechado',
  },
  {
    slotNumber: 13,
    title: 'Registro oclusal (Bite)',
    category: 'SCAN_3D',
    badgeLabel: 'Malha 3D',
    captionTip: 'Bite Scan articulado 3D',
    framingGuide: 'Escaneamento intraoral do registro de mordida (Bite Scan bilateral) para articulação perfeita das duas arcadas no software 3D.',
    acceptanceCriteria: [
      'Registro bilateral (lado direito e esquerdo capturados)',
      'Arcadas se encaixando na posição exata da mordida clínica real',
      'Sem interferência de espaçadores ou dentes em falso contato',
    ],
    commonMistakes: [
      'Registro unilateral causando torção na articulação digital',
      'Mordida capturada com paciente em topo ou postura anteriorizada',
    ],
    idealFormat: '.STL, .PLY ou arquivo de mordida articulada',
  },
];

export function ClinicalProtocolExampleGuide({
  onGoToSlots,
  completedSlotsCount,
  totalSlotsCount = 13,
}: ClinicalProtocolExampleGuideProps) {
  const [selectedModalSlot, setSelectedModalSlot] = useState<ExampleCardMeta | null>(null);

  // Helper para obter estilos de categoria harmonizados com o resto do sistema
  const getCategoryTheme = (category: string) => {
    switch (category) {
      case 'SCAN_3D':
        return {
          bg: 'var(--badge-setup-bg)',
          text: 'var(--cyan-primary)',
          border: 'var(--badge-setup-border)',
        };
      case 'RADIOGRAPH':
        return {
          bg: 'rgba(147, 51, 234, 0.1)',
          text: '#9333ea',
          border: 'rgba(147, 51, 234, 0.25)',
        };
      case 'INTRAORAL':
        return {
          bg: 'rgba(2, 132, 199, 0.1)',
          text: '#0284c7',
          border: 'rgba(2, 132, 199, 0.25)',
        };
      case 'EXTRAORAL':
      default:
        return {
          bg: 'rgba(99, 102, 241, 0.1)',
          text: '#6366f1',
          border: 'rgba(99, 102, 241, 0.25)',
        };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Banner de Apresentação — Usando tokens do sistema (--bg-card, --border-card, etc.) */}
      <div
        style={{
          borderRadius: '12px',
          padding: '22px 26px',
          background: 'var(--bg-card)',
          border: '1.5px solid var(--border-hover)',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '18px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: '680px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 10px',
                borderRadius: '999px',
                background: 'var(--badge-setup-bg)',
                border: '1px solid var(--badge-setup-border)',
                color: 'var(--cyan-primary)',
                fontSize: '0.76rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              <Sparkles size={13} />
              <span>Padrão Clínico FyAlign</span>
            </span>

            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              • Guia Visual do Protocolo de 13 Slots
            </span>
          </div>

          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '6px', lineHeight: 1.3 }}>
            Exemplo de Preenchimento — Matriz Visual do Protocolo
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>
            Consulte os ângulos, enquadramento e afastadores exigidos para cada arquivo antes de iniciar os uploads.
            Clique em qualquer card para ver critérios de aceite e erros frequentes.
          </p>
        </div>

        {/* CTA para avançar diretamente aos slots */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
          <button
            type="button"
            onClick={() => onGoToSlots('ALL')}
            className="btn-primary"
            style={{
              padding: '11px 22px',
              fontSize: '0.9rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: 'var(--shadow-glow)',
              borderRadius: '8px',
            }}
          >
            <span>Preencher Meus Slots ({completedSlotsCount}/{totalSlotsCount})</span>
            <ArrowRight size={16} />
          </button>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            Ou use os botões rápidos de categoria abaixo.
          </span>
        </div>
      </div>

      {/* MATRIZ CLÍNICA DOS 13 SLOTS (Com as mesmas cores do sistema: var(--bg-card), var(--input-bg)) */}
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: '14px',
          border: '1px solid var(--border-card)',
          padding: '20px',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Barra Superior da Matriz */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: '14px',
            borderBottom: '1px solid var(--border-subtle)',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: 'var(--cyan-primary)',
                boxShadow: '0 0 8px var(--cyan-primary)',
              }}
            />
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '0.4px' }}>
              MATRIZ DO PROTOCOLO CLÍNICO (13 ARQUIVOS)
            </span>
          </div>

          {/* Atalhos para preencher por categoria */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onGoToSlots('EXTRAORAL')}
              style={{
                background: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                color: '#6366f1',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Camera size={13} />
              <span>Extraorais (3)</span>
            </button>
            <button
              type="button"
              onClick={() => onGoToSlots('INTRAORAL')}
              style={{
                background: 'rgba(2, 132, 199, 0.1)',
                border: '1px solid rgba(2, 132, 199, 0.25)',
                color: '#0284c7',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Activity size={13} />
              <span>Intraorais (5)</span>
            </button>
            <button
              type="button"
              onClick={() => onGoToSlots('RADIOGRAPH')}
              style={{
                background: 'rgba(147, 51, 234, 0.1)',
                border: '1px solid rgba(147, 51, 234, 0.25)',
                color: '#9333ea',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <FileText size={13} />
              <span>Radiografias (2)</span>
            </button>
            <button
              type="button"
              onClick={() => onGoToSlots('SCAN_3D')}
              style={{
                background: 'var(--badge-setup-bg)',
                border: '1px solid var(--badge-setup-border)',
                color: 'var(--cyan-primary)',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Box size={13} />
              <span>Scan 3D (3)</span>
            </button>
          </div>
        </div>

        {/* ESTRUTURA DOS 13 SLOTS EM 4 NÍVEIS — PERFEITA HARMONIA COM O RESTO DO SISTEMA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* LINHA 1: SLOTS 1, 2, 3 (FOTOS EXTRAORAIS) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {EXAMPLES_METADATA.slice(0, 3).map((item) => (
              <ProtocolCard
                key={item.slotNumber}
                item={item}
                categoryTheme={getCategoryTheme(item.category)}
                onClick={() => setSelectedModalSlot(item)}
              />
            ))}
          </div>

          {/* LINHA 2: SLOTS 4, 5, 6 (FOTOS INTRAORAIS FRONTAL E LATERAIS) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {EXAMPLES_METADATA.slice(3, 6).map((item) => (
              <ProtocolCard
                key={item.slotNumber}
                item={item}
                categoryTheme={getCategoryTheme(item.category)}
                onClick={() => setSelectedModalSlot(item)}
              />
            ))}
          </div>

          {/* LINHA 3: SLOTS 7, 8 (FOTOS INTRAORAIS OCLUSAIS) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '14px' }}>
            {EXAMPLES_METADATA.slice(6, 8).map((item) => (
              <ProtocolCard
                key={item.slotNumber}
                item={item}
                categoryTheme={getCategoryTheme(item.category)}
                onClick={() => setSelectedModalSlot(item)}
              />
            ))}
          </div>

          {/* LINHA 4: SLOTS 9, 10, 11, 12, 13 (RADIOGRAFIAS E ESCANEAMENTOS 3D) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            {EXAMPLES_METADATA.slice(8, 13).map((item) => (
              <ProtocolCard
                key={item.slotNumber}
                item={item}
                categoryTheme={getCategoryTheme(item.category)}
                onClick={() => setSelectedModalSlot(item)}
              />
            ))}
          </div>
        </div>

        {/* Rodapé da Matriz com Logo FyAlign */}
        <div
          style={{
            marginTop: '10px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                border: '2px solid var(--cyan-primary)',
                boxShadow: '0 0 10px var(--cyan-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: 'var(--cyan-primary)',
                }}
              />
            </div>
            <div>
              <span
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 900,
                  letterSpacing: '0.6px',
                  color: 'var(--text-main)',
                }}
              >
                Fy<span style={{ color: 'var(--cyan-primary)' }}>Align</span>
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                Protocolo Fotográfico e Clínico de Precisão
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Pronto para preencher seus slots?
            </span>
            <button
              type="button"
              onClick={() => onGoToSlots('ALL')}
              className="btn-primary"
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                fontSize: '0.86rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>Ir para Upload dos Slots</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* GUIA DE RECOMENDAÇÕES TÉCNICAS RÁPIDAS (Cores padrão do sistema) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        <div
          style={{
            padding: '18px 20px',
            borderRadius: '12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.12)',
                color: '#6366f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Camera size={17} />
            </div>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Fotografia Extraoral (Slots 1, 2, 3)
            </h4>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45, margin: 0 }}>
            Distância padrão de 1,5m em fundo neutro cinza ou branco. No perfil rigoroso a 90°, assegure a exposição da orelha direita e plano de Frankfurt paralelo ao solo.
          </p>
        </div>

        <div
          style={{
            padding: '18px 20px',
            borderRadius: '12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(2, 132, 199, 0.12)',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Activity size={17} />
            </div>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Fotografia Intraoral (Slots 4 a 8)
            </h4>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45, margin: 0 }}>
            Utilize afastadores transparentes estéreis. Seque os dentes com jato de ar leve para evitar reflexos salivares e utilize espelhos oclusais aquecidos contra embaçamento.
          </p>
        </div>

        <div
          style={{
            padding: '18px 20px',
            borderRadius: '12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--badge-setup-bg)',
                color: 'var(--cyan-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Box size={17} />
            </div>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Escaneamento Digital 3D (Slots 11 a 13)
            </h4>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45, margin: 0 }}>
            Aceitos arquivos .STL, .PLY ou .OBJ. Certifique-se de que a malha não possua furos e capture o registro de mordida bilateral para a perfeita articulação no software.
          </p>
        </div>
      </div>

      {/* MODAL DETALHADO DO CRITÉRIO DE ACEITE */}
      {selectedModalSlot && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setSelectedModalSlot(null)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '640px',
              padding: '24px',
              borderRadius: '14px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              boxShadow: 'var(--shadow-elevated)',
              position: 'relative',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '32px',
                    height: '28px',
                    padding: '0 8px',
                    borderRadius: '6px',
                    background: 'var(--cyan-primary)',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    fontSize: '0.88rem',
                  }}
                >
                  #{selectedModalSlot.slotNumber}
                </span>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    {selectedModalSlot.title}
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Categoria: {selectedModalSlot.badgeLabel} • Formato: {selectedModalSlot.idealFormat}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedModalSlot(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Ilustração Visual do Slot em Alta Resolução */}
            <div
              style={{
                borderRadius: '10px',
                background: 'var(--input-bg)',
                border: '1px solid var(--border-subtle)',
                padding: '20px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: '18px',
              }}
            >
              <SlotSchematicDrawing
                slotNumber={selectedModalSlot.slotNumber}
                width={240}
                height={140}
              />
            </div>

            {/* Enquadramento */}
            <div style={{ marginBottom: '16px' }}>
              <h5 style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                Enquadramento Técnico
              </h5>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {selectedModalSlot.framingGuide}
              </p>
            </div>

            {/* Critérios de Aceite */}
            <div style={{ marginBottom: '16px' }}>
              <h5 style={{ fontSize: '0.86rem', fontWeight: 700, color: '#059669', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={16} />
                <span>Critérios de Aceite Obrigatórios</span>
              </h5>
              <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {selectedModalSlot.acceptanceCriteria.map((crit, idx) => (
                  <li key={idx} style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.4 }}>
                    {crit}
                  </li>
                ))}
              </ul>
            </div>

            {/* Erros a Evitar */}
            <div style={{ marginBottom: '20px' }}>
              <h5 style={{ fontSize: '0.86rem', fontWeight: 700, color: '#e11d48', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={16} />
                <span>Erros Comuns a Evitar</span>
              </h5>
              <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {selectedModalSlot.commonMistakes.map((err, idx) => (
                  <li key={idx} style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {err}
                  </li>
                ))}
              </ul>
            </div>

            {/* Ações */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => setSelectedModalSlot(null)}
                className="btn-secondary"
                style={{ fontSize: '0.85rem' }}
              >
                Voltar à Matriz
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedModalSlot(null);
                  onGoToSlots('ALL');
                }}
                className="btn-primary"
                style={{
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>Fazer Upload do Slot #{selectedModalSlot.slotNumber}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponente de Card Individual na Matriz
function ProtocolCard({
  item,
  categoryTheme,
  onClick,
}: {
  item: ExampleCardMeta;
  categoryTheme: { bg: string; text: string; border: string };
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: '10px',
        border: '1px solid var(--border-card)',
        background: 'var(--input-bg)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.borderColor = 'var(--cyan-primary)';
        e.currentTarget.style.boxShadow = 'var(--shadow-card)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = 'var(--border-card)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
      }}
    >
      {/* Top Header do Card: Número do Slot + Título + Categoria */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-subtle)',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0, flex: 1 }}>
          <span
            style={{
              fontFamily: 'monospace',
              fontWeight: 800,
              fontSize: '0.8rem',
              color: 'var(--cyan-primary)',
              background: 'var(--badge-setup-bg)',
              padding: '1px 6px',
              borderRadius: '4px',
              border: '1px solid var(--badge-setup-border)',
              flexShrink: 0,
            }}
          >
            #{item.slotNumber}
          </span>
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: 'var(--text-main)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.title}
          </span>
        </div>

        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '999px',
            background: categoryTheme.bg,
            color: categoryTheme.text,
            border: `1px solid ${categoryTheme.border}`,
            textTransform: 'uppercase',
            letterSpacing: '0.3px',
            flexShrink: 0,
          }}
        >
          {item.badgeLabel}
        </span>
      </div>

      {/* Desenho Anatômico com as cores do sistema */}
      <div
        style={{
          padding: '10px 14px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        <SlotSchematicDrawing
          slotNumber={item.slotNumber}
          height={90}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '6px',
            right: '8px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '4px',
            padding: '2px 5px',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--cyan-primary)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <ZoomIn size={12} />
        </div>
      </div>

      {/* Legenda Informativa Rápida no Rodapé do Card */}
      <div
        style={{
          padding: '5px 10px',
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
          fontWeight: 600,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {item.captionTip}
      </div>
    </div>
  );
}
