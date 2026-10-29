'use client';

import React from 'react';

interface SlotSchematicDrawingProps {
  slotNumber: number;
  width?: number | string;
  height?: number | string;
  className?: string;
  accentColor?: string;
}

export function SlotSchematicDrawing({
  slotNumber,
  width = '100%',
  height = 96,
  className = '',
  accentColor = 'var(--cyan-primary)',
}: SlotSchematicDrawingProps) {
  // Paleta harmonizada com as cores do sistema FyAlign
  const strokeColor = accentColor;
  const secondaryStroke = 'var(--text-muted)';
  const skinFill = 'var(--input-bg)';
  const toothFill = '#ffffff';
  const toothStroke = 'var(--text-secondary)';
  const gumColor = 'rgba(244, 114, 182, 0.22)';
  const oralCavity = '#090e17';
  const cyanTint = 'rgba(0, 210, 211, 0.12)';
  const blueTint = 'rgba(2, 132, 199, 0.12)';
  const retractorColor = 'rgba(0, 210, 211, 0.28)';

  switch (slotNumber) {
    // ----------------------------------------------------
    // SLOT 1: FOTO FRONTAL EM REPOUSO (Face neutra, sem sorrir)
    // ----------------------------------------------------
    case 1:
      return (
        <svg
          viewBox="0 0 120 96"
          width={width}
          height={height}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Fundo sutil do card do desenho */}
          <rect width="120" height="96" rx="8" fill="var(--input-bg)" />

          {/* Silhueta anatômica da face frontal */}
          <path
            d="M60 12 C42 12 34 26 34 48 C34 68 46 82 60 82 C74 82 86 68 86 48 C86 26 78 12 60 12 Z"
            stroke={strokeColor}
            strokeWidth="1.8"
            fill={cyanTint}
          />
          {/* Orelhas simétricas */}
          <path d="M34 42 C30 42 30 54 34 54" stroke={secondaryStroke} strokeWidth="1.4" strokeLinecap="round" />
          <path d="M86 42 C90 42 90 54 86 54" stroke={secondaryStroke} strokeWidth="1.4" strokeLinecap="round" />

          {/* Contorno do cabelo / fronte */}
          <path
            d="M36 34 C42 20 52 16 60 16 C68 16 78 20 84 34"
            stroke={strokeColor}
            strokeWidth="1.4"
            strokeLinecap="round"
          />

          {/* Olhos alinhados horizontalmente (Plano bipupilar) */}
          <ellipse cx="48" cy="42" rx="4" ry="2.2" stroke={secondaryStroke} strokeWidth="1.3" />
          <circle cx="48" cy="42" r="1.3" fill="var(--text-main)" />
          <ellipse cx="72" cy="42" rx="4" ry="2.2" stroke={secondaryStroke} strokeWidth="1.3" />
          <circle cx="72" cy="42" r="1.3" fill="var(--text-main)" />

          {/* Sobrancelhas neutras */}
          <path d="M43 36 Q48 34 53 36" stroke={secondaryStroke} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M67 36 Q72 34 77 36" stroke={secondaryStroke} strokeWidth="1.5" strokeLinecap="round" />

          {/* Nariz anatômico com asas nasais */}
          <path d="M60 41 L59 52 C57 54 63 54 61 52" stroke={strokeColor} strokeWidth="1.4" strokeLinecap="round" />

          {/* Lábios relaxados em repouso (sem tensão, fenda labial neutra) */}
          <path d="M54 62 Q60 60.5 66 62" stroke={secondaryStroke} strokeWidth="1" strokeLinecap="round" />
          <path d="M51 64.5 Q60 64 69 64.5" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
          <path d="M54 67 Q60 68.5 66 67" stroke={secondaryStroke} strokeWidth="1.2" strokeLinecap="round" />

          {/* Linha horizontal de referência do plano bipupilar */}
          <line x1="20" y1="42" x2="26" y2="42" stroke={strokeColor} strokeWidth="1.2" strokeDasharray="2 1.5" />
          <line x1="94" y1="42" x2="100" y2="42" stroke={strokeColor} strokeWidth="1.2" strokeDasharray="2 1.5" />
        </svg>
      );

    // ----------------------------------------------------
    // SLOT 2: FOTO PERFIL DIREITO (90° rigoroso)
    // ----------------------------------------------------
    case 2:
      return (
        <svg
          viewBox="0 0 120 96"
          width={width}
          height={height}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="120" height="96" rx="8" fill="var(--input-bg)" />

          {/* Linha horizontal do Plano de Frankfurt (referência ortodôntica 90° estrita) */}
          <line
            x1="22"
            y1="43"
            x2="90"
            y2="43"
            stroke={strokeColor}
            strokeWidth="1.2"
            strokeDasharray="2 2"
            strokeOpacity="0.85"
          />

          {/* Silhueta anatômica de perfil a 90° virada para a direita (Linhas estéticas ortodônticas) */}
          <path
            d="M 38 84
               C 37 76, 35 66, 33 54
               C 31 38, 34 25, 45 17
               C 53 12, 64 12, 71 16
               C 77 20, 79 26, 79 32
               C 79 35, 78 37, 77 38.5
               L 85 45
               C 84 47.5, 80 48.5, 77.5 50
               C 80 51.5, 80 53.5, 77 55
               L 75 56
               C 77 57.5, 77 59.5, 75 61
               C 72.5 62.5, 72 64.5, 74 67
               C 75.5 69.5, 74 72.5, 70.5 74.5
               C 66 76.5, 58 75.5, 53 73
               C 50 74.5, 49 78, 49 84"
            stroke={strokeColor}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={cyanTint}
          />

          {/* Orelha anatômica em perfil (alinhada ao plano horizontal) */}
          <path
            d="M 48 42
               C 44 42, 42 45, 42 49.5
               C 42 54, 44 56.5, 47 56.5
               C 48 56.5, 48.5 54.5, 47.5 52.5"
            stroke={strokeColor}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M 45 47 C 43.5 48.5, 44 50, 46 51"
            stroke={secondaryStroke}
            strokeWidth="1.3"
            strokeLinecap="round"
          />

          {/* Olho em perfil relaxado */}
          <path d="M 67 38.5 L 72 37 L 71 40 Z" fill="var(--text-main)" />
          <path d="M 65 37.5 Q 69 36.2 73 38.2" stroke="var(--text-secondary)" strokeWidth="1.3" strokeLinecap="round" />

          {/* Sobrancelha em perfil */}
          <path d="M 65 33 Q 70 31.5 75.5 34" stroke="var(--text-secondary)" strokeWidth="1.8" strokeLinecap="round" />

          {/* Indicador 90° Cefalométrico moderno */}
          <g transform="translate(92, 14)">
            <circle cx="11" cy="11" r="10" fill="var(--bg-card)" stroke={strokeColor} strokeWidth="1.4" />
            <line x1="11" y1="4" x2="11" y2="18" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" />
            <line x1="4" y1="11" x2="18" y2="11" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" />
            <rect x="0" y="23" width="22" height="12" rx="3" fill={strokeColor} />
            <text x="11" y="32" fill="#ffffff" fontSize="8" fontWeight="800" fontFamily="sans-serif" textAnchor="middle">
              90°
            </text>
          </g>
        </svg>
      );

    // ----------------------------------------------------
    // SLOT 3: FOTO FRONTAL SORRINDO (Sorriso espontâneo amplo)
    // ----------------------------------------------------
    case 3:
      return (
        <svg
          viewBox="0 0 120 96"
          width={width}
          height={height}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="120" height="96" rx="8" fill="var(--input-bg)" />

          {/* Silhueta da face */}
          <path
            d="M60 12 C42 12 34 26 34 48 C34 68 46 82 60 82 C74 82 86 68 86 48 C86 26 78 12 60 12 Z"
            stroke={strokeColor}
            strokeWidth="1.8"
            fill={cyanTint}
          />

          {/* Cabelo */}
          <path
            d="M36 34 C42 20 52 16 60 16 C68 16 78 20 84 34"
            stroke={strokeColor}
            strokeWidth="1.4"
            strokeLinecap="round"
          />

          {/* Olhos expressivos com formato de sorriso */}
          <path d="M44 42 Q48 38 52 42" stroke={secondaryStroke} strokeWidth="2" strokeLinecap="round" />
          <path d="M68 42 Q72 38 76 42" stroke={secondaryStroke} strokeWidth="2" strokeLinecap="round" />

          {/* Sobrancelhas erguidas levemente */}
          <path d="M43 35 Q48 33 53 35" stroke={secondaryStroke} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M67 35 Q72 33 77 35" stroke={secondaryStroke} strokeWidth="1.5" strokeLinecap="round" />

          {/* Nariz */}
          <path d="M60 41 L59 52 C57 54 63 54 61 52" stroke={strokeColor} strokeWidth="1.4" strokeLinecap="round" />

          {/* Abertura do sorriso amplo com cavidade oral escura */}
          <path
            d="M46 60 Q60 75 74 60 Q60 61.5 46 60 Z"
            fill={oralCavity}
            stroke={strokeColor}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />

          {/* Arco do Sorriso: Dentes superiores visíveis com bordas brancas */}
          <path
            d="M48 61 Q60 63.5 72 61 L70 66.5 Q60 69.5 50 66.5 Z"
            fill={toothFill}
            stroke={strokeColor}
            strokeWidth="1"
          />

          {/* Divisórias dos incisivos centrais e laterais */}
          <line x1="60" y1="61.5" x2="60" y2="69" stroke={secondaryStroke} strokeWidth="1.2" />
          <line x1="55" y1="62" x2="55" y2="68" stroke={secondaryStroke} strokeWidth="0.9" />
          <line x1="65" y1="62" x2="65" y2="68" stroke={secondaryStroke} strokeWidth="0.9" />

          {/* Curvatura inferior do lábio no sorriso */}
          <path d="M48 68 Q60 76 72 68" stroke={secondaryStroke} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );

    // ----------------------------------------------------
    // SLOT 4: OCLUSÃO LATERAL DIREITA (Mordida Direita)
    // ----------------------------------------------------
    case 4:
      return (
        <svg
          viewBox="0 0 120 96"
          width={width}
          height={height}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="120" height="96" rx="8" fill="var(--input-bg)" />

          {/* Afastador lateral direito */}
          <path
            d="M100 22 C110 36 110 60 100 74 C96 62 96 36 100 22 Z"
            stroke={strokeColor}
            strokeWidth="1.8"
            fill={retractorColor}
          />

          {/* Cavidade oral de fundo */}
          <rect x="14" y="26" width="84" height="46" rx="10" fill={oralCavity} />

          {/* Dentes Superiores Direitos (Canino, Pré-molares, Molares) */}
          <g>
            <path d="M22 38 L34 37 L33 50 L21 49 Z" fill={toothFill} stroke={toothStroke} strokeWidth="1.2" />
            <path d="M35 36 L48 35 L47 50 L34 50 Z" fill={toothFill} stroke={toothStroke} strokeWidth="1.2" />
            {/* Chave de Canino / 1º Molar Superior */}
            <path d="M49 34 L66 35 L64 51 L48 50 Z" fill={toothFill} stroke={strokeColor} strokeWidth="1.4" />
            <path d="M67 36 L86 37 L84 52 L65 51 Z" fill={toothFill} stroke={toothStroke} strokeWidth="1.2" />
          </g>

          {/* Dentes Inferiores Direitos em Intercuspidação Cêntrica */}
          <g>
            <path d="M25 48 L37 49 L35 63 L23 61 Z" fill="#f1f5f9" stroke={toothStroke} strokeWidth="1.2" />
            <path d="M38 49 L52 50 L50 64 L36 63 Z" fill="#f1f5f9" stroke={toothStroke} strokeWidth="1.2" />
            {/* Cúspide inferior engrenando */}
            <path d="M53 50 L70 50 L68 65 L51 64 Z" fill="#f1f5f9" stroke={strokeColor} strokeWidth="1.4" />
            <path d="M71 51 L89 52 L87 65 L69 65 Z" fill="#f1f5f9" stroke={toothStroke} strokeWidth="1.2" />
          </g>

          {/* Marcador de Chave de Canino (Classe I) */}
          <circle cx="66" cy="51" r="3.5" fill="none" stroke="var(--cyan-primary)" strokeWidth="1.5" />
          <text x="18" y="24" fill={strokeColor} fontSize="8" fontWeight="800">LADO DIREITO →</text>
        </svg>
      );

    // ----------------------------------------------------
    // SLOT 5: OCLUSÃO FRONTAL (Mordida Anterior com Afastadores)
    // ----------------------------------------------------
    case 5:
      return (
        <svg
          viewBox="0 0 120 96"
          width={width}
          height={height}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="120" height="96" rx="8" fill="var(--input-bg)" />

          {/* Afastadores Labiais Laterais (Acrílico translúcido) */}
          <path
            d="M22 26 C14 36 14 60 22 70 C26 60 26 36 22 26 Z"
            stroke={strokeColor}
            strokeWidth="1.8"
            fill={retractorColor}
          />
          <path
            d="M98 26 C106 36 106 60 98 70 C94 60 94 36 98 26 Z"
            stroke={strokeColor}
            strokeWidth="1.8"
            fill={retractorColor}
          />

          {/* Fundo da cavidade bucal */}
          <ellipse cx="60" cy="48" rx="36" ry="22" fill={oralCavity} stroke="var(--border-subtle)" strokeWidth="1" />

          {/* Gengiva Superior */}
          <path d="M34 38 Q60 33 86 38 Q60 36 34 38 Z" fill={gumColor} />

          {/* Arcada Superior (Incisivos Centrais, Laterais e Caninos) */}
          <g>
            {/* Canino D */}
            <path d="M33 39 L40 37 L39 50 L32 47 Z" fill={toothFill} stroke={toothStroke} strokeWidth="1.2" />
            {/* Lateral D */}
            <rect x="40" y="36" width="9" height="14" rx="2" fill={toothFill} stroke={toothStroke} strokeWidth="1.2" />
            {/* Central D */}
            <rect x="50" y="34.5" width="10" height="16" rx="2" fill={toothFill} stroke={strokeColor} strokeWidth="1.4" />
            {/* Central E */}
            <rect x="61" y="34.5" width="10" height="16" rx="2" fill={toothFill} stroke={strokeColor} strokeWidth="1.4" />
            {/* Lateral E */}
            <rect x="72" y="36" width="9" height="14" rx="2" fill={toothFill} stroke={toothStroke} strokeWidth="1.2" />
            {/* Canino E */}
            <path d="M81 37 L88 39 L89 47 L82 50 Z" fill={toothFill} stroke={toothStroke} strokeWidth="1.2" />
          </g>

          {/* Arcada Inferior em Oclusão (Sobremordida ideal de 2mm) */}
          <g>
            <rect x="36" y="48.5" width="8" height="13" rx="1.5" fill="#f1f5f9" stroke={toothStroke} strokeWidth="1.2" />
            <rect x="45" y="48" width="9" height="14" rx="1.5" fill="#f1f5f9" stroke={toothStroke} strokeWidth="1.2" />
            <rect x="55" y="47.5" width="10" height="15" rx="1.5" fill="#f1f5f9" stroke={strokeColor} strokeWidth="1.3" />
            <rect x="66" y="47.5" width="10" height="15" rx="1.5" fill="#f1f5f9" stroke={strokeColor} strokeWidth="1.3" />
            <rect x="77" y="48" width="8" height="14" rx="1.5" fill="#f1f5f9" stroke={toothStroke} strokeWidth="1.2" />
          </g>

          {/* Linha Média Ortodôntica de Referência */}
          <line x1="60.5" y1="28" x2="60.5" y2="68" stroke="var(--cyan-primary)" strokeWidth="1.3" strokeDasharray="3 2" />
        </svg>
      );

    // ----------------------------------------------------
    // SLOT 6: OCLUSÃO LATERAL ESQUERDA (Canino e Molares)
    // ----------------------------------------------------
    case 6:
      return (
        <svg
          viewBox="0 0 120 96"
          width={width}
          height={height}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="120" height="96" rx="8" fill="var(--input-bg)" />

          {/* Afastador lateral esquerdo */}
          <path
            d="M20 22 C10 36 10 60 20 74 C24 62 24 36 20 22 Z"
            stroke={strokeColor}
            strokeWidth="1.8"
            fill={retractorColor}
          />

          <rect x="22" y="26" width="84" height="46" rx="10" fill={oralCavity} />

          {/* Dentes Superiores Esquerdos */}
          <g>
            <path d="M32 37 L51 36 L49 51 L31 52 Z" fill={toothFill} stroke={toothStroke} strokeWidth="1.2" />
            <path d="M52 35 L69 34 L69 50 L50 51 Z" fill={toothFill} stroke={strokeColor} strokeWidth="1.4" />
            <path d="M70 35 L84 36 L84 50 L70 50 Z" fill={toothFill} stroke={toothStroke} strokeWidth="1.2" />
            <path d="M85 37 L98 39 L98 48 L85 49 Z" fill={toothFill} stroke={toothStroke} strokeWidth="1.2" />
          </g>

          {/* Dentes Inferiores Esquerdos */}
          <g>
            <path d="M30 52 L47 51 L49 65 L32 64 Z" fill="#f1f5f9" stroke={toothStroke} strokeWidth="1.2" />
            <path d="M48 50 L65 50 L67 65 L50 64 Z" fill="#f1f5f9" stroke={strokeColor} strokeWidth="1.4" />
            <path d="M66 50 L81 49 L83 63 L68 64 Z" fill="#f1f5f9" stroke={toothStroke} strokeWidth="1.2" />
            <path d="M82 49 L94 48 L96 61 L84 63 Z" fill="#f1f5f9" stroke={toothStroke} strokeWidth="1.2" />
          </g>

          {/* Marcador de Chave de Canino */}
          <circle cx="51" cy="51" r="3.5" fill="none" stroke="var(--cyan-primary)" strokeWidth="1.5" />
          <text x="66" y="24" fill={strokeColor} fontSize="8" fontWeight="800">← LADO ESQUERDO</text>
        </svg>
      );

    // ----------------------------------------------------
    // SLOT 7: OCLUSAL ARCADA SUPERIOR (Formato U + Palato)
    // ----------------------------------------------------
    case 7:
      return (
        <svg
          viewBox="0 0 120 96"
          width={width}
          height={height}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="120" height="96" rx="8" fill="var(--input-bg)" />

          {/* Palato central côncavo */}
          <path
            d="M38 72 C38 42 46 26 60 26 C74 26 82 42 82 72 C74 65 46 65 38 72 Z"
            fill={gumColor}
            stroke="var(--border-subtle)"
            strokeWidth="1"
          />

          {/* Rugas palatinas superiores */}
          <path d="M52 36 Q60 39 68 36" stroke={secondaryStroke} strokeWidth="1.1" strokeLinecap="round" />
          <path d="M49 43 Q60 46 71 43" stroke={secondaryStroke} strokeWidth="1.1" strokeLinecap="round" />
          <path d="M47 50 Q60 53 73 50" stroke={secondaryStroke} strokeWidth="1.1" strokeLinecap="round" />

          {/* Arcada Dental Superior Completa em Ferradura (17 a 27) */}
          <g>
            {/* Incisivos Centrais e Laterais */}
            <circle cx="60" cy="18" r="3.8" fill={toothFill} stroke={strokeColor} strokeWidth="1.3" />
            <circle cx="52" cy="20" r="3.4" fill={toothFill} stroke={toothStroke} strokeWidth="1.1" />
            <circle cx="68" cy="20" r="3.4" fill={toothFill} stroke={toothStroke} strokeWidth="1.1" />

            {/* Caninos */}
            <circle cx="44" cy="25" r="3.6" fill={toothFill} stroke={toothStroke} strokeWidth="1.1" />
            <circle cx="76" cy="25" r="3.6" fill={toothFill} stroke={toothStroke} strokeWidth="1.1" />

            {/* Pré-molares */}
            <circle cx="38" cy="34" r="4.2" fill={toothFill} stroke={toothStroke} strokeWidth="1.1" />
            <circle cx="82" cy="34" r="4.2" fill={toothFill} stroke={toothStroke} strokeWidth="1.1" />
            <rect x="31" y="43" width="8.5" height="10" rx="2" fill={toothFill} stroke={toothStroke} strokeWidth="1.1" />
            <rect x="80.5" y="43" width="8.5" height="10" rx="2" fill={toothFill} stroke={toothStroke} strokeWidth="1.1" />

            {/* Molares (16, 17, 26, 27) */}
            <rect x="29" y="56" width="10" height="12" rx="2.5" fill={toothFill} stroke={strokeColor} strokeWidth="1.3" />
            <rect x="81" y="56" width="10" height="12" rx="2.5" fill={toothFill} stroke={strokeColor} strokeWidth="1.3" />
          </g>

          <text x="40" y="86" fill={strokeColor} fontSize="8" fontWeight="800">ARCADA SUPERIOR</text>
        </svg>
      );

    // ----------------------------------------------------
    // SLOT 8: OCLUSAL ARCADA INFERIOR (Formato U + Espaço Lingual)
    // ----------------------------------------------------
    case 8:
      return (
        <svg
          viewBox="0 0 120 96"
          width={width}
          height={height}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="120" height="96" rx="8" fill="var(--input-bg)" />

          {/* Espaço lingual aberto central */}
          <path
            d="M40 76 C40 48 48 32 60 32 C72 32 80 48 80 76 C72 70 48 70 40 76 Z"
            fill={oralCavity}
            stroke="var(--border-subtle)"
            strokeWidth="1"
          />

          {/* Arcada Dental Inferior Completa (47 a 37) */}
          <g>
            <circle cx="60" cy="22" r="3.2" fill="#f1f5f9" stroke={strokeColor} strokeWidth="1.3" />
            <circle cx="53" cy="24" r="3" fill="#f1f5f9" stroke={toothStroke} strokeWidth="1.1" />
            <circle cx="67" cy="24" r="3" fill="#f1f5f9" stroke={toothStroke} strokeWidth="1.1" />

            <circle cx="46" cy="28" r="3.4" fill="#f1f5f9" stroke={toothStroke} strokeWidth="1.1" />
            <circle cx="74" cy="28" r="3.4" fill="#f1f5f9" stroke={toothStroke} strokeWidth="1.1" />

            <circle cx="39" cy="37" r="4" fill="#f1f5f9" stroke={toothStroke} strokeWidth="1.1" />
            <circle cx="81" cy="37" r="4" fill="#f1f5f9" stroke={toothStroke} strokeWidth="1.1" />

            <rect x="33" y="46" width="8.5" height="10" rx="2" fill="#f1f5f9" stroke={toothStroke} strokeWidth="1.1" />
            <rect x="78.5" y="46" width="8.5" height="10" rx="2" fill="#f1f5f9" stroke={toothStroke} strokeWidth="1.1" />

            <rect x="31" y="58" width="10" height="12" rx="2.5" fill="#f1f5f9" stroke={strokeColor} strokeWidth="1.3" />
            <rect x="79" y="58" width="10" height="12" rx="2.5" fill="#f1f5f9" stroke={strokeColor} strokeWidth="1.3" />
          </g>

          <text x="40" y="86" fill={strokeColor} fontSize="8" fontWeight="800">ARCADA INFERIOR</text>
        </svg>
      );

    // ----------------------------------------------------
    // SLOT 9: RADIOGRAFIA PANORÂMICA (Ortopantomografia)
    // ----------------------------------------------------
    case 9:
      return (
        <svg
          viewBox="0 0 120 96"
          width={width}
          height={height}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Fundo radiográfico com acabamento escuro clínico */}
          <rect width="120" height="96" rx="8" fill="#0b1320" />
          <rect x="6" y="8" width="108" height="80" rx="6" stroke="rgba(148, 163, 184, 0.25)" strokeWidth="1" fill="#070c14" />

          {/* Curva mandibular com côndilos e ramo */}
          <path
            d="M16 34 C16 66 36 75 60 75 C84 75 104 66 104 34"
            stroke="rgba(255, 255, 255, 0.35)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Côndilos articulares */}
          <ellipse cx="18" cy="32" rx="4.5" ry="3" fill="rgba(255, 255, 255, 0.6)" />
          <ellipse cx="102" cy="32" rx="4.5" ry="3" fill="rgba(255, 255, 255, 0.6)" />

          {/* Arcada dentária radiográfica (superior e inferior) */}
          <path d="M24 43 Q60 52 96 43" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeOpacity="0.9" />
          <path d="M26 50 Q60 58 94 50" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeOpacity="0.9" />

          {/* Raízes dentárias visíveis no osso alveolar */}
          <path
            d="M34 37 L34 43 M42 35 L42 43 M50 34 L50 43 M60 34 L60 43 M70 34 L70 43 M78 35 L78 43 M86 37 L86 43"
            stroke="rgba(255, 255, 255, 0.6)"
            strokeWidth="1.6"
          />
          <path
            d="M34 50 L34 59 M42 51 L42 61 M50 52 L50 62 M60 52 L60 62 M70 52 L70 62 M78 51 L78 61 M86 50 L86 59"
            stroke="rgba(255, 255, 255, 0.6)"
            strokeWidth="1.6"
          />

          {/* Badge Radiográfica */}
          <rect x="12" y="12" width="26" height="12" rx="3" fill="rgba(147, 51, 234, 0.3)" />
          <text x="15" y="21" fill="#c084fc" fontSize="7" fontWeight="800">PAN RX</text>
        </svg>
      );

    // ----------------------------------------------------
    // SLOT 10: TELERRADIOGRAFIA LATERAL (Cefalometria)
    // ----------------------------------------------------
    case 10:
      return (
        <svg
          viewBox="0 0 120 96"
          width={width}
          height={height}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="120" height="96" rx="8" fill="#0b1320" />
          <rect x="6" y="8" width="108" height="80" rx="6" stroke="rgba(148, 163, 184, 0.25)" strokeWidth="1" fill="#070c14" />

          {/* Contorno do crânio e perfil ósseo cefalométrico */}
          <path
            d="M36 32 C36 16 50 14 66 14 C80 14 88 22 88 34 C88 42 85 46 88 50 L92 54 L87 56 L89 62 C87 66 81 70 75 70 L65 68 L59 78 L53 78"
            stroke="rgba(255, 255, 255, 0.85)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Coluna cervical (Vértebras C1-C4) */}
          <rect x="43" y="54" width="8" height="5" rx="1" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1.2" />
          <rect x="43" y="61" width="8" height="5" rx="1" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1.2" />
          <rect x="43" y="68" width="8" height="5" rx="1" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1.2" />

          {/* Sela túrcica e plano palatino */}
          <path d="M56 34 Q58 38 60 34" stroke="rgba(255, 255, 255, 0.8)" strokeWidth="1.6" fill="none" />
          <line x1="58" y1="52" x2="84" y2="52" stroke="rgba(0, 210, 211, 0.5)" strokeWidth="1" strokeDasharray="2 2" />

          {/* Dentes anteriores em perfil */}
          <path d="M81 48 L85 51 L79 53 Z" fill="#ffffff" />
          <path d="M79 54 L83 56 L77 58 Z" fill="#ffffff" />

          <rect x="12" y="12" width="28" height="12" rx="3" fill="rgba(147, 51, 234, 0.3)" />
          <text x="15" y="21" fill="#c084fc" fontSize="7" fontWeight="800">TELE RX</text>
        </svg>
      );

    // ----------------------------------------------------
    // SLOT 11: ESCANEAMENTO SUPERIOR 3D (Malha STL Isométrica)
    // ----------------------------------------------------
    case 11:
      return (
        <svg
          viewBox="0 0 120 96"
          width={width}
          height={height}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="120" height="96" rx="8" fill="var(--input-bg)" />

          <g transform="translate(16, 12)">
            {/* Base sólida da arcada superior 3D */}
            <path
              d="M16 54 C14 30 26 10 44 10 C62 10 74 30 72 54 L62 50 C62 34 52 20 44 20 C36 20 26 34 26 50 Z"
              fill={cyanTint}
              stroke={strokeColor}
              strokeWidth="2"
            />
            {/* Malha triangular poligonal 3D */}
            <line x1="44" y1="10" x2="44" y2="20" stroke={strokeColor} strokeWidth="1.2" strokeDasharray="1.5 1.5" />
            <line x1="32" y1="18" x2="38" y2="24" stroke={strokeColor} strokeWidth="1" />
            <line x1="56" y1="18" x2="50" y2="24" stroke={strokeColor} strokeWidth="1" />
            <line x1="22" y1="32" x2="30" y2="34" stroke={strokeColor} strokeWidth="1" />
            <line x1="66" y1="32" x2="58" y2="34" stroke={strokeColor} strokeWidth="1" />

            {/* Dentes 3D facetados com acabamento de malha */}
            <circle cx="44" cy="12" r="3.8" fill={toothFill} stroke={strokeColor} strokeWidth="1.3" />
            <circle cx="34" cy="16" r="3.4" fill={toothFill} stroke={strokeColor} strokeWidth="1.2" />
            <circle cx="54" cy="16" r="3.4" fill={toothFill} stroke={strokeColor} strokeWidth="1.2" />
            <circle cx="26" cy="26" r="3.8" fill={toothFill} stroke={strokeColor} strokeWidth="1.2" />
            <circle cx="62" cy="26" r="3.8" fill={toothFill} stroke={strokeColor} strokeWidth="1.2" />
            <rect x="16" y="38" width="7" height="9" rx="2" fill={toothFill} stroke={strokeColor} strokeWidth="1.2" />
            <rect x="65" y="38" width="7" height="9" rx="2" fill={toothFill} stroke={strokeColor} strokeWidth="1.2" />
          </g>

          <text x="36" y="86" fill={strokeColor} fontSize="8" fontWeight="800">3D SCAN SUPERIOR</text>
        </svg>
      );

    // ----------------------------------------------------
    // SLOT 12: ESCANEAMENTO INFERIOR 3D (Malha STL Isométrica)
    // ----------------------------------------------------
    case 12:
      return (
        <svg
          viewBox="0 0 120 96"
          width={width}
          height={height}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="120" height="96" rx="8" fill="var(--input-bg)" />

          <g transform="translate(16, 12)">
            {/* Base sólida da arcada inferior 3D */}
            <path
              d="M18 54 C16 34 26 14 44 14 C62 14 72 34 70 54 L60 50 C60 36 52 24 44 24 C36 24 28 36 28 50 Z"
              fill={blueTint}
              stroke="var(--blue-vibrant)"
              strokeWidth="2"
            />
            {/* Wireframe de malha 3D */}
            <line x1="44" y1="14" x2="44" y2="24" stroke="var(--blue-vibrant)" strokeWidth="1.2" strokeDasharray="1.5 1.5" />
            <line x1="33" y1="20" x2="38" y2="28" stroke="var(--blue-vibrant)" strokeWidth="1" />
            <line x1="55" y1="20" x2="50" y2="28" stroke="var(--blue-vibrant)" strokeWidth="1" />
            <line x1="23" y1="36" x2="31" y2="38" stroke="var(--blue-vibrant)" strokeWidth="1" />
            <line x1="65" y1="36" x2="57" y2="38" stroke="var(--blue-vibrant)" strokeWidth="1" />

            {/* Dentes 3D facetados inferiores */}
            <circle cx="44" cy="15" r="3.2" fill="#f1f5f9" stroke="var(--blue-vibrant)" strokeWidth="1.3" />
            <circle cx="35" cy="18" r="3" fill="#f1f5f9" stroke="var(--blue-vibrant)" strokeWidth="1.2" />
            <circle cx="53" cy="18" r="3" fill="#f1f5f9" stroke="var(--blue-vibrant)" strokeWidth="1.2" />
            <circle cx="28" cy="27" r="3.5" fill="#f1f5f9" stroke="var(--blue-vibrant)" strokeWidth="1.2" />
            <circle cx="60" cy="27" r="3.5" fill="#f1f5f9" stroke="var(--blue-vibrant)" strokeWidth="1.2" />
            <rect x="18" y="39" width="7" height="9" rx="2" fill="#f1f5f9" stroke="var(--blue-vibrant)" strokeWidth="1.2" />
            <rect x="63" y="39" width="7" height="9" rx="2" fill="#f1f5f9" stroke="var(--blue-vibrant)" strokeWidth="1.2" />
          </g>

          <text x="36" y="86" fill="var(--blue-vibrant)" fontSize="8" fontWeight="800">3D SCAN INFERIOR</text>
        </svg>
      );

    // ----------------------------------------------------
    // SLOT 13: REGISTRO OCLUSAL 3D (Bite Scan articulado)
    // ----------------------------------------------------
    case 13:
    default:
      return (
        <svg
          viewBox="0 0 120 96"
          width={width}
          height={height}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="120" height="96" rx="8" fill="var(--input-bg)" />

          <g transform="translate(18, 14)">
            {/* Arcada Superior 3D */}
            <path
              d="M14 30 Q42 16 70 30 L66 40 Q42 28 18 40 Z"
              fill={cyanTint}
              stroke={strokeColor}
              strokeWidth="1.8"
            />
            {/* Registro de mordida interoclusal (Bite Matrix) */}
            <path
              d="M17 38 Q42 27 67 38 L65 44 Q42 33 19 44 Z"
              fill="var(--cyan-primary)"
              fillOpacity="0.3"
              stroke="var(--cyan-primary)"
              strokeWidth="1.4"
              strokeDasharray="2 2"
            />
            {/* Arcada Inferior 3D em oclusão */}
            <path
              d="M18 43 Q42 32 66 43 L70 54 Q42 42 14 54 Z"
              fill={blueTint}
              stroke="var(--blue-vibrant)"
              strokeWidth="1.8"
            />
            {/* Pontos de contato oclusal calibrados */}
            <circle cx="24" cy="41" r="2.5" fill="var(--cyan-primary)" />
            <circle cx="42" cy="35" r="2.5" fill="var(--cyan-primary)" />
            <circle cx="60" cy="41" r="2.5" fill="var(--cyan-primary)" />
          </g>

          <text x="32" y="86" fill={strokeColor} fontSize="8" fontWeight="800">REGISTRO DE MORDIDA</text>
        </svg>
      );
  }
}
