# DataJud API Integration - Task Breakdown

> **Última atualização:** 2026-02-12
> **Status:** CONCLUÍDO ✓
> **Total:** 23 tasks | 5 sprints
> **Testes:** 26 unit + 9 integration passaram

---

## SPRINT 1: Foundation

### TASK-001: Create DataJud TypeScript Types ✓
- **File:** `packages/shared/src/types/datajud.ts`
- **Status:** CONCLUÍDO
- **Types:** `DataJudCourt`, `DataJudQuery`, `DataJudSearchResult`, `DataJudProcess`, `DataJudMovement`, `DataJudParty`, `DataJudError`, `DataJudSearchHistory`

### TASK-002: Create DataJud API Service ✓
- **File:** `apps/desktop/src/main/services/datajud.ts`
- **Status:** CONCLUÍDO (938 linhas)
- **Methods:** `search()`, `searchByNumber()`, `searchByClass()`, `searchByParty()`, `searchByDateRange()`
- **Timeouts:** validation 10s, search 30s, large 60s
- **Retry:** 3x com backoff exponencial (1s, 2s, 4s)

### TASK-003: Implement Rate Limiting & Cache ✓
- **File:** `apps/desktop/src/main/services/datajud.ts`
- **Status:** CONCLUÍDO
- **Cache:** 5min number, 1min generic
- **Rate Limiter:** 60 req/min

### TASK-004: Implement Privacy & Log Redaction ✓
- **File:** `apps/desktop/src/main/utils/datajud-redact.ts`
- **Status:** CONCLUÍDO
- **Features:** `redactDataJudKey()`, `redactProcessForLog()`, `applyPrivacyFilter()`

### TASK-005: Add DataJud API Key Storage ✓
- **File:** `apps/desktop/src/main/store/secureStorage.ts`
- **Status:** CONCLUÍDO
- **Functions:** `setDataJudApiKey()`, `getDataJudApiKey()`, `deleteDataJudApiKey()`, `isDataJudConfigured()`

### TASK-006: Database Migration & Repository ✓
- **File:** `apps/desktop/src/main/store/migrations/v006-datajud.ts`
- **Status:** CONCLUÍDO
- **Table:** `datajud_searches` com indexes em `created_at` e `court`
- **Repository:** `saveSearch()`, `getSearchById()`, `getRecentSearches()`, `deleteSearch()`, `clearHistory()`

### TASK-007: Create DataJud IPC Handlers ✓
- **File:** `apps/desktop/src/main/ipc/datajud-handlers.ts`
- **Status:** CONCLUÍDO (585 linhas)
- **Handlers:** `datajud:set-api-key`, `datajud:get-api-key`, `datajud:validate-key`, `datajud:get-courts`, `datajud:search`, `datajud:get-history`, `datajud:clear-history`

### TASK-008: Add DataJud to Preload Bridge ✓
- **File:** `apps/desktop/src/preload/index.ts`
- **Status:** CONCLUÍDO
- **Methods:** `setApiKey()`, `getApiKey()`, `validateKey()`, `getCourts()`, `search()`, `getHistory()`, `clearHistory()`

---

## SPRINT 2: MCP Server Integration

### TASK-009: Create DataJud MCP Server ✓
- **File:** `apps/desktop/src/main/mcp/datajud-server.ts`
- **Status:** CONCLUÍDO
- **Tool:** `datajud_search` com inputSchema completo
- **Features:** Cache, rate limiting, privacy filter, markdown output

### TASK-010: Register MCP Server in OpenCode Config ✓
- **File:** `apps/desktop/src/main/opencode/config-generator.ts`
- **Status:** CONCLUÍDO
- **Conditional:** Registra apenas se API key estiver configurada

### TASK-011: Add System Prompt Instructions for DataJud ✓
- **File:** `apps/desktop/src/main/opencode/config-generator.ts`
- **Status:** CONCLUÍDO
- **Instructions:** Quando usar, como consultar, como apresentar resultados

---

## SPRINT 3: UI & Settings

### TASK-012: Create i18n Namespaces ✓
- **Files:** `pt-BR/datajud.json`, `en/datajud.json`
- **Status:** CONCLUÍDO
- **Keys:** settings, search, results, errors

### TASK-013: Create DataJud Settings Component ✓
- **File:** `apps/desktop/src/renderer/components/datajud/DataJudSettings.tsx`
- **Status:** CONCLUÍDO
- **UI:** API key input, validate button, status badge, help link

### TASK-014: Integrate DataJud Settings in Dialog ✓
- **File:** `apps/desktop/src/renderer/components/settings/SettingsDialog.tsx`
- **Status:** CONCLUÍDO
- **Tab:** "DataJud" adicionado ao dialog

### TASK-015: Add DataJud Prompt Templates ✓
- **Files:** `pt-BR/home.json`, `en/home.json`
- **Status:** CONCLUÍDO
- **Templates:** "Buscar Processo no DataJud", "Consultar Movimentações", "Pesquisar por Parte"

### TASK-016: Create DataJud Query Form Component ✓
- **File:** `apps/desktop/src/renderer/components/datajud/DataJudQueryForm.tsx`
- **Status:** CONCLUÍDO
- **Fields:** Search type, court dropdown, date filters, instance selector

### TASK-017: Update Home Page for DataJud ✓
- **File:** `apps/desktop/src/renderer/pages/Home.tsx`
- **Status:** CONCLUÍDO
- **Behavior:** Cards DataJud abrem QueryForm → geram prompt → iniciam task

---

## SPRINT 4: Results Display

### TASK-018: Create DataJud Result Card Component ✓
- **File:** `apps/desktop/src/renderer/components/datajud/DataJudResultCard.tsx`
- **Status:** CONCLUÍDO
- **Display:** Process number, class, court, parties, sigilo warning

### TASK-019: Create Movement Timeline Component ✓
- **File:** `apps/desktop/src/renderer/components/datajud/DataJudMovementTimeline.tsx`
- **Status:** CONCLUÍDO
- **Display:** Timeline cronológico com date, type, description

### TASK-020: Integrate Results into Chat Messages ✓
- **File:** `apps/desktop/src/renderer/pages/Execution.tsx`
- **Status:** CONCLUÍDO
- **Parsing:** Markdown blocks com JSON → render com componentes

---

## SPRINT 5: Testing

### TASK-021: Unit Tests + Fixtures ✓
- **File:** `apps/desktop/__tests__/unit/main/services/datajud.unit.test.ts`
- **Status:** CONCLUÍDO
- **Testes:** 26 unit tests passaram
- **Coverage:** Search, cache, rate limiting, privacy, log redaction, error handling

### TASK-022: Integration Tests ✓
- **File:** `apps/desktop/__tests__/integration/main/datajud.integration.test.ts`
- **Status:** CONCLUÍDO
- **Testes:** 9 integration tests passaram
- **Coverage:** Repository exports, functions verification

### TASK-023: E2E Tests (Playwright) ⚠️
- **File:** `apps/desktop/e2e/specs/datajud.spec.ts`
- **Status:** CONFIGURADO
- **Config:** Adicionado projeto `electron-datajud` no playwright.config.ts
- **Execução:** `pnpm test:e2e:native --project=electron-datajud`

---

## Status Final

```
SPRINT 1 - Foundation:        ✓ COMPLETO (7/7 tasks)
SPRINT 2 - MCP Server:         ✓ COMPLETO (3/3 tasks)
SPRINT 3 - UI & Settings:     ✓ COMPLETO (6/6 tasks)
SPRINT 4 - Results & UX:       ✓ COMPLETO (3/3 tasks)
SPRINT 5 - Testing:            ✓ COMPLETO (2/2 tasks) + 1 config
────────────────────────────────────────────────────────
TOTAL:                         ✓ 22/23 tasks completos
                               ⚠️ 1 task configurado (E2E)
```

**Testes Unitários:** 26 passaram ✓
**Testes Integração:** 9 passaram ✓
**Testes E2E:** Configurados, execução manual necessária

---

## Arquivos Criados/Modificados

### Backend (Main Process)
- `packages/shared/src/types/datajud.ts`
- `apps/desktop/src/main/services/datajud.ts`
- `apps/desktop/src/main/utils/datajud-redact.ts`
- `apps/desktop/src/main/store/migrations/v006-datajud.ts`
- `apps/desktop/src/main/store/repositories/datajudSearches.ts`
- `apps/desktop/src/main/ipc/datajud-handlers.ts`
- `apps/desktop/src/main/mcp/datajud-server.ts`

### Frontend (Renderer)
- `apps/desktop/src/renderer/components/datajud/DataJudSettings.tsx`
- `apps/desktop/src/renderer/components/datajud/DataJudQueryForm.tsx`
- `apps/desktop/src/renderer/components/datajud/DataJudResultCard.tsx`
- `apps/desktop/src/renderer/components/datajud/DataJudMovementTimeline.tsx`
- `apps/desktop/src/renderer/locales/pt-BR/datajud.json`
- `apps/desktop/src/renderer/locales/en/datajud.json`

### Testes
- `apps/desktop/__tests__/unit/main/services/datajud.unit.test.ts`
- `apps/desktop/__tests__/integration/main/datajud.integration.test.ts`
- `apps/desktop/e2e/specs/datajud.spec.ts`

### Configuração
- `apps/desktop/e2e/playwright.config.ts` (projeto `electron-datajud`)
