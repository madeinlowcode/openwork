# DataJud API Integration - Implementation Plan

> **Última atualização:** 2026-02-12
> **Status:** CONCLUÍDO ✓
> **Decisões:** MCP Server + SQLite persistence + electron-store (AES-256-GCM)

---

## Status de Conclusão por Fase

### Phase 1: Foundation (API Key, Service, Database) - CONCLUÍDO ✓
| Step | Status | Descrição |
|------|--------|-----------|
| 1.1 | ✓ | TypeScript Types em `packages/shared/src/types/datajud.ts` |
| 1.2 | ✓ | DataJud API Service em `src/main/services/datajud.ts` |
| 1.3 | ✓ | Rate Limiting & Cache implementados |
| 1.4 | ✓ | Privacy & Security (sigilo, log redaction) |
| 1.5 | ✓ | API Key Storage com AES-256-GCM |
| 1.6 | ✓ | Database Migration v006 + Repository |
| 1.7 | ✓ | IPC Handlers em `datajud-handlers.ts` |
| 1.8 | ✓ | Preload Bridge exposto |

### Phase 2: MCP Server Integration - CONCLUÍDO ✓
| Step | Status | Descrição |
|------|--------|-----------|
| 2.1 | ✓ | MCP Server Implementation em `src/main/mcp/datajud-server.ts` |
| 2.2 | ✓ | Registro no config-generator.ts |
| 2.3 | ✓ | System Prompt Instructions |

### Phase 3: Settings & Prompt Templates - CONCLUÍDO ✓
| Step | Status | Descrição |
|------|--------|-----------|
| 3.1 | ✓ | i18n Namespaces (pt-BR, en) |
| 3.2 | ✓ | DataJud Settings Component |
| 3.3 | ✓ | Integrate Settings in Dialog |
| 3.4 | ✓ | Prompt Templates |
| 3.5 | ✓ | Query Form Component |

### Phase 4: Results Display - CONCLUÍDO ✓
| Step | Status | Descrição |
|------|--------|-----------|
| 4.1 | ✓ | Result Card Component |
| 4.2 | ✓ | Movement Timeline Component |
| 4.3 | ✓ | Integrate Results in Chat |

### Phase 5: Testing - CONCLUÍDO ✓
| Step | Status | Descrição |
|------|--------|-----------|
| 5.1 | ✓ | **Unit Tests**: 26 testes passaram |
| 5.2 | ✓ | **Integration Tests**: 9 testes passaram |
| 5.3 | ⚠️ | E2E Tests: Configurados, requerem execução manual |
| 5.4 | ✓ | Test Fixtures criados |

---

## Resumo da Implementação

### Arquivos Criados/Modificados

#### Backend (Main Process)
- `packages/shared/src/types/datajud.ts` - Tipos TypeScript
- `apps/desktop/src/main/services/datajud.ts` - Serviço da API (938 linhas)
- `apps/desktop/src/main/utils/datajud-redact.ts` - Redução de logs
- `apps/desktop/src/main/store/migrations/v006-datajud.ts` - Migration
- `apps/desktop/src/main/store/repositories/datajudSearches.ts` - Repository
- `apps/desktop/src/main/ipc/datajud-handlers.ts` - IPC Handlers (585 linhas)
- `apps/desktop/src/main/mcp/datajud-server.ts` - MCP Server

#### Frontend (Renderer)
- `apps/desktop/src/renderer/components/datajud/DataJudSettings.tsx` - Configurações
- `apps/desktop/src/renderer/components/datajud/DataJudQueryForm.tsx` - Formulário
- `apps/desktop/src/renderer/components/datajud/DataJudResultCard.tsx` - Cartão de resultado
- `apps/desktop/src/renderer/components/datajud/DataJudMovementTimeline.tsx` - Timeline
- `apps/desktop/src/renderer/locales/pt-BR/datajud.json` - Traduções PT-BR
- `apps/desktop/src/renderer/locales/en/datajud.json` - Traduções EN

#### Testes
- `apps/desktop/__tests__/unit/main/services/datajud.unit.test.ts` - Unit Tests
- `apps/desktop/__tests__/integration/main/datajud.integration.test.ts` - Integration Tests
- `apps/desktop/e2e/specs/datajud.spec.ts` - E2E Tests

### Testes Executados

```bash
pnpm -F @jurisiar/desktop test -- --run "datajud"
```

**Resultados:**
- ✓ **26 Unit Tests** passaram
- ✓ **9 Integration Tests** passaram
- ⚠️ **E2E Tests** configurados e prontos para execução

### Funcionalidades Implementadas

1. **Busca por Número**: Pesquisa por NPU (formato CNJ)
2. **Busca por Classe**: Pesquisa por tipo de processo
3. **Busca por Parte**: Pesquisa por nome de autor/réu
4. **Busca por Data**: Pesquisa em intervalo de datas
5. **Cache**: 5min para buscas por número, 1min para genéricas
6. **Rate Limiting**: 60 req/min
7. **Retry**: 3 tentativas com backoff exponencial
8. **Privacidade**: Filtro de sigilo judicial
9. **Histórico**: Salvamento e visualização de buscas anteriores
10. **MCP Server**: Ferramenta `datajud_search` para agentes

### Correções de Build/TypeScript

1. Correção de imports usando `@accomplish/shared` alias
2. Type casting para status codes de retry
3. Exportação de funções internas para testes
4. Correção de duplicação em `datajud-redact.ts`
5. Mock de Electron app para testes de integração

---

## Risk Assessment (Atualizado)

### Step 1.1 - TypeScript Types
- Create shared types in `packages/shared/src/types/datajud.ts`
- Interfaces: `DataJudCourt`, `DataJudQuery`, `DataJudSearchResult`, `DataJudProcess`, `DataJudMovement`, `DataJudParty`, `DataJudError`

### Step 1.2 - DataJud API Service
- Create `src/main/services/datajud.ts`
- HTTP client using `fetch`
- Methods: `search()`, `searchByNumber()`, `searchByClass()`, `searchByParty()`, `searchByDateRange()`
- Error handling with typed errors (`DataJudError`)
- Timeouts: validation 10s, search 30s, large 60s
- Retry: 3x with exponential backoff (1s, 2s, 4s)
- Retryable status codes: 408, 429, 500, 502, 503, 504

### Step 1.3 - Rate Limiting & Cache
- In-memory cache: 5min for number searches, 1min for generic
- Rate limiter: 60 req/min (conservador)
- Cache key: JSON.stringify(query params)

### Step 1.4 - Privacy & Security
- Validate `nivelSigilo > 0` → ocultar partes e movimentações
- Log redaction: `redactDataJudKey()` utility
- Never log API key in plain text

### Step 1.5 - API Key Storage
- Add DataJud API key to `secureStorage.ts` (electron-store + AES-256-GCM)
- Functions: `setDataJudApiKey()`, `getDataJudApiKey()`, `deleteDataJudApiKey()`

### Step 1.6 - Database Migration
- Create `v00X-datajud.ts` migration
- Table `datajud_searches`: id, court, query_type, query_value, result_count, response_data, created_at, task_id
- Indexes on created_at and court
- Repository: `datajudSearches.ts` with CRUD operations

### Step 1.7 - IPC Handlers
- Create `src/main/ipc/datajud-handlers.ts`
- Handlers: `datajud:set-api-key`, `datajud:get-api-key`, `datajud:validate-key`, `datajud:get-courts`, `datajud:get-history`, `datajud:clear-history`
- Register in main `handlers.ts`

### Step 1.8 - Preload Bridge
- Expose `window.accomplish.datajud.*` via contextBridge
- Methods: `setApiKey()`, `getApiKey()`, `validateKey()`, `getCourts()`, `getHistory()`, `clearHistory()`

## Phase 2: MCP Server Integration

### Step 2.1 - MCP Server Implementation
- Create `src/main/mcp/datajud-server.ts` (standalone process)
- Register tool `datajud_search` with full inputSchema
- Handle tool calls → DataJud Service → formatted results
- Return markdown-formatted results for chat display
- Include cache and rate limiting in the MCP server process

### Step 2.2 - Register MCP Server in Config
- Update `config-generator.ts` to register DataJud MCP server
- Pass `NODE_BIN_PATH` in environment
- Conditional: only register if API key is configured

### Step 2.3 - System Prompt Instructions
- Add instructions to system prompt so agent knows when/how to use `datajud_search`
- Include: query types, court aliases, result interpretation, formatting guidelines
- Agent should ask user for search type and court when not specified

## Phase 3: Settings & Prompt Templates

### Step 3.1 - i18n Namespaces
- Create `apps/desktop/src/renderer/locales/pt-BR/datajud.json`
- Create `apps/desktop/src/renderer/locales/en/datajud.json`
- Keys: settings, search, results, errors

### Step 3.2 - DataJud Settings Component
- Create `DataJudSettings.tsx`
- UI: API key input, validate button, status badge, help link to CNJ docs
- Integration with secureStorage via IPC

### Step 3.3 - Integrate Settings in Dialog
- Add "DataJud" tab to existing SettingsDialog

### Step 3.4 - Prompt Templates
- Update/add use cases in `home.json`: "Buscar Processo no DataJud", "Consultar Movimentações", "Pesquisar por Parte"
- Update `Home.tsx` USE_CASE_KEYS array

### Step 3.5 - Query Form Component
- Create `DataJudQueryForm.tsx` modal
- Fields: search type, court dropdown (hierarchical), search input, date filters
- Click DataJud card → open form → generate structured prompt → start task

## Phase 4: Results Display

### Step 4.1 - Result Card Component
- Create `DataJudResultCard.tsx`
- Display: process number, class, court, date, parties, status
- Actions: copy number, expand details
- Loading, error, empty states

### Step 4.2 - Movement Timeline Component
- Create `DataJudMovementTimeline.tsx`
- Chronological timeline with date, type, description
- Expandable/collapsible

### Step 4.3 - Integrate Results in Chat
- When agent returns DataJud results, render with rich components
- Parse markdown blocks with DataJud data into structured cards

## Phase 5: Testing

### Step 5.1 - Unit Tests
```
describe('DataJudService')
  - searchByNumber: formats number, makes POST, parses response
  - searchByClass: builds bool query correctly
  - error handling: throws DataJudError on 401, 429, timeout
  - retry: retries on 500/502/503, respects backoff
  - cache: returns cached results within TTL, invalidates after
  - privacy: filters nivelSigilo > 0 processes
  - log redaction: never exposes API key in logs
```

### Step 5.2 - Integration Tests
```
describe('DataJud IPC')
  - stores API key securely via IPC
  - validates API key via test query
  - performs search via IPC and returns results
  - saves search to history in SQLite
  - handles network errors gracefully
```

### Step 5.3 - E2E Tests
```
describe('DataJud E2E')
  - settings: configure API key, validate, see status badge
  - search: click prompt card → fill form → run search → see results
  - history: previous searches appear in history
  - error: invalid key shows error message
  - pagination: load more results
```

### Step 5.4 - Test Fixtures
- Mock DataJud API responses in `tests/fixtures/datajud/`
- Mock network errors, rate limiting, empty results

---

## Risk Assessment (Atualizado)

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| API key revoked | Low | High | Guide to re-obtain, clear error message |
| API rate limiting | Medium | Medium | 60 req/min limiter, cache, backoff |
| API schema change | Low | High | Version check, error handling, fallback |
| Large result sets | Medium | Low | Pagination, max size 10k |
| Network errors | Medium | Medium | Retry 3x, offline message |
| Processo sigiloso | Medium | High | Validate `nivelSigilo`, hide sensitive data |
| API key leak in logs | Medium | High | `redactDataJudKey()` em todos os logs |
| Concurrent searches crash | Low | Medium | Queue com max 3 concurrent |
| CNJ muda URL base | Low | Alta | Configurável via settings |

## Sprint Plan

```
SPRINT 1 - Foundation (1 semana):
├── TASK-001: TypeScript Types
├── TASK-002: DataJud Service (com error handling completo)
├── TASK-003: Rate Limiting & Cache
├── TASK-004: Privacy & Log Redaction
├── TASK-005: API Key Storage
├── TASK-006: Database Migration + Repository
├── TASK-007: IPC Handlers
└── TASK-008: Preload Bridge

SPRINT 2 - MCP Server (1 semana):
├── TASK-009: MCP Server Implementation
├── TASK-010: Register MCP in Config
└── TASK-011: System Prompt Instructions

SPRINT 3 - UI & Settings (1 semana):
├── TASK-012: i18n Namespaces
├── TASK-013: Settings Component
├── TASK-014: Integrate Settings in Dialog
├── TASK-015: Prompt Templates
├── TASK-016: Query Form Component
└── TASK-017: Update Home Page

SPRINT 4 - Results & UX (1 semana):
├── TASK-018: Result Card Component
├── TASK-019: Movement Timeline
└── TASK-020: Integrate Results in Chat

SPRINT 5 - Testing (1 semana):
├── TASK-021: Unit Tests + Fixtures
├── TASK-022: Integration Tests
└── TASK-023: E2E Tests
```
