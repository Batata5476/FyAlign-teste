/**
 * FyAlign B2B - Módulo de Higienização de Dados e Prevenção OWASP Top 10 (F6.07)
 */

/**
 * Higieniza strings contra injeção de scripts (XSS).
 * Remove tags <script>, handlers inline on*, javascript:, data:text/html
 */
export function sanitizeString(input: string): string {
  if (!input) return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:[^"']*/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/data:text\/html[^"']*/gi, '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Valida e protege nomes de arquivos contra Path Traversal.
 * Impede strings como `../../etc/passwd` ou `..\\Windows\\System32`.
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return '';
  // Remove caminhos relativos ou sequências de barras
  const cleaned = filename
    .replace(/\.\./g, '')
    .replace(/[\/\\]+/g, '_')
    .replace(/^_+/, '');
  // Mantém apenas caracteres seguros para sistema de arquivos
  return cleaned.replace(/[^a-zA-Z0-9_\-\.]/g, '');
}

/**
 * Valida se uma string é um UUIDv4 legítimo.
 */
export function isValidUuid(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
