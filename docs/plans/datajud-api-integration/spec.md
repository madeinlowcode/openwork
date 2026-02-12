# DataJud API Integration - Technical Specification

> **Última atualização:** 2026-02-11
> **Status:** APROVADO - Pronto para implementação

## 1. API Overview

**DataJud** is the National Database of the Judiciary, providing public access to metadata and case movements across Brazil's judicial system.

### Base URL
```
https://api-publica.datajud.cnj.jus.br/{court_alias}/_search
```

### Authentication
```
Authorization: APIKey {public_key}
```

### Method: POST with Elasticsearch Query DSL

### Available Courts (Partial List)
| Alias | Court |
|-------|-------|
| `api_publica_stj` | Superior Court of Justice |
| `api_publica_tst` | Superior Labor Court |
| `api_publica_tse` | Superior Electoral Court |
| `api_publica_stm` | Superior Military Court |
| `api_publica_trf1` to `trf6` | Regional Federal Courts |
| `api_publica_tj{state}` | State Courts (e.g. `tjsp`, `tjrj`, `tjmg`) |
| `api_publica_trt{1-24}` | Labor Courts |
| `api_publica_tre{state}` | Electoral Courts |

### Searchable Fields
| Field | Type | Description |
|-------|------|-------------|
| `numeroProcesso` | text | CNJ process number |
| `classe.codigo` | text | Procedural class code (TPU) |
| `orgaoJulgador.codigo` | text | Judging body code |
| `tribunal` | text | Court acronym |
| `grau` | text | Instance level (G1, G2, JE) |
| `dataAjuizamento` | datetime | Filing date |
| `partes` | object[] | Parties involved |
| `movimentacoes` | object[] | Case movements |
| `nivelSigilo` | long | Confidentiality level |

### Query Examples

**By process number:**
```json
{
  "query": {
    "match": { "numeroProcesso": "0000000-00.0000.0.00.0000" }
  }
}
```

**By class and date range:**
```json
{
  "size": 50,
  "query": {
    "bool": {
      "must": [{ "match": { "classe.codigo": "1234" } }],
      "filter": [{
        "range": { "dataAjuizamento": { "gte": "2024-01-01", "lte": "2024-12-31" } }
      }]
    }
  },
  "sort": ["_id"]
}
```

### Response Structure
```json
{
  "hits": {
    "total": { "value": 100 },
    "hits": [{
      "_source": {
        "numeroProcesso": "...",
        "classe": { "codigo": "...", "nome": "..." },
        "tribunal": "TJSP",
        "grau": "G1",
        "dataAjuizamento": "2024-01-15",
        "partes": [...],
        "movimentacoes": [...]
      }
    }]
  }
}
```

### Pagination
- `size`: 10-10,000 records per page
- `search_after`: cursor-based deep pagination

### Restrictions
- Public, non-confidential processes only
- Free API, no cost
- API Key required (public key from CNJ)
- Terms of Use compliance mandatory

## 2. Current App Architecture (Relevant Parts)

### Pre-defined Prompt Modals
- Located in `Home.tsx` with 9 use cases (legal-focused)
- Each maps to translation keys with `title`, `description`, `prompt`
- On click: sets prompt in input → user sends → `startTask({prompt})`

### Existing Legal Use Cases
- `consultarProcesso` - Already exists as a prompt template
- `buscarJurisprudencia` - Exists as a prompt template

### IPC Flow
```
Renderer → Preload → Main Process → OpenCode CLI → API calls
```

### Task System
- Tasks run via OpenCode CLI (node-pty)
- Support for tools: browser, file operations, etc.
- Permission system for file/tool/question types

## 3. Integration Approach: MCP Server

### Decisão: MCP Server para integração com o agent

**Rationale:**
1. MCP (Model Context Protocol) é o padrão profissional para tools de AI agents
2. O agent pode invocar o tool `datajud_search` nativamente
3. Arquitetura escalável - permite adicionar mais tools futuramente
4. Debugging facilitado via MCP protocol logging
5. Browser usado apenas como fallback explícito do usuário

### MCP Server Structure
```typescript
// src/main/mcp/datajud-server.ts
export class DataJudMCPServer {
  tools = [{
    name: 'datajud_search',
    description: 'Search Brazilian judiciary processes via DataJud API',
    inputSchema: {
      type: 'object',
      properties: {
        court: { type: 'string', description: 'Court alias (e.g. api_publica_stj)' },
        query_type: { type: 'string', enum: ['number', 'class', 'party', 'date_range'] },
        value: { type: 'string', description: 'Search value' },
        size: { type: 'number', default: 10 },
        filters: { type: 'object', properties: {
          date_from: { type: 'string' },
          date_to: { type: 'string' },
          instance: { type: 'string', enum: ['G1', 'G2', 'JE'] }
        }}
      },
      required: ['court', 'query_type', 'value']
    }
  }]
}
```

### When to use browser:
- If the user wants to navigate the DataJud portal visually
- If results need to be cross-referenced with other web sources
- If the API is temporarily unavailable

## 4. API Key Management

### Storage
- Store DataJud API key using `electron-store` with AES-256-GCM encryption (existing `secureStorage.ts` pattern)
- **NÃO** usa `keytar` nativo - usa criptografia customizada com salt derivado de hostname, platform, user home, app path
- Add `datajud` as a new service in secure storage

### Validation
```typescript
// Endpoint de validação: api_publica_stj/_search
// Test query:
POST https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search
{ "size": 1, "query": { "match_all": {} } }

// Timeout: 10s
// Validar HTTP 200 + estrutura da resposta (hits.total)
```

### Configuration
- Settings dialog gets a new "DataJud" section
- User can input their API key
- Validation via test query on save
- Status badge: connected/disconnected/validating

## 5. Error Handling Specification

### Timeouts
```typescript
const DATAJUD_TIMEOUTS = {
  validation: 10_000,    // 10s para validar API key
  search: 30_000,        // 30s para searches normais
  largeSearch: 60_000,   // 60s para searches com size > 1000
};
```

### Retry Logic
```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000,    // 1s
  backoffMultiplier: 2,  // 1s, 2s, 4s
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};
```

### Error Types
```typescript
export class DataJudError extends Error {
  constructor(
    message: string,
    public code: 'NETWORK' | 'AUTH' | 'RATE_LIMIT' | 'INVALID_QUERY' | 'NO_RESULTS' | 'TIMEOUT' | 'SIGILO',
    public statusCode?: number
  ) {
    super(message);
    this.name = 'DataJudError';
  }
}
```

### Edge Cases
| Cenário | Tratamento |
|---------|------------|
| API key inválida durante search | Mostrar dialog de settings |
| Network offline | Mensagem "offline", não fazer retry |
| Processo não encontrado | Retornar `{ hits: { total: 0 } }` com mensagem amigável |
| API retorna HTML (erro 500) | Parse error, retry com backoff |
| Large result sets (>10k) | Paginated UI com warning |
| `nivelSigilo > 0` | Ocultar partes e movimentações, exibir warning |
| API key em logs | Redact automático via utility function |

## 6. Data Privacy

### Validação de Sigilo
```typescript
if (process.nivelSigilo > 0) {
  return {
    ...process,
    partes: [],
    movimentacoes: [],
    _warning: 'Processo com sigilo - dados sensíveis não exibidos'
  };
}
```

### Log Redaction
```typescript
export function redactDataJudKey(text: string): string {
  return text.replace(/APIKey [a-zA-Z0-9\-_]+/g, 'APIKey [REDACTED]');
}
```

## 7. SQLite Persistence

### Search History Table
```sql
CREATE TABLE datajud_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  court TEXT NOT NULL,
  query_type TEXT NOT NULL,
  query_value TEXT NOT NULL,
  result_count INTEGER DEFAULT 0,
  response_data TEXT,          -- JSON string of results (cached)
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  task_id TEXT,                -- FK to task that triggered this search
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

CREATE INDEX idx_datajud_searches_created_at ON datajud_searches(created_at);
CREATE INDEX idx_datajud_searches_court ON datajud_searches(court);
```

### Cache Strategy
- Cache results por 5 minutos (por número de processo)
- Cache de 1 minuto para consultas genéricas
- In-memory Map + SQLite para persistência
- Rate limiter: 60 req/min (conservador)
