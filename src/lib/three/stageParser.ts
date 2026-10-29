/**
 * Parser e validador de nomenclatura de arquivos de estágios ortodônticos (Sprint 1)
 * Reconhece convenções reais de CAD odontológico:
 * - 1-I-.stl / 1-S-.stl (Inferior / Superior)
 * - 12-I-.stl / 12-S-.stl
 * - 0-I-.stl / 0-S-.stl
 * - stage_0_upper.stl / stage_0_lower.stl
 * - stage-1-upper.stl / stage-1-lower.stl
 * - 0_upper.stl / 0_lower.stl
 * - estagio_0_superior.stl / estagio_0_inferior.stl
 */

export interface ParsedStageFile {
  fileName: string;
  stageNumber: number;
  arch: 'UPPER' | 'LOWER';
  extension: string;
  sizeBytes?: number;
}

export interface StagePair {
  stageNumber: number;
  upper?: ParsedStageFile;
  lower?: ParsedStageFile;
  isComplete: boolean;
}

export interface ParseResult {
  stages: Map<number, StagePair>;
  totalStagesDetected: number;
  totalCompletePairs: number;
  minStage: number;
  maxStage: number;
  unrecognizedFiles: string[];
  missingFiles: string[];
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function parseStageFileName(fileName: string, sizeBytes?: number): ParsedStageFile | null {
  const cleanName = fileName.trim();
  const lower = cleanName.toLowerCase();

  // 1. Extrai extensão
  const extMatch = lower.match(/\.(stl|ply|obj)$/);
  if (!extMatch) return null;
  const extension = '.' + extMatch[1];
  const baseName = lower.slice(0, -extension.length);

  let arch: 'UPPER' | 'LOWER' | null = null;
  let stageNumber: number | null = null;

  // Padrão 1: Formato CAD compacto: <estágio>-<S|I>-.stl, <estágio>-<S|I>.stl, <estágio>_<S|I>_.stl, etc.
  // Exemplos reais: "1-I-.stl", "1-S-.stl", "12-I-.stl", "12-S-.stl", "0-S-.stl", "1_s.stl", "1s.stl"
  const compactNumArchMatch = baseName.match(/^(\d+)[_\-\s]*([si])[_\-\s]*$/);
  if (compactNumArchMatch) {
    stageNumber = parseInt(compactNumArchMatch[1], 10);
    arch = compactNumArchMatch[2] === 's' ? 'UPPER' : 'LOWER';
  }

  // Padrão 2: Formato CAD invertido: "S-1-.stl", "I-12.stl", "S_0.stl"
  if (arch === null) {
    const compactArchNumMatch = baseName.match(/^([si])[_\-\s]*(\d+)[_\-\s]*$/);
    if (compactArchNumMatch) {
      arch = compactArchNumMatch[1] === 's' ? 'UPPER' : 'LOWER';
      stageNumber = parseInt(compactArchNumMatch[2], 10);
    }
  }

  // Padrão 3: Formato descritivo canônico (stage_0_upper, estagio_1_sup, 0_upper, etc.)
  if (arch === null) {
    if (
      lower.includes('upper') ||
      lower.includes('superior') ||
      lower.includes('sup') ||
      lower.includes('maxila') ||
      lower.includes('maxillary')
    ) {
      arch = 'UPPER';
    } else if (
      lower.includes('lower') ||
      lower.includes('inferior') ||
      lower.includes('inf') ||
      lower.includes('mandibula') ||
      lower.includes('mandibular')
    ) {
      arch = 'LOWER';
    }

    if (arch !== null) {
      const stagePatterns = [
        /(?:stage|estagio|passo|step)[_\-\s]*(\d+)/i,
        /s(\d+)[_\-\s]*(?:upper|lower|sup|inf|superior|inferior)/i,
        /^(\d+)[_\-\s]*(?:upper|lower|sup|inf|superior|inferior)/i,
        /(?:upper|lower|sup|inf|superior|inferior)[_\-\s]*(\d+)/i,
        /[_\-](\d+)[_\-]/,
        /^(\d+)[_\-]/,
        /[_\-](\d+)$/,
      ];

      for (const pattern of stagePatterns) {
        const match = lower.match(pattern);
        if (match && match[1] !== undefined) {
          stageNumber = parseInt(match[1], 10);
          break;
        }
      }
    }
  }

  if (arch === null || stageNumber === null || isNaN(stageNumber) || stageNumber < 0) {
    return null;
  }

  return {
    fileName: cleanName,
    stageNumber,
    arch,
    extension,
    sizeBytes,
  };
}

/**
 * Agrupa e valida um lote de arquivos de estágios selecionados
 */
export function analyzeStageFiles(fileList: Array<{ name: string; size?: number }>): ParseResult {
  const stages = new Map<number, StagePair>();
  const unrecognizedFiles: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingFiles: string[] = [];

  for (const f of fileList) {
    const parsed = parseStageFileName(f.name, f.size);
    if (!parsed) {
      unrecognizedFiles.push(f.name);
      continue;
    }

    if (!stages.has(parsed.stageNumber)) {
      stages.set(parsed.stageNumber, {
        stageNumber: parsed.stageNumber,
        isComplete: false,
      });
    }

    const stagePair = stages.get(parsed.stageNumber)!;
    if (parsed.arch === 'UPPER') {
      if (stagePair.upper) {
        errors.push(`Arquivo duplicado para Estágio ${parsed.stageNumber} Superior: ${f.name} e ${stagePair.upper.fileName}`);
      }
      stagePair.upper = parsed;
    } else {
      if (stagePair.lower) {
        errors.push(`Arquivo duplicado para Estágio ${parsed.stageNumber} Inferior: ${f.name} e ${stagePair.lower.fileName}`);
      }
      stagePair.lower = parsed;
    }

    stagePair.isComplete = Boolean(stagePair.upper && stagePair.lower);
  }

  if (stages.size === 0) {
    errors.push('Nenhum arquivo de estágio válido (.stl) foi reconhecido.');
    return {
      stages,
      totalStagesDetected: 0,
      totalCompletePairs: 0,
      minStage: 0,
      maxStage: 0,
      unrecognizedFiles,
      missingFiles,
      isValid: false,
      errors,
      warnings,
    };
  }

  // Ordena os números de estágio encontrados
  const sortedStageNumbers = Array.from(stages.keys()).sort((a, b) => a - b);
  const minStage = sortedStageNumbers[0];
  const maxStage = sortedStageNumbers[sortedStageNumbers.length - 1];

  // Regra de estágio inicial: softwares CAD geralmente iniciam em 0 (pré-tratamento) ou em 1 (primeiro alinhador)
  if (minStage > 1) {
    errors.push(`Sequência inicial incorreta: o planejamento deve iniciar no Estágio 0 ou 1. Menor estágio encontrado: ${minStage}.`);
  } else if (minStage === 1) {
    warnings.push('O planejamento inicia no Estágio 1 (sem Estágio 0 de pré-tratamento explícito). O Estágio 1 será considerado a posição inicial.');
  }

  // Verifica continuidade sequencial: de minStage até maxStage sem buracos
  for (let i = minStage; i <= maxStage; i++) {
    const pair = stages.get(i);
    if (!pair) {
      missingFiles.push(`Estágio ${i} completo ausente (faltam arquivos superior e inferior).`);
      errors.push(`Sequência interrompida: Estágio ${i} não foi fornecido.`);
      continue;
    }

    if (!pair.upper) {
      missingFiles.push(`Estágio ${i}: arcada Superior ausente.`);
      errors.push(`Estágio ${i}: arquivo da arcada superior ausente.`);
    }

    if (!pair.lower) {
      missingFiles.push(`Estágio ${i}: arcada Inferior ausente.`);
      errors.push(`Estágio ${i}: arquivo da arcada inferior ausente.`);
    }
  }

  const totalCompletePairs = Array.from(stages.values()).filter((p) => p.isComplete).length;
  const isValid = errors.length === 0 && unrecognizedFiles.length === 0;

  return {
    stages,
    totalStagesDetected: stages.size,
    totalCompletePairs,
    minStage,
    maxStage,
    unrecognizedFiles,
    missingFiles,
    isValid,
    errors,
    warnings,
  };
}
