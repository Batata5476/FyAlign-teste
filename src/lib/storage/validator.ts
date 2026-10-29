export interface SlotSpecification {
  slotNumber: number;
  title: string;
  category: 'EXTRAORAL' | 'INTRAORAL' | 'RADIOGRAPH' | 'SCAN_3D';
  description: string;
  allowedExtensions: string[];
  maxSizeBytes: number;
  required: boolean;
}

export const SLOTS_METADATA: Record<number, SlotSpecification> = {
  1: {
    slotNumber: 1,
    title: 'Foto Frontal em Repouso',
    category: 'EXTRAORAL',
    description: 'Face frontal do paciente sem sorrir, lábios em posição natural.',
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.heic'],
    maxSizeBytes: 25 * 1024 * 1024,
    required: true,
  },
  2: {
    slotNumber: 2,
    title: 'Foto Perfil Direito (90°)',
    category: 'EXTRAORAL',
    description: 'Perfil direito rigoroso em 90°, postura neutra da cabeça.',
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.heic'],
    maxSizeBytes: 25 * 1024 * 1024,
    required: true,
  },
  3: {
    slotNumber: 3,
    title: 'Foto Frontal Sorrindo',
    category: 'EXTRAORAL',
    description: 'Face frontal com sorriso amplo espontâneo, exibindo corredor bucal.',
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.heic'],
    maxSizeBytes: 25 * 1024 * 1024,
    required: true,
  },
  4: {
    slotNumber: 4,
    title: 'Oclusão Lateral Direita (Mordida Direita)',
    category: 'INTRAORAL',
    description: 'Visão lateral direita focada na chave de canino e molares.',
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.heic'],
    maxSizeBytes: 25 * 1024 * 1024,
    required: true,
  },
  5: {
    slotNumber: 5,
    title: 'Oclusão Frontal (Mordida Anterior)',
    category: 'INTRAORAL',
    description: 'Fotografia intraoral com afastador em máxima intercuspidação.',
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.heic'],
    maxSizeBytes: 25 * 1024 * 1024,
    required: true,
  },
  6: {
    slotNumber: 6,
    title: 'Oclusão Lateral Esquerda',
    category: 'INTRAORAL',
    description: 'Visão lateral esquerda focada na chave de canino e molares.',
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.heic'],
    maxSizeBytes: 25 * 1024 * 1024,
    required: true,
  },
  7: {
    slotNumber: 7,
    title: 'Oclusal Arcada Superior',
    category: 'INTRAORAL',
    description: 'Espelho oclusal superior exibindo todos os dentes de 17 a 27.',
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.heic'],
    maxSizeBytes: 25 * 1024 * 1024,
    required: true,
  },
  8: {
    slotNumber: 8,
    title: 'Oclusal Arcada Inferior',
    category: 'INTRAORAL',
    description: 'Espelho oclusal inferior exibindo todos os dentes de 47 a 37.',
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.heic'],
    maxSizeBytes: 25 * 1024 * 1024,
    required: true,
  },
  9: {
    slotNumber: 9,
    title: 'Radiografia Panorâmica',
    category: 'RADIOGRAPH',
    description: 'Ortopantomografia panorâmica nítida e recente (últimos 6 meses).',
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.dcm'],
    maxSizeBytes: 50 * 1024 * 1024,
    required: true,
  },
  10: {
    slotNumber: 10,
    title: 'Telerradiografia Lateral',
    category: 'RADIOGRAPH',
    description: 'Telerradiografia cefalométrica de perfil para análise esquelética.',
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.dcm'],
    maxSizeBytes: 50 * 1024 * 1024,
    required: true,
  },
  11: {
    slotNumber: 11,
    title: 'Modelo 3D Arcada Superior',
    category: 'SCAN_3D',
    description: 'Malha tridimensional da arcada superior (.STL, .PLY ou .OBJ).',
    allowedExtensions: ['.stl', '.ply', '.obj'],
    maxSizeBytes: 100 * 1024 * 1024,
    required: true,
  },
  12: {
    slotNumber: 12,
    title: 'Modelo 3D Arcada Inferior',
    category: 'SCAN_3D',
    description: 'Malha tridimensional da arcada inferior (.STL, .PLY ou .OBJ).',
    allowedExtensions: ['.stl', '.ply', '.obj'],
    maxSizeBytes: 100 * 1024 * 1024,
    required: true,
  },
  13: {
    slotNumber: 13,
    title: 'Registro Oclusal (Bite Scan)',
    category: 'SCAN_3D',
    description: 'Escaneamento do registro de mordida oclusal para articulação.',
    allowedExtensions: ['.stl', '.ply', '.obj'],
    maxSizeBytes: 100 * 1024 * 1024,
    required: true, // Obrigatório para validação da oclusão (13/13 arquivos)
  },
};

/**
 * Valida se um arquivo é compatível com o slot pretendido (F2.13)
 */
export function validateFileForSlot(
  slotNumber: number,
  fileName: string,
  fileSizeBytes: number
): { valid: boolean; error?: string } {
  const slot = SLOTS_METADATA[slotNumber];
  if (!slot) {
    return { valid: false, error: `Slot ${slotNumber} inválido.` };
  }

  const ext = '.' + (fileName.split('.').pop()?.toLowerCase() || '');
  if (!slot.allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Formato inválido (${ext}). Formatos permitidos: ${slot.allowedExtensions.join(', ')}`,
    };
  }

  if (fileSizeBytes > slot.maxSizeBytes) {
    const maxMb = Math.round(slot.maxSizeBytes / (1024 * 1024));
    return {
      valid: false,
      error: `Arquivo excede o limite máximo de ${maxMb} MB.`,
    };
  }

  return { valid: true };
}

/**
 * Validação de integridade de malha 3D (F2.14)
 */
export function validate3DMeshBuffer(buffer: Buffer, extension: string): { valid: boolean; details?: string } {
  const ext = extension.toLowerCase();

  if (ext === '.stl') {
    if (buffer.length < 84) {
      return { valid: false, details: 'Arquivo STL corrompido ou truncado (tamanho inferior a 84 bytes).' };
    }

    // Verifica se é STL Binário
    const triangleCount = buffer.readUInt32LE(80);
    const expectedBinarySize = 84 + triangleCount * 50;

    if (buffer.length === expectedBinarySize) {
      return { valid: true, details: `STL Binário Válido: ${triangleCount} triângulos.` };
    }

    // Se não bate o tamanho binário exato, verifica se é STL ASCII
    const textStart = buffer.toString('utf8', 0, Math.min(buffer.length, 256));
    if (textStart.toLowerCase().includes('solid')) {
      return { valid: true, details: 'STL ASCII Válido.' };
    }

    return { valid: false, details: 'Estrutura geométrica de malha STL inválida.' };
  }

  if (ext === '.ply') {
    const textStart = buffer.toString('utf8', 0, Math.min(buffer.length, 128));
    if (textStart.startsWith('ply')) {
      return { valid: true, details: 'Cabeçalho PLY válido.' };
    }
    return { valid: false, details: 'Arquivo PLY sem cabeçalho válido.' };
  }

  return { valid: true, details: 'Formato 3D aceito.' };
}
