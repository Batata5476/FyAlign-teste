# FyAlign B2B - Portal Odontológico de Alinhadores Transparentes

Plataforma SaaS B2B médica para Cirurgiões-Dentistas, clínicas ortodônticas e laboratório industrial de manufatura de alinhadores invisíveis.

---

## 🚀 Início Rápido

Consulte o documento completo com instruções passo a passo, credenciais de teste e matriz de testes:
👉 **[Guia Completo de Execução e Testes Automatizados (COMO_RODAR_E_TESTAR.md)](./COMO_RODAR_E_TESTAR.md)**

```bash
# 1. Instalar dependências
npm install

# 2. Configurar ambiente
cp .env.example .env

# 3. Gerar banco e rodar seeds
npm run prisma:generate
npm run db:push
npm run db:seed

# 4. Iniciar em desenvolvimento
npm run dev

# 5. Executar os 81 testes automatizados
npm test
```

---

## 📚 Documentação Técnica

- **[BluePrint de Arquitetura & Engenharia (BluePrint.md)](./BluePrint.md)**: Diagramas C4, modelo DER PostgreSQL com 10 tabelas, máquina de estados com 12 estágios e regras de negócio.
- **[Painel Vivo de Auditoria & Conformidade (AUDITORIA.md)](./AUDITORIA.md)**: 122 pontos de controle de qualidade, matriz de cobertura por fase e registro de ciclos de auditoria.
- **[Instruções de Operação & Testes (COMO_RODAR_E_TESTAR.md)](./COMO_RODAR_E_TESTAR.md)**: Credenciais de teste de todos os perfis, mapa de 20 rotas e comandos individuais de teste.
