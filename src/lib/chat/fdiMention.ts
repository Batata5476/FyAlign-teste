/**
 * FyAlign B2B - Utilitário de Notação e Menção Dental FDI (ISO 3950)
 * Responsável por detectar menções no chat (ex: #11, #26, #48), validar a numeração
 * e fornecer os nomes anatômicos de cada elemento permanente.
 */

export interface FdiToothInfo {
  fdiNumber: string;
  quadrant: number;
  toothIndex: number;
  arch: 'UPPER' | 'LOWER';
  side: 'RIGHT' | 'LEFT';
  popularName: string;
  anatomicalName: string;
}

export const FDI_ANATOMICAL_DICTIONARY: Record<string, { arch: 'UPPER' | 'LOWER'; side: 'RIGHT' | 'LEFT'; name: string }> = {
  // Quadrante 1: Superior Direito
  '18': { arch: 'UPPER', side: 'RIGHT', name: 'Terceiro Molar Superior Direito' },
  '17': { arch: 'UPPER', side: 'RIGHT', name: 'Segundo Molar Superior Direito' },
  '16': { arch: 'UPPER', side: 'RIGHT', name: 'Primeiro Molar Superior Direito' },
  '15': { arch: 'UPPER', side: 'RIGHT', name: 'Segundo Pré-molar Superior Direito' },
  '14': { arch: 'UPPER', side: 'RIGHT', name: 'Primeiro Pré-molar Superior Direito' },
  '13': { arch: 'UPPER', side: 'RIGHT', name: 'Canino Superior Direito' },
  '12': { arch: 'UPPER', side: 'RIGHT', name: 'Incisivo Lateral Superior Direito' },
  '11': { arch: 'UPPER', side: 'RIGHT', name: 'Incisivo Central Superior Direito' },

  // Quadrante 2: Superior Esquerdo
  '21': { arch: 'UPPER', side: 'LEFT', name: 'Incisivo Central Superior Esquerdo' },
  '22': { arch: 'UPPER', side: 'LEFT', name: 'Incisivo Lateral Superior Esquerdo' },
  '23': { arch: 'UPPER', side: 'LEFT', name: 'Canino Superior Esquerdo' },
  '24': { arch: 'UPPER', side: 'LEFT', name: 'Primeiro Pré-molar Superior Esquerdo' },
  '25': { arch: 'UPPER', side: 'LEFT', name: 'Segundo Pré-molar Superior Esquerdo' },
  '26': { arch: 'UPPER', side: 'LEFT', name: 'Primeiro Molar Superior Esquerdo' },
  '27': { arch: 'UPPER', side: 'LEFT', name: 'Segundo Molar Superior Esquerdo' },
  '28': { arch: 'UPPER', side: 'LEFT', name: 'Terceiro Molar Superior Esquerdo' },

  // Quadrante 3: Inferior Esquerdo
  '31': { arch: 'LOWER', side: 'LEFT', name: 'Incisivo Central Inferior Esquerdo' },
  '32': { arch: 'LOWER', side: 'LEFT', name: 'Incisivo Lateral Inferior Esquerdo' },
  '33': { arch: 'LOWER', side: 'LEFT', name: 'Canino Inferior Esquerdo' },
  '34': { arch: 'LOWER', side: 'LEFT', name: 'Primeiro Pré-molar Inferior Esquerdo' },
  '35': { arch: 'LOWER', side: 'LEFT', name: 'Segundo Pré-molar Inferior Esquerdo' },
  '36': { arch: 'LOWER', side: 'LEFT', name: 'Primeiro Molar Inferior Esquerdo' },
  '37': { arch: 'LOWER', side: 'LEFT', name: 'Segundo Molar Inferior Esquerdo' },
  '38': { arch: 'LOWER', side: 'LEFT', name: 'Terceiro Molar Inferior Esquerdo' },

  // Quadrante 4: Inferior Direito
  '48': { arch: 'LOWER', side: 'RIGHT', name: 'Terceiro Molar Inferior Direito' },
  '47': { arch: 'LOWER', side: 'RIGHT', name: 'Segundo Molar Inferior Direito' },
  '46': { arch: 'LOWER', side: 'RIGHT', name: 'Primeiro Molar Inferior Direito' },
  '45': { arch: 'LOWER', side: 'RIGHT', name: 'Segundo Pré-molar Inferior Direito' },
  '44': { arch: 'LOWER', side: 'RIGHT', name: 'Primeiro Pré-molar Inferior Direito' },
  '43': { arch: 'LOWER', side: 'RIGHT', name: 'Canino Inferior Direito' },
  '42': { arch: 'LOWER', side: 'RIGHT', name: 'Incisivo Lateral Inferior Direito' },
  '41': { arch: 'LOWER', side: 'RIGHT', name: 'Incisivo Central Inferior Direito' },
};

/**
 * Extrai menções de dentes em notação FDI no formato `#11`, `#36`, etc.
 * Retorna array único com os códigos válidos (ex: ['11', '36']).
 */
export function extractFdiMentions(text: string): string[] {
  if (!text) return [];
  const regex = /#([1-4][1-8])\b/g;
  const matches = new Set<string>();
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (FDI_ANATOMICAL_DICTIONARY[match[1]]) {
      matches.add(match[1]);
    }
  }
  return Array.from(matches);
}

/**
 * Obtém os metadados anatômicos completos de um dente FDI.
 */
export function getToothFdiInfo(fdiNumber: string): FdiToothInfo | null {
  const data = FDI_ANATOMICAL_DICTIONARY[fdiNumber];
  if (!data) return null;

  const quadrant = parseInt(fdiNumber[0], 10);
  const toothIndex = parseInt(fdiNumber[1], 10);

  return {
    fdiNumber,
    quadrant,
    toothIndex,
    arch: data.arch,
    side: data.side,
    popularName: `#${fdiNumber} (${data.name})`,
    anatomicalName: data.name,
  };
}
