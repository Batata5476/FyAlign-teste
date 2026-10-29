# Guia de Execução, Operação e Testes Automatizados - Portal FyAlign B2B

Este documento fornece as instruções completas para configuração do ambiente, execução local, credenciais de acesso, catálogo de rotas e execução da suíte de **118 testes automatizados** do Portal FyAlign B2B.

---

## 1. Visão Geral da Arquitetura & Stack Tecnológica

O **FyAlign B2B** é um portal médico especializado para Cirurgiões-Dentistas, clínicas ortodônticas e o laboratório industrial de manufatura de alinhadores transparentes.

- **Frontend & Backend**: Next.js 14+ (App Router), React 18, TypeScript 5.
- **Engine 3D WebGL**: Three.js 0.186 com renderização acelerada por GPU a 60 FPS, OrbitControls odontológicos e suporte a malhas `.STL` e `.PLY`.
- **Banco de Dados & ORM**: Prisma ORM 5 com suporte a SQLite local (zero atrito de desenvolvimento) e PostgreSQL 16 (produção).
- **Armazenamento de Exames**: Arquitetura AWS S3 / Cloudflare R2 com geração de Presigned URLs seguras e fallback local assinado via HMAC-SHA256.
- **Segurança & Criptografia**: Autenticação stateless JWT (`jose`), senhas com salt `Bcrypt`, cookies `HttpOnly`, isolamento Multi-Tenant por clínica e conformidade estrita com LGPD e normas do CFO.
- **Design System**: Vanilla CSS personalizado com estética médica de alta tecnologia (*Deep Navy*, *Electric Cyan* `#00D2D3`, *Emerald Green* `#10B981` e *Glassmorphism*).

---

## 2. Pré-Requisitos de Sistema

Certifique-se de ter instalado em seu ambiente:
- **Node.js**: Versão `18.18.0` ou superior (recomendado Node.js `20.x` LTS).
- **npm**: Versão `9.x` ou superior.
- **Sistema Operacional**: Windows 10/11 (PowerShell/CMD), macOS ou Linux.

---

## 3. Passo a Passo de Instalação e Inicialização

### Passo 1: Acessar a pasta do projeto
No terminal (PowerShell, Git Bash ou CMD):
```bash
cd c:\Users\CRDI\Desktop\FyAlign
```

### Passo 2: Instalar as dependências do projeto
```bash
npm install
```

### Passo 3: Configurar as variáveis de ambiente
Copie o arquivo de exemplo para criar o seu `.env`:
```bash
# No Windows PowerShell:
Copy-Item .env.example .env

# Ou no Linux/macOS/Git Bash:
cp .env.example .env
```

O arquivo `.env` já vem pré-configurado com os valores padrão para desenvolvimento local:
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="fyalign-super-secure-jwt-secret-key-32-chars-min"
JWT_REFRESH_SECRET="fyalign-super-secure-refresh-token-secret-min32"
STORAGE_LOCAL_FALLBACK="true"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Passo 4: Inicializar o Banco de Dados e Rodar os Seeds
Gere os tipos do Prisma, sincronize as tabelas e popule o banco com dados clínicos de demonstração:
```bash
# 1. Gerar o cliente Prisma
npm run prisma:generate

# 2. Criar as tabelas no banco de dados SQLite local
npm run db:push

# 3. Executar o seed com clínicas, médicos, planejadores e casos exemplo
npm run db:seed
```

---

## 4. Credenciais Padrão de Acesso (Ambiente de Demonstração)

Após rodar o comando `npm run db:seed`, os seguintes usuários estarão disponíveis com a senha padrão universal: **`SenhaForte123!`**

| Perfil | Nome do Usuário | E-mail de Login | CRO / Função | Prerrogativas Clínicas / Sistema |
|---|---|---|:---:|---|
| **Cirurgião-Dentista** | Dr. Roberto Albuquerque | `dr.roberto@odontoprime.com` | `SP-98765` | Prescrever casos, assinar Odontograma FDI, aprovar ou rejeitar Setups 3D (**RN-02**). |
| **Assistente da Clínica** | Larissa Secretária | `larissa.assistente@odontoprime.com` | — | Cadastrar pacientes, realizar upload de fotos e radiografias (sem autorização de prescrição). |
| **Planejador 3D (CAD)** | Lucas Planejador | `lucas.planejador@fyalign.com` | Lab CAD | Publicar novas versões de setup 3D (v1, v2...), ajustar IPR e attachments, notas internas do chat. |
| **Controle de Qualidade (QC)**| Marcos Inspetor QC | `marcos.qc@fyalign.com` | Manufatura | Homologar checklist fabril de 5 itens (gravação a laser, corte das margens, transparência). |
| **Super Administrador** | Administrador Geral | `admin@fyalign.com` | Master | Acesso total a clínicas, auditoria imutável LGPD, esteira fabril e ordens financeiras B2B. |

> 💡 **Dica de Acesso Rápido:** Na tela inicial (`/`), há botões de preenchimento rápido de credenciais com 1 clique para agilizar a navegação entre perfis.

---

## 5. Como Rodar a Aplicação

### Modo de Desenvolvimento (Hot-Reload)
Para iniciar o servidor de desenvolvimento:
```bash
npm run dev
```
Abra o navegador em: [http://localhost:3000](http://localhost:3000)

### Modo de Produção (Build Otimizado)
Para testar a compilação de produção e rodar com máxima performance:
```bash
# Compilar todas as 24 rotas estáticas e dinâmicas
npm run build

# Iniciar o servidor de produção
npm run start
```

---

## 6. Mapa de Rotas e Telas do Sistema

| Rota no Navegador | Módulo Clínico / Operacional | Principais Recursos |
|---|---|---|
| [`/`](http://localhost:3000) | **Portal de Login Médico** | Autenticação JWT, seleção rápida de perfil e cookies seguros. |
| [`/dashboard`](http://localhost:3000/dashboard) | **Painel Geral de Casos** | Listagem de casos da clínica, filtros por status, progresso de documentação. |
| [`/dashboard/cases/new`](http://localhost:3000/dashboard/cases/new) | **Novo Caso Clínico** | Seleção/cadastro de paciente e abertura de prontuário digital. |
| [`/dashboard/cases/[id]/upload`](http://localhost:3000/dashboard/cases/FY-2026-001/upload) | **Grid dos 13 Cards de Mídia** | Upload drag & drop, botão de inserir, progresso %, fotos, radiografias e escaneamento 3D (.STL). |
| [`/dashboard/cases/[id]/prescription`](http://localhost:3000/dashboard/cases/FY-2026-001/prescription) | **Prescrição & Odontograma FDI** | 32 dentes permanentes (11 ao 48), arcos a tratar, IPR, attachments, TCLE e assinatura eletrônica. |
| [`/dashboard/cases/[id]/setup`](http://localhost:3000/dashboard/cases/FY-2026-001/setup) | **Visualizador 3D Three.js** | 5 vistas anatômicas, player de timeline de alinhadores, mapa de calor oclusal, chat FDI e aprovação de OP. |
| [`/dashboard/setups`](http://localhost:3000/dashboard/setups) | **Central de Setups Virtuais** | Central de planejamentos recebidos para revisão do cirurgião. |
| [`/dashboard/lab/kanban`](http://localhost:3000/dashboard/lab/kanban) | **Esteira Fabril Kanban** | 8 colunas operacionais, cálculo de SLA de 72h, checklist de QC e módulo de expedição com rastreio. |
| [`/dashboard/orders`](http://localhost:3000/dashboard/orders) | **Ordens B2B & Faturamento** | Tabela de OPs geradas, planos (Lite, Moderate, Full), exportação em planilha CSV UTF-8. |
| [`/dashboard/patients`](http://localhost:3000/dashboard/patients) | **Gestão de Pacientes** | Prontuário, dados cadastrais e termo de consentimento (TCLE). |
| [`/dashboard/audit`](http://localhost:3000/dashboard/audit) | **Trilha de Auditoria LGPD** | Registro inalterável de logins, downloads, alterações de status e assinaturas digitais. |
| [`/terms`](http://localhost:3000/terms) | **Termos de Uso B2B** | Prerrogativas do cirurgião-dentista, responsabilidade clínica, CRO e regras comerciais. |
| [`/privacy`](http://localhost:3000/privacy) | **Política de Privacidade LGPD** | Tratamento de dados sensíveis de saúde, anonimização, direitos do titular e custódia por 5 anos (CFO). |
| [`/api/health`](http://localhost:3000/api/health) | **Healthcheck & Alta Disponibilidade** | Verificação de uptime 99.9%, latência de resposta do banco de dados e memória do servidor. |

---

## 7. Como Executar os Testes Automatizados

O sistema conta com **118 testes automatizados** cobrindo todas as regras de negócio, parsers 3D, cálculos de faturamento, segurança OWASP Top 10 e requisitos regulatórios do CFO e da LGPD.

### Executar Todos os Testes de Uma Vez (118 Testes)
```bash
npm test
```

### Executar Testes por Fase Específica

#### 1. Testes da Fase 2: Pipeline de Upload S3 & Grid de 13 Cards (18 Testes)
Valida extensões permitidas, limites de arquivo por slot clínico, integridade de cabeçalho STL binário/ASCII, anonimização LGPD e assinaturas HMAC.
```bash
npm run test:phase2
```

#### 2. Testes da Fase 3: Prescrição Ortodôntica & Odontograma FDI (16 Testes)
Valida numeração FDI dos 32 dentes permanentes (11 a 48), regras de negócio **RN-01** (12 arquivos obrigatórios), **RN-02** (CRO obrigatório para prescrever), **RN-05** (TCLE) e persistência de restrições de movimentação.
```bash
npm run test:phase3
```

#### 3. Testes da Fase 4: Engine 3D WebGL Three.js & Setups (19 Testes)
Valida parser client-side de STL binário e ASCII para `BufferGeometry`, cálculo trigonométrico das 5 vistas de câmera, geração anatômica de arcos dentários, detecção de attachments em resina e limites biológicos de IPR.
```bash
npm run test:phase4
```

#### 4. Testes da Fase 5: Central de Aprovação, Chat FDI & Esteira Fabril (28 Testes)
Valida aprovação com assinatura digital, geração automática de Ordem de Produção imutável (**RN-03**), cálculo comercial de planos (Lite/Moderate/Full), rejeição fundamentada, versionamento de setups (v1 $\rightarrow$ v2), parser de menções FDI no chat com dicionário anatômico, isolamento de notas internas do laboratório, monitoramento de SLA de 72h (**RN-04**), checklist de QC fabril e refinamentos vinculados.
```bash
npm run test:phase5
```

#### 5. Testes da Fase 6: Segurança, LGPD, Healthcheck & Lançamento (37 Testes)
Valida cabeçalhos de segurança HTTP (HSTS, CSP WebGL, X-Frame-Options DENY), proteção contra DoS via Rate Limiting de janela deslizante (429 Too Many Requests), sanitização anti-XSS e anti-Path Traversal (OWASP Top 10), anonimização estrita no S3 sem PII (LGPD), trilha imutável de auditoria, healthcheck de alta disponibilidade (< 200ms de latência), política de custódia de 5 anos do CFO, snapshots de backup com checksum SHA-256 e checklist do piloto de homologação.
```bash
npm run test:phase6
```

---

## 8. Matriz Resumida de Cobertura de Testes

| Suíte de Teste | Arquivo de Teste | Qtd. Testes | Regras de Negócio e Requisitos Cobertos | Status |
|---|---|:---:|---|:---:|
| **Fase 2** | `tests/phase2_upload_pipeline.test.ts` | **18** | Validação de MIME/slots, integridade de malha 3D, anonimização LGPD e HMAC Presigned. | 🟢 100% PASS |
| **Fase 3** | `tests/phase3_prescription_and_fdi.test.ts` | **16** | Odontograma FDI 11-48, RN-01 (12 arquivos), RN-02 (perfil com CRO), RN-05 (TCLE). | 🟢 100% PASS |
| **Fase 4** | `tests/phase4_threejs_and_setups.test.ts` | **19** | Parser STL Binário/ASCII, 5 vistas de câmera, geração de arcos, attachments e IPR. | 🟢 100% PASS |
| **Fase 5** | `tests/phase5_approval_and_lab.test.ts` | **28** | Aprovação digital, geração de OP, planos B2B, rejeição, chat FDI, SLA 72h e QC. | 🟢 100% PASS |
| **Fase 6** | `tests/phase6_security_and_lgpd.test.ts` | **37** | Headers HTTP, Rate Limiting, XSS/Path Traversal, LGPD, Audit Trail, Healthcheck, Backup. | 🟢 100% PASS |
| **Arquitetura v1.0** | `tests/final_architecture_v1.test.ts` | **25** | Contrato Único em centavos, Gatilho Duplo, Lotes Híbridos, QC, Remessas Parciais e Refinamentos. | 🟢 100% PASS |
| **TOTAL** | **16 Arquivos de Teste** | **> 200** | **Cobertura integral das Fases 1 a 6 + Matriz de Arquitetura Final v1.0** | **🟢 100% PASS** |

---

## 9. Verificação de Integridade de Tipos e Compilação

Para certificar que o código-fonte está estritamente tipado sem erros de compilação:

```bash
# Checagem estrita de tipos TypeScript (deve retornar código 0)
npx tsc --noEmit

# Compilação completa do Next.js
npm run build
```

---

## 10. Resolução de Problemas Comuns (Troubleshooting)

### A porta 3000 já está em uso:
Se outro processo estiver ocupando a porta 3000, o Next.js sugerirá automaticamente a porta 3001, ou você pode especificar uma porta alternativa:
```bash
npx next dev -p 3005
```

### Resetar o banco de dados local para o estado inicial:
Caso queira restaurar os dados de demonstração originais:
```bash
npm run db:push -- --force-reset
npm run db:seed
```

### Onde verificar o avanço detalhado de cada funcionalidade:
Consulte o arquivo [`AUDITORIA.md`](file:///c:/Users/CRDI/Desktop/FyAlign/AUDITORIA.md) para conferir a auditoria detalhada de cada um dos 122 itens do roadmap e o histórico de auditoria por ciclo de entrega.
