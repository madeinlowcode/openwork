# DataJud API Integration - Architecture

> **Última atualização:** 2026-02-11
> **Status:** APROVADO - Decisões finalizadas

## Architecture Decision Records

### ADR-001: Agent-First with Browser Fallback

**Decision:** Use direct HTTP API calls as primary method for DataJud queries.

**Rationale:**
- DataJud API is a clean REST/Elasticsearch API - no browser needed
- HTTP requests are 10-50x faster than browser automation
- JSON responses are easily parsed and formatted
- Agent can present results inline in chat
- Browser reserved for explicit user request or API unavailability

### ADR-002: API Key via electron-store (AES-256-GCM)

**Decision:** Store DataJud API key using existing `secureStorage.ts` with `electron-store` and AES-256-GCM encryption.

**Rationale:**
- Consistente com o padrão atual do codebase (NÃO usa `keytar`)
- Criptografia AES-256-GCM com salt derivado de machine-specific data
- Evita prompts de Keychain no macOS
- Adequado para API keys que podem ser rotacionadas
- Separação dev/prod (`secure-storage` vs `secure-storage-dev`)

### ADR-003: MCP Server para Tool Integration

**Decision:** Criar um MCP (Model Context Protocol) Server dedicado para o DataJud, permitindo que o OpenCode agent invoque `datajud_search` nativamente.

**Rationale:**
- MCP é o padrão profissional para tools de AI agents
- Agent pode invocar ferramentas nativamente sem interceptação de output
- Arquitetura escalável para adicionar mais tools jurídicos no futuro
- Debugging via MCP protocol logging
- Separação de responsabilidades (MCP server = service boundary)
- Compatível com qualquer LLM que suporte MCP

**Implementação:**
```typescript
// src/main/mcp/datajud-server.ts → standalone MCP server
// Registrado em config-generator.ts:
mcpServers: {
  datajud: {
    command: bundledNodePath,
    args: [path.join(__dirname, 'mcp/datajud-server.js')],
    env: { NODE_BIN_PATH: bundledPaths?.binDir || '' }
  }
}
```

### ADR-004: Persistência de Histórico em SQLite

**Decision:** Persistir histórico de buscas DataJud em tabela dedicada no SQLite.

**Rationale:**
- Permite re-execução rápida de buscas anteriores
- Cache de resultados reduz chamadas à API
- Histórico associado a tasks via foreign key
- Migração via sistema existente de migrations

## Data Flow Diagram (Atualizado com MCP)

```
┌─────────────────────────────────────────────────────────────┐
│                        RENDERER                              │
│                                                              │
│  Home.tsx                    Execution.tsx                    │
│  ┌──────────────┐           ┌───────────────────────┐       │
│  │ DataJud Card │──click──→│ Task with DataJud tool │       │
│  │ (prompt)     │           │ calls and results     │       │
│  └──────────────┘           └───────────────────────┘       │
│         │                            ↑                       │
│         ↓                            │                       │
│  ┌──────────────┐           ┌────────────────┐              │
│  │ Query Form   │           │ Result Cards   │              │
│  │ (modal)      │           │ + Timeline     │              │
│  └──────┬───────┘           └────────────────┘              │
│         │                            ↑                       │
└─────────│────────────────────────────│───────────────────────┘
          │ window.accomplish.*        │ task:update events
          ↓                            │
┌─────────────────────────────────────────────────────────────┐
│                      PRELOAD BRIDGE                          │
└─────────────────────────────────────────────────────────────┘
          │ ipcRenderer                │ ipcRenderer.on
          ↓                            │
┌─────────────────────────────────────────────────────────────┐
│                     MAIN PROCESS                             │
│                                                              │
│  ┌─────────────────┐    ┌──────────────────┐                │
│  │ DataJud IPC     │    │ OpenCode Adapter  │                │
│  │ Handlers        │    │ (node-pty)        │                │
│  │ (settings,      │    │                   │                │
│  │  history)       │    │ ┌───────────────┐ │                │
│  └────────┬────────┘    │ │ MCP Protocol  │ │                │
│           │             │ └───────┬───────┘ │                │
│           │             └─────────│─────────┘                │
│           │                       │                          │
│           ↓                       ↓                          │
│  ┌──────────────┐    ┌──────────────────────┐               │
│  │ SQLite DB    │    │ DataJud MCP Server   │               │
│  │ (searches    │←──│ (standalone process)  │               │
│  │  history)    │    │                       │               │
│  └──────────────┘    │ ┌───────────────────┐│               │
│                      │ │ DataJud Service   ││               │
│                      │ │ - search()        ││               │
│                      │ │ - cache           ││               │
│                      │ │ - rate limiter    ││               │
│                      │ └───────────┬───────┘│               │
│                      └─────────────│────────┘               │
│                                    │                         │
└────────────────────────────────────│─────────────────────────┘
                                     │ HTTPS POST
                                     ↓
┌─────────────────────────────────────────────────────────────┐
│            DataJud API (CNJ)                                 │
│  https://api-publica.datajud.cnj.jus.br/{court}/_search     │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture (Atualizado)

```
src/
├── main/
│   ├── mcp/
│   │   └── datajud-server.ts          # MCP Server (standalone)
│   ├── services/
│   │   ├── datajud.ts                 # API client (usado pelo MCP server)
│   │   └── datajud.types.ts           # Internal types
│   ├── ipc/
│   │   └── datajud-handlers.ts        # IPC handlers (settings, history)
│   └── store/
│       ├── secureStorage.ts           # + DataJud API key
│       ├── repositories/
│       │   └── datajudSearches.ts     # Search history repository
│       └── migrations/
│           └── v00X-datajud.ts        # New migration
├── renderer/
│   ├── components/
│   │   └── datajud/
│   │       ├── DataJudQueryForm.tsx    # Query builder modal
│   │       ├── DataJudResultCard.tsx   # Process result card
│   │       ├── DataJudMovementTimeline.tsx # Movement list
│   │       └── DataJudSettings.tsx     # API key settings
│   └── locales/
│       ├── pt-BR/datajud.json         # i18n PT-BR
│       └── en/datajud.json            # i18n EN
└── packages/shared/
    └── src/types/
        └── datajud.ts                 # Shared interfaces
```

## MCP Server Architecture Detail

```
┌────────────────────────────────────┐
│     DataJud MCP Server             │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ Tool: datajud_search         │  │
│  │ - court (string)             │  │
│  │ - query_type (enum)          │  │
│  │ - value (string)             │  │
│  │ - size (number, default 10)  │  │
│  │ - filters (object, optional) │  │
│  └──────────┬───────────────────┘  │
│             │                      │
│  ┌──────────▼───────────────────┐  │
│  │ DataJud Service              │  │
│  │ ┌─────────────────────────┐  │  │
│  │ │ Rate Limiter (60/min)   │  │  │
│  │ ├─────────────────────────┤  │  │
│  │ │ In-Memory Cache         │  │  │
│  │ │ - 5min for number       │  │  │
│  │ │ - 1min for generic      │  │  │
│  │ ├─────────────────────────┤  │  │
│  │ │ HTTP Client (fetch)     │  │  │
│  │ │ - timeout: 30s          │  │  │
│  │ │ - retry: 3x backoff     │  │  │
│  │ ├─────────────────────────┤  │  │
│  │ │ Privacy Filter          │  │  │
│  │ │ - nivelSigilo check     │  │  │
│  │ │ - log redaction         │  │  │
│  │ └─────────────────────────┘  │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

## Court Selection Strategy

Courts are organized hierarchically:
```
Superior Courts (STJ, TST, TSE, STM)
├── Federal (TRF1-6)
├── State (TJ + state code)
├── Labor (TRT1-24)
├── Electoral (TRE + state code)
└── Military (TJM + state code)
```

The query form provides:
1. Category dropdown (Superior, Federal, State, Labor, Electoral)
2. Specific court dropdown (filtered by category)
3. OR "All courts" option (queries multiple endpoints sequentially)
