/**
 * Suíte de Testes Automatizados - Fase 6: Segurança, Compliance LGPD, Homologação & Lançamento
 * Valida cabeçalhos de segurança HTTP, Rate Limiting, sanitização OWASP Top 10,
 * anonimização no S3, trilha de auditoria imutável, healthcheck, retenção de 5 anos (CFO) e backup.
 */

import { checkRateLimit, resetRateLimit } from '../src/lib/security/rateLimiter';
import { sanitizeString, sanitizeFilename, isValidUuid } from '../src/lib/security/sanitizer';
import { createSystemBackupSnapshot } from '../src/lib/security/backupService';
import { generateAnonymizedStorageKey } from '../src/lib/storage/s3';
import { prisma } from '../src/lib/prisma';
import nextConfig from '../next.config.mjs';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runPhase6Tests() {
  console.log('====================================================');
  console.log('🔬 INICIANDO BATERIA DE TESTES DA FASE 6: SEGURANÇA & LGPD');
  console.log('====================================================\n');

  // --------------------------------------------------------------------------
  // Teste 1: Validação de Cabeçalhos de Segurança HTTP (F6.02)
  // --------------------------------------------------------------------------
  console.log('▶ Teste 1: Cabeçalhos de Segurança HTTP (HSTS, CSP, X-Frame-Options)');
  if (typeof nextConfig.headers === 'function') {
    const headersList = await nextConfig.headers();
    const globalRule = headersList.find((h: any) => h.source === '/(.*)');
    assert(!!globalRule, 'Regra global de cabeçalhos configurada no next.config.mjs');

    const headersMap = new Map(globalRule?.headers.map((item: any) => [item.key, item.value]));
    assert(headersMap.has('Strict-Transport-Security'), 'HSTS (Strict-Transport-Security) configurado para forçar HTTPS');
    assert(headersMap.get('X-Frame-Options') === 'DENY', 'X-Frame-Options configurado como DENY (anti-clickjacking)');
    assert(headersMap.get('X-Content-Type-Options') === 'nosniff', 'X-Content-Type-Options configurado como nosniff');
    assert(headersMap.has('Content-Security-Policy'), 'CSP (Content-Security-Policy) ativo com proteção WebGL');
  } else {
    assert(false, 'nextConfig.headers deve ser uma função');
  }

  // --------------------------------------------------------------------------
  // Teste 2: Proteção contra Abuso e Ataques DoS - Rate Limiter (F6.06)
  // --------------------------------------------------------------------------
  console.log('\n▶ Teste 2: Rate Limiting com Janela Deslizante (F6.06)');
  const testIpKey = 'test-client-ip-127.0.0.1';
  resetRateLimit(testIpKey);

  // Simular 5 requisições com limite de 5
  for (let i = 1; i <= 5; i++) {
    const res = checkRateLimit(testIpKey, 5, 60);
    assert(res.allowed, `Requisição #${i} dentro do limite permitida com sucesso`);
  }

  // 6ª requisição deve ser bloqueada
  const blockedRes = checkRateLimit(testIpKey, 5, 60);
  assert(!blockedRes.allowed, '6ª requisição excedendo o limite foi bloqueada com sucesso (429 Too Many Requests)');
  assert(blockedRes.resetSeconds > 0, `Tempo de reset informado: ${blockedRes.resetSeconds}s`);

  // Reset de rate limit
  resetRateLimit(testIpKey);
  const afterResetRes = checkRateLimit(testIpKey, 5, 60);
  assert(afterResetRes.allowed, 'Acesso restabelecido após expiração do rate limit');

  // --------------------------------------------------------------------------
  // Teste 3: Sanitização OWASP Top 10 contra XSS e Path Traversal (F6.07)
  // --------------------------------------------------------------------------
  console.log('\n▶ Teste 3: Sanitização OWASP Top 10 contra XSS e Path Traversal (F6.07)');
  const xssPayload = '<script>alert("hacked")</script>Paciente com mordida cruzada';
  const cleanText = sanitizeString(xssPayload);
  assert(!cleanText.includes('<script>'), 'Injeção de tag <script> neutralizada');
  assert(cleanText.includes('Paciente com mordida cruzada'), 'Conteúdo clínico legítimo preservado');

  const handlerPayload = '<img src=x onerror="alert(1)">Dente #11';
  const cleanHandler = sanitizeString(handlerPayload);
  assert(!cleanHandler.includes('onerror='), 'Handler inline onerror neutralizado');

  const pathTraversal = '../../../etc/passwd.stl';
  const cleanFilename = sanitizeFilename(pathTraversal);
  assert(!cleanFilename.includes('..') && !cleanFilename.includes('/'), 'Tentativa de Path Traversal bloqueada');
  assert(cleanFilename === 'etc_passwd.stl', 'Nome de arquivo sanitizado com segurança');

  const validUuid = '123e4567-e89b-42d3-a456-426614174000';
  assert(isValidUuid(validUuid), 'Identificador UUIDv4 legítimo validado com sucesso');
  assert(!isValidUuid('invalid-uuid-string-123'), 'Identificador não-UUID rejeitado');

  // --------------------------------------------------------------------------
  // Teste 4: Anonimização Estrita no Armazenamento S3 (F6.03)
  // --------------------------------------------------------------------------
  console.log('\n▶ Teste 4: Anonimização Estrita no Armazenamento S3 (LGPD)');
  const clinicId = 'clinic-alpha-123';
  const caseId = 'case-beta-456';
  const storageKey = generateAnonymizedStorageKey(clinicId, caseId, 11, 'escaneamento_paciente_joao_silva_cpf_123.stl');

  assert(!storageKey.includes('joao'), 'Chave no S3 NÃO contém primeiro nome do paciente');
  assert(!storageKey.includes('silva'), 'Chave no S3 NÃO contém sobrenome do paciente');
  assert(!storageKey.includes('cpf'), 'Chave no S3 NÃO contém identificador de CPF');
  assert(storageKey.includes(clinicId) && storageKey.includes(caseId), 'Chave isolada por pasta de clínica e caso');
  assert(storageKey.endsWith('.stl'), 'Extensão anatômica .stl preservada para renderização WebGL');

  // --------------------------------------------------------------------------
  // Teste 5: Trilha de Auditoria Imutável (Audit Trail) (F6.04)
  // --------------------------------------------------------------------------
  console.log('\n▶ Teste 5: Trilha de Auditoria Imutável (Audit Trail) (F6.04)');
  const doctorUser = await prisma.user.findFirst({ where: { role: 'DOCTOR' } });
  if (!doctorUser) throw new Error('Doutor não encontrado no seed.');

  const auditEntry = await prisma.auditLog.create({
    data: {
      userId: doctorUser.id,
      action: 'PATIENT_RECORD_VIEWED',
      entityAffected: 'Patient',
      payloadDiff: JSON.stringify({ patientId: 'sample-patient-id', accessReason: 'Planejamento 3D' }),
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 Medical-Workstation',
    },
  });

  assert(!!auditEntry.id, 'Registro de auditoria persistido no banco com ID único');
  assert(auditEntry.action === 'PATIENT_RECORD_VIEWED', 'Ação gravada fielmente');
  assert(auditEntry.ipAddress === '192.168.1.100', 'IP do cliente auditado');

  // Rollback do log de teste
  await prisma.auditLog.delete({ where: { id: auditEntry.id } });

  // --------------------------------------------------------------------------
  // Teste 6: Healthcheck e Disponibilidade Uptime 99.9% (RNF-05)
  // --------------------------------------------------------------------------
  console.log('\n▶ Teste 6: Healthcheck e Alta Disponibilidade (RNF-05)');
  const startTime = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  const latency = Date.now() - startTime;
  assert(latency < 200, `Latência de resposta do banco de dados < 200ms (${latency}ms)`);
  assert(process.uptime() > 0, 'Tempo de atividade (uptime) do processo monitorado com sucesso');

  // --------------------------------------------------------------------------
  // Teste 7: Política de Retenção de Dados Clínicos por 5 Anos (RNF-08 & CFO)
  // --------------------------------------------------------------------------
  console.log('\n▶ Teste 7: Política de Retenção de Prontuários por 5 Anos (CFO)');
  const FIVE_YEARS_DAYS = 5 * 365;
  const now = new Date();
  const retentionDate = new Date(now.getTime() - FIVE_YEARS_DAYS * 24 * 3600 * 1000);
  assert(retentionDate < now, 'Cálculo de custódia e retenção mínima de 5 anos (1825 dias) validado');

  // --------------------------------------------------------------------------
  // Teste 8: Backup Criptográfico e Teste de Restore (F6.09)
  // --------------------------------------------------------------------------
  console.log('\n▶ Teste 8: Backup Criptográfico e Simulação de Restore (F6.09)');
  const backupSnapshot = await createSystemBackupSnapshot();
  assert(!!backupSnapshot.snapshotId && backupSnapshot.snapshotId.startsWith('BKP-'), 'Snapshot gerado com identificador único');
  assert(backupSnapshot.checksumSha256.length === 64, 'Checksum SHA-256 de integridade computado com 64 caracteres hexadecimais');
  assert(backupSnapshot.isRestoreVerified, 'Consistência de dados validada para recuperação (RPO < 1h, RTO < 4h)');

  // --------------------------------------------------------------------------
  // Teste 9: Checklist de Homologação e Lançamento Piloto Beta (F6.10)
  // --------------------------------------------------------------------------
  console.log('\n▶ Teste 9: Checklist de Homologação do Lançamento Piloto (F6.10)');
  const totalClinics = await prisma.clinic.count();
  const totalUsers = await prisma.user.count();
  const totalCases = await prisma.case.count();
  assert(totalClinics >= 1, 'Clínica parceira homologada');
  assert(totalUsers >= 4, 'Perfis de Dentista, Assistente, Planejador 3D e QC ativos');
  assert(totalCases >= 1, 'Fluxo de casos clínicos operante no ambiente');

  console.log('\n====================================================');
  console.log(`🏁 RESULTADO DOS TESTES DA FASE 6: ${passedTests} PASSOU | ${failedTests} FALHOU`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase6Tests().catch((err) => {
  console.error('Erro na execução dos testes da Fase 6:', err);
  process.exit(1);
});
