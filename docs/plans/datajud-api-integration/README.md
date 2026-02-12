# DataJud API Integration Plan

> **Status:** APROVADO | **Score:** 8.5/10 | **Data:** 2026-02-11

## Decisões Arquiteturais

| Decisão | Escolha |
|---------|---------|
| Tool Integration | **MCP Server** (Model Context Protocol) |
| API Key Storage | **electron-store** + AES-256-GCM (padrão existente) |
| Persistência | **SQLite** - tabela `datajud_searches` |
| Abordagem | **Agent-First** com Browser Fallback |

## Escopo

- **23 tasks** organizadas em **5 sprints**
- MVP (Sprints 1+2): Service + MCP Server + Cache + Rate Limiting + Privacy
- Full UX (Sprint 3): Settings UI + Prompt Templates + Query Form
- Rich Display (Sprint 4): Result Cards + Movement Timeline
- Quality (Sprint 5): Unit + Integration + E2E Tests

## Documents

| Arquivo | Descrição |
|---------|-----------|
| `spec.md` | Especificação técnica da API, error handling, privacy, SQLite schema |
| `plan.md` | Plano de implementação em 5 fases com sprint plan |
| `tasks.md` | 23 tasks granulares com dependências e esforço |
| `architecture.md` | ADRs, diagramas de fluxo, estrutura de componentes |
| `senior-review.md` | Revisão de engenheiro sênior com recomendações aplicadas |
