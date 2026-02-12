# DataJud API Integration - Senior Engineering Review

**Reviewer:** Claude Code (Sonnet 4.5)
**Date:** 2026-02-11
**Status:** ✅ APPROVED WITH RECOMMENDATIONS

---

## Executive Summary

O plano de integração da API DataJud está **bem estruturado e tecnicamente sólido**. A decisão arquitetural (Agent-First com Browser Fallback) está correta para este caso de uso. O plano demonstra compreensão profunda da arquitetura Electron existente e segue os padrões estabelecidos no codebase.

**Principais pontos positivos:**
- Decisão arquitetural correta (HTTP API primeiro, browser como fallback)
- Segue padrões existentes de IPC/preload/renderer
- Segurança adequada usando `keytar` para API keys
- Task breakdown lógico e bem estruturado
- Documentação completa

**Áreas que requerem atenção:**
- Falta de clareza sobre integração com OpenCode CLI tools
- Ausência de estratégia de cache/otimização
- Tratamento de erros incompleto para cenários edge
- Falta de plano de migração de dados
- Testes E2E podem ser mais específicos

---

## 1. Análise da Decisão Arquitetural

### ✅ Agent-First com Browser Fallback: CORRETO

**Rationale validado:**
- DataJud é uma API REST/Elasticsearch pública - não requer navegação web
- HTTP direto é 10-50x mais rápido que automação de browser
- JSON responses são estruturados e fáceis de parsear
- Agent pode formatar resultados em markdown inline
- Browser útil apenas para exploração visual do portal DataJud

**Comparação com arquitetura existente:**
O app já segue este padrão:
- `src/main/services/speechToText.ts` - HTTP API direto
- `src/main/services/summarizer.ts` - HTTP API direto
- `src/main/opencode/adapter.ts` - Tools via OpenCode CLI

**Recomendação:** ✅ **MANTER** a decisão Agent-First.

---

## 2. Análise de Segurança

### ✅ API Key Storage: ADEQUADO COM RESSALVAS

**Pontos positivos:**
- Uso de `secureStorage.ts` existente (AES-256-GCM)
- Derivação de chave usando machine-specific data
- Separação dev/prod (`secure-storage` vs `secure-storage-dev`)
- Validação de API key via test query

**⚠️ RESSALVAS IMPORTANTES:**

#### 2.1 Não é Keychain Nativo
O código em `src/main/store/secureStorage.ts` usa `electron-store` com criptografia customizada, **NÃO** `keytar` (macOS Keychain/Windows Credential Vault).

```typescript
// REALIDADE ATUAL (linhas 1-50 de secureStorage.ts):
import Store from 'electron-store';  // ← Não é keytar!
import * as crypto from 'crypto';

// Encryption com AES-256-GCM usando salt derivado de:
// - hostname, platform, user home, app path
```

**Implicações:**
- ✅ Evita prompts de Keychain no macOS
- ⚠️ Menos seguro que Keychain nativo (chave pode ser reverse-engineered)
- ✅ Adequado para API keys que podem ser rotacionadas

**Recomendação para DataJud:**
1. ✅ **USAR** o `secureStorage.ts` existente (consistência)
2. ✅ Adicionar validação de API key antes de armazenar
3. ✅ Documentar no UI que a chave é criptografada, mas não em Keychain nativo
4. ⚠️ **CONSIDERAR** migração futura para keytar se houver demanda

#### 2.2 Validação de API Key

**TASK-004** menciona `datajud:validate-key`, mas falta especificar:

```typescript
// ADICIONAR AO PLANO:
interface DataJudValidationRequest {
  court: string;  // Qual tribunal usar para validação?
  timeout: number; // Timeout do test query (recomendado: 10s)
}

// Test query sugerido:
POST https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search
{
  "size": 1,
  "query": { "match_all": {} }
}
```

**Recomendação:**
- ✅ Especificar exatamente qual endpoint usar para validação
- ✅ Usar `api_publica_stj` (STJ é sempre disponível e rápido)
- ✅ Timeout de 10s
- ✅ Validar tanto HTTP 200 quanto estrutura da resposta

---

## 3. Integração com OpenCode CLI Tools

### ⚠️ CRÍTICO: FALTA CLAREZA NA INTEGRAÇÃO AGENT-TOOL

**Problema identificado:**

O plano menciona "DataJud Tool for OpenCode CLI" (TASK-012, TASK-013), mas:

1. **Não especifica** como o tool será registrado no OpenCode adapter
2. **Não detalha** o contrato do tool (input/output schema)
3. **Não explica** como o agent saberá quando usar o tool

**Análise do código existente:**

```typescript
// src/main/opencode/adapter.ts (linha 18):
import { generateOpenCodeConfig, ACCOMPLISH_AGENT_NAME } from './config-generator';

// TASK-012 menciona criar src/main/opencode/tools/datajud-tool.ts
// MAS: Não há diretório 'tools/' no opencode/ atual!
```

**Arquitetura atual de tools:**
- OpenCode CLI tem tools nativos: `browser`, `edit`, `bash`, etc.
- Custom tools não são registrados via arquivo separado
- Tools são configurados via `.opencode/config.yaml`

**⚠️ CONFUSÃO ARQUITETURAL:**

O plano sugere criar `src/main/opencode/tools/datajud-tool.ts`, mas OpenCode CLI **não suporta custom tools via código Electron**.

**Duas abordagens possíveis:**

#### Opção A: IPC Direct Call (Recomendada para MVP)

```typescript
// Agent recebe instrução no system prompt:
"When user asks about DataJud queries, use the following format:
<datajud_search court='api_publica_stj' query_type='number' value='0000000-00.0000.0.00.0000' />"

// Main process intercepta output do agent e executa IPC:
if (output.includes('<datajud_search')) {
  const result = await datajudService.search(params);
  // Injeta resultado de volta no stream do agent
}
```

#### Opção B: MCP Server (Abordagem Profissional)

Criar um MCP (Model Context Protocol) server para DataJud:

```typescript
// src/main/opencode/mcp/datajud-server.ts
export class DataJudMCPServer {
  tools = [{
    name: 'datajud_search',
    description: 'Search Brazilian judiciary processes via DataJud API',
    inputSchema: {
      type: 'object',
      properties: {
        court: { type: 'string' },
        query_type: { type: 'string', enum: ['number', 'class', 'party', 'date'] },
        value: { type: 'string' }
      }
    }
  }]

  async handleToolCall(name, args) {
    return await datajudService.search(args);
  }
}

// Em config-generator.ts, adicionar MCP server:
mcpServers: {
  datajud: {
    command: 'node',
    args: [path.join(__dirname, 'mcp/datajud-server.js')]
  }
}
```

**Recomendação:**
- ✅ **OPÇÃO A para MVP** (mais simples, funciona imediatamente)
- ✅ **OPÇÃO B para produção** (mais robusto, permite debugging)
- ❌ **NÃO** criar `tools/datajud-tool.ts` como descrito no TASK-012

**ADICIONAR AO PLANO:**
- Nova seção: "Tool Integration Architecture Decision"
- Atualizar TASK-012 com abordagem escolhida
- Atualizar TASK-014 (system prompt) com formato exato

---

## 4. Análise de Tasks e Dependências

### ✅ Task Breakdown: BEM ESTRUTURADO

**Dependency graph validado:**
```
TASK-001 (Types) → TASK-002 (Service) → TASK-004 (IPC) → TASK-006 (Preload)
                         ↓                    ↓                 ↓
                    TASK-012 (Tool)      TASK-003 (Storage)  TASK-007 (Settings UI)
```

**Ordem de implementação correta:**
1. Foundation (TASK-001 a TASK-006) - ✅ Correto
2. Settings UI (TASK-007 a TASK-008) - ✅ Correto
3. Prompts (TASK-009 a TASK-011) - ✅ Correto
4. Agent Tool (TASK-012 a TASK-014) - ⚠️ Precisa revisão (ver seção 3)
5. Results UI (TASK-015 a TASK-017) - ✅ Correto

### ⚠️ TASKS FALTANDO:

#### TASK-021: Database Migration (se necessário)
```sql
-- Se quiser armazenar histórico de consultas DataJud:
CREATE TABLE datajud_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  court TEXT NOT NULL,
  query_type TEXT NOT NULL,
  query_value TEXT NOT NULL,
  result_count INTEGER,
  created_at INTEGER NOT NULL
);
```

**Decisão necessária:** DataJud searches devem ser persistidos?
- ✅ **SIM** → Adicionar TASK-021 (migration) antes de TASK-018
- ❌ **NÃO** → Manter apenas em `taskHistory` existente

#### TASK-022: Rate Limiting & Caching

DataJud API não documenta rate limits, mas é prudente implementar:

```typescript
// src/main/services/datajud.ts
class DataJudService {
  private cache = new Map<string, CacheEntry>();
  private rateLimiter = new RateLimiter({ maxRequests: 60, perMinutes: 1 });

  async search(params: DataJudQuery): Promise<DataJudSearchResult> {
    const cacheKey = JSON.stringify(params);

    // Check cache (processo numbers não mudam frequentemente)
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5min cache
        return cached.data;
      }
    }

    await this.rateLimiter.acquire();
    const result = await this.fetchFromAPI(params);
    this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }
}
```

**Recomendação:**
- ✅ **ADICIONAR** TASK-022 após TASK-002
- ✅ Cache de 5 minutos para consultas por número de processo
- ✅ Cache de 1 minuto para consultas genéricas
- ✅ Rate limiter de 60 req/min (conservador)

---

## 5. Análise de Padrões IPC/Preload/Renderer

### ✅ TOTALMENTE COMPATÍVEL COM ARQUITETURA EXISTENTE

**Validação contra código existente:**

#### 5.1 Preload Bridge Pattern ✅

```typescript
// PLANO (TASK-006):
window.accomplish.datajud.search()
window.accomplish.datajud.setApiKey()

// EXISTENTE (src/preload/index.ts linha 54-90):
window.accomplish.getApiKeys()
window.accomplish.addApiKey()
window.accomplish.setDebugMode()

// ✅ PADRÃO CONSISTENTE
```

#### 5.2 IPC Handler Pattern ✅

```typescript
// PLANO (TASK-004):
datajud:search
datajud:set-api-key
datajud:get-api-key

// EXISTENTE (src/main/ipc/handlers.ts linha 1-50):
settings:api-keys
settings:add-api-key
settings:debug-mode

// ✅ PADRÃO CONSISTENTE
```

#### 5.3 Service Pattern ✅

```typescript
// PLANO (TASK-002):
src/main/services/datajud.ts

// EXISTENTE:
src/main/services/speechToText.ts
src/main/services/summarizer.ts

// ✅ PADRÃO CONSISTENTE
```

**Nenhum ajuste necessário nos padrões IPC.**

---

## 6. Tratamento de Erros e Edge Cases

### ⚠️ INCOMPLETO - PRECISA MELHORIAS

**TASK-002 menciona:**
> "Error handling, timeout, retry logic"

**MAS não especifica:**

#### 6.1 Timeouts

```typescript
// ADICIONAR ESPECIFICAÇÃO:
const DATAJUD_TIMEOUTS = {
  validation: 10_000,    // 10s para validar API key
  search: 30_000,        // 30s para searches normais
  largeSearch: 60_000,   // 60s para searches com size > 1000
};
```

#### 6.2 Retry Logic

```typescript
// ADICIONAR ESPECIFICAÇÃO:
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000,    // 1s
  backoffMultiplier: 2,  // 1s, 2s, 4s
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};
```

#### 6.3 Error Types

```typescript
// ADICIONAR A datajud.types.ts:
export class DataJudError extends Error {
  constructor(
    message: string,
    public code: 'NETWORK' | 'AUTH' | 'RATE_LIMIT' | 'INVALID_QUERY' | 'NO_RESULTS',
    public statusCode?: number
  ) {
    super(message);
    this.name = 'DataJudError';
  }
}

// Exemplo de uso:
if (response.status === 401) {
  throw new DataJudError('Invalid API key', 'AUTH', 401);
}
if (response.status === 429) {
  throw new DataJudError('Rate limit exceeded', 'RATE_LIMIT', 429);
}
```

#### 6.4 Edge Cases Faltando

| Cenário | Tratamento Atual | Recomendação |
|---------|------------------|--------------|
| API key inválida durante search | ❌ Não especificado | ✅ Mostrar dialog de settings |
| Network offline | ❌ Não especificado | ✅ Mostrar mensagem "offline" |
| Processo não encontrado | ❌ Não especificado | ✅ Retornar `{ hits: { total: 0 } }` |
| API retorna HTML (erro 500) | ❌ Não especificado | ✅ Parse error e retry |
| Large result sets (>10k) | ⚠️ Mencionado, mas não especificado | ✅ Paginated UI com warning |

**Recomendação:**
- ✅ **ADICIONAR** seção de Error Handling em `spec.md`
- ✅ **ATUALIZAR** TASK-002 com error types específicos
- ✅ **ADICIONAR** TASK-002.1: Error Handling Implementation

---

## 7. UX e Results Display

### ✅ BEM PLANEJADO, MAS FALTA DETALHAMENTO

**TASK-015 a TASK-017** mencionam componentes de resultado, mas:

#### 7.1 Estrutura de Dados no Renderer

```typescript
// ADICIONAR A packages/shared/src/types/datajud.ts:
export interface DataJudResultUI {
  process: {
    number: string;
    formattedNumber: string;  // Ex: "0000000-00.0000.0.00.0000"
    class: { code: string; name: string };
    court: string;
    instance: 'G1' | 'G2' | 'JE';
    filingDate: string;
    status: string;
  };
  parties: Array<{
    type: 'autor' | 'reu' | 'advogado';
    name: string;
    cpfCnpj?: string;
  }>;
  movements: Array<{
    date: string;
    type: string;
    description: string;
  }>;
  metadata: {
    confidentialityLevel: number;
    lastUpdate: string;
  };
}
```

#### 7.2 Loading States

```typescript
// ADICIONAR a TASK-017:
interface DataJudLoadingState {
  isSearching: boolean;
  isLoadingMore: boolean;  // Para paginação
  searchProgress?: {
    current: number;
    total: number;
    court: string;
  };
}
```

#### 7.3 Empty States

**FALTA especificar:**
- Nenhum resultado encontrado
- API key não configurada
- Erro de rede

**Recomendação:**
- ✅ **ADICIONAR** seção "UI States" em `plan.md`
- ✅ **ATUALIZAR** TASK-015 com loading/error/empty states

---

## 8. Testing Strategy

### ⚠️ PRECISA SER MAIS ESPECÍFICO

**TASK-018 a TASK-020** são muito genéricos.

#### 8.1 Unit Tests (TASK-018)

```typescript
// ESPECIFICAR TESTES:
describe('DataJudService', () => {
  describe('searchByNumber', () => {
    it('should format process number correctly');
    it('should make POST request to correct endpoint');
    it('should parse response into DataJudSearchResult');
    it('should throw DataJudError on 401');
    it('should throw DataJudError on 429');
    it('should retry on network error');
    it('should timeout after 30s');
  });

  describe('cache', () => {
    it('should cache results for 5 minutes');
    it('should invalidate cache after TTL');
  });
});
```

#### 8.2 Integration Tests (TASK-019)

```typescript
// ESPECIFICAR TESTES:
describe('DataJud IPC', () => {
  it('should store API key securely');
  it('should validate API key on save');
  it('should perform search via IPC');
  it('should handle network errors gracefully');
});
```

#### 8.3 E2E Tests (TASK-020)

```typescript
// ESPECIFICAR TESTES:
describe('DataJud E2E', () => {
  it('should complete full onboarding flow');
  it('should search by process number and display results');
  it('should paginate through large result sets');
  it('should handle API key validation errors');
  it('should export results to markdown');
});
```

**Mock Strategy:**

```typescript
// ADICIONAR:
// - Mock de DataJud API responses (fixtures em tests/fixtures/datajud/)
// - Mock de network errors
// - Mock de rate limiting
```

**Recomendação:**
- ✅ **ATUALIZAR** TASK-018/19/20 com testes específicos
- ✅ **ADICIONAR** test fixtures para responses do DataJud
- ✅ **ADICIONAR** mock do `fetch` para testes unitários

---

## 9. Riscos Não Cobertos

### ⚠️ ADICIONAR À RISK ASSESSMENT

| Risco | Probabilidade | Impacto | Mitigação Atual | Mitigação Recomendada |
|-------|--------------|---------|-----------------|----------------------|
| CNJ muda estrutura da API | Baixa | Alta | ❌ Nenhuma | ✅ Adicionar version check na resposta |
| Processo sigiloso retorna dados | Média | Alta | ❌ Nenhuma | ✅ Validar `nivelSigilo` antes de exibir |
| API key leak em logs | Média | Alta | ❌ Nenhuma | ✅ Redact API key em todos os logs |
| Large payload crash (>100MB) | Baixa | Média | ⚠️ Size limit | ✅ Streaming parser para large responses |
| Concurrent searches crash app | Baixa | Média | ❌ Nenhuma | ✅ Queue de searches (max 3 concurrent) |

**Novos Riscos Identificados:**

#### 9.1 Data Privacy (CRÍTICO)

DataJud retorna dados públicos, mas alguns processos têm `nivelSigilo > 0`:

```typescript
// ADICIONAR VALIDAÇÃO:
if (process.nivelSigilo > 0) {
  console.warn(`Process ${process.numeroProcesso} has confidentiality level ${process.nivelSigilo}`);
  // Não exibir dados sensíveis (partes, movimentações)
  return {
    ...process,
    partes: [],
    movimentacoes: [],
    warning: 'Processo com sigilo - dados não exibidos'
  };
}
```

#### 9.2 API Key Leak

```typescript
// ADICIONAR EM src/main/logging/redact.ts:
export function redactDataJudKey(text: string): string {
  return text.replace(/APIKey [a-zA-Z0-9-_]+/g, 'APIKey [REDACTED]');
}

// USAR EM TODOS OS LOGS:
logger.info(redactDataJudKey(`Request to DataJud with ${apiKey}`));
```

**Recomendação:**
- ✅ **ADICIONAR** TASK-023: Data Privacy Implementation
- ✅ **ADICIONAR** TASK-024: Log Redaction
- ✅ **ATUALIZAR** Risk Assessment em `plan.md`

---

## 10. Documentação e i18n

### ✅ i18n BEM PLANEJADO

**TASK-009** menciona atualizar locales, mas:

#### 10.1 Namespaces Faltando

```json
// ADICIONAR: apps/desktop/src/renderer/locales/pt-BR/datajud.json
{
  "settings": {
    "title": "DataJud",
    "apiKeyLabel": "Chave da API",
    "apiKeyPlaceholder": "Cole sua chave aqui",
    "validateButton": "Validar",
    "status": {
      "connected": "Conectado",
      "disconnected": "Não configurado",
      "validating": "Validando..."
    },
    "helpText": "Obtenha sua chave em:",
    "helpLink": "https://datajud.cnj.jus.br/api-publica"
  },
  "search": {
    "title": "Buscar no DataJud",
    "searchType": "Tipo de Busca",
    "court": "Tribunal",
    "courtPlaceholder": "Selecione o tribunal",
    "value": "Valor da Busca",
    "valuePlaceholder": "Ex: 0000000-00.0000.0.00.0000",
    "submit": "Buscar"
  },
  "results": {
    "title": "Resultados",
    "noResults": "Nenhum processo encontrado",
    "loadMore": "Carregar mais",
    "copyNumber": "Copiar número",
    "export": "Exportar",
    "movements": "Movimentações",
    "parties": "Partes"
  },
  "errors": {
    "invalidApiKey": "Chave da API inválida",
    "network": "Erro de rede. Verifique sua conexão.",
    "rateLimit": "Limite de requisições excedido. Tente novamente em alguns minutos.",
    "noApiKey": "Configure sua chave da API nas configurações"
  }
}
```

**Recomendação:**
- ✅ **ADICIONAR** TASK-009.1: Create DataJud i18n namespaces
- ✅ Criar arquivos `datajud.json` em `pt-BR/` e `en/`

---

## 11. Melhorias Sugeridas (Opcional/Future)

### 11.1 Performance Optimization

```typescript
// Web Workers para parse de large responses:
// src/renderer/workers/datajud-parser.worker.ts
self.onmessage = (e) => {
  const { hits } = e.data;
  const parsed = hits.map(parseDataJudProcess);
  self.postMessage(parsed);
};
```

### 11.2 Advanced Features (Pós-MVP)

- **Search Templates**: Salvar searches favoritos
- **Batch Export**: Exportar múltiplos processos para PDF
- **Graph View**: Visualizar relações entre processos/partes
- **Notifications**: Alertas de novos movimentos

---

## 12. Checklist de Implementação

Antes de começar a implementação, garantir:

- [ ] Decidir entre Opção A (IPC Direct) vs Opção B (MCP Server) para tool integration
- [ ] Especificar error handling completo (timeouts, retries, error types)
- [ ] Adicionar TASK-021 (Database Migration) se necessário
- [ ] Adicionar TASK-022 (Rate Limiting & Caching)
- [ ] Adicionar TASK-023 (Data Privacy)
- [ ] Adicionar TASK-024 (Log Redaction)
- [ ] Criar namespaces i18n (`datajud.json`)
- [ ] Especificar testes unitários/integration/E2E
- [ ] Validar endpoint de validação de API key (`api_publica_stj`)

---

## 13. Recomendações Finais

### ✅ APROVADO PARA IMPLEMENTAÇÃO

O plano está **sólido e bem estruturado**. Com as correções abaixo, está pronto para implementação:

### 🔴 CRÍTICO (Bloqueia implementação):

1. **Decidir arquitetura de tool integration** (Opção A vs B)
2. **Especificar error handling completo** (timeouts, retries, error types)
3. **Adicionar data privacy validation** (`nivelSigilo`)

### 🟡 IMPORTANTE (Pode implementar depois, mas deve estar no plano):

4. Adicionar TASK-022 (Rate Limiting & Caching)
5. Adicionar TASK-024 (Log Redaction)
6. Especificar testes unitários detalhados
7. Criar namespaces i18n

### 🟢 MELHORIAS OPCIONAIS:

8. Web Workers para parse de large responses
9. Database migration para histórico de searches
10. Advanced features (search templates, batch export)

---

## 14. Ordem de Implementação Recomendada

```
SPRINT 1 - Foundation (1 semana):
├── TASK-001: TypeScript Types
├── TASK-002: DataJud Service (com error handling)
├── TASK-022: Rate Limiting & Caching (NOVO)
├── TASK-003: API Key Storage
├── TASK-004: IPC Handlers
├── TASK-005: Register Handlers
└── TASK-006: Preload Bridge

SPRINT 2 - UI & Settings (1 semana):
├── TASK-009.1: i18n namespaces (NOVO)
├── TASK-007: Settings Component
├── TASK-008: Integrate Settings
├── TASK-009: Prompt Templates
└── TASK-011: Update Home Page

SPRINT 3 - Agent Integration (1 semana):
├── TASK-012: Tool Definition (revisar arquitetura)
├── TASK-013: Register Tool
├── TASK-014: System Prompt
├── TASK-023: Data Privacy (NOVO)
└── TASK-024: Log Redaction (NOVO)

SPRINT 4 - Results & UX (1 semana):
├── TASK-010: Query Form
├── TASK-015: Result Card
├── TASK-016: Movement Timeline
└── TASK-017: Integrate Results

SPRINT 5 - Testing (1 semana):
├── TASK-018: Unit Tests
├── TASK-019: Integration Tests
└── TASK-020: E2E Tests
```

---

## Conclusão

O plano de integração DataJud está **bem pensado e pronto para implementação** após as correções críticas. A arquitetura está alinhada com o codebase existente, e o task breakdown é lógico.

**Score Geral: 8.5/10**

- Arquitetura: ✅ 9/10
- Segurança: ✅ 8/10
- Task Breakdown: ✅ 9/10
- Testing: ⚠️ 7/10
- Error Handling: ⚠️ 6/10
- Documentação: ✅ 9/10

**Recomendação final:** ✅ **APROVADO** para implementação após aplicar as correções críticas listadas na seção 13.

---

**Próximo Passo:** Atualizar os arquivos do plano (`spec.md`, `plan.md`, `tasks.md`) com as recomendações deste review antes de começar a implementação.
