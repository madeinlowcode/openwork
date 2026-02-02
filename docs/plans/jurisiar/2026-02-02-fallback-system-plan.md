# Plano: Sistema de Fallback Inteligente + Proteção de API Keys

**Data:** 2026-02-02
**Status:** Fase 1 Implementada, Fase 2 Pendente
**Commit Checkpoint:** `fff454d` (antes) → `7779674` (depois da implementação)

---

## Índice

1. [Contexto e Problema](#1-contexto-e-problema)
2. [Solução: Fallback Inteligente](#2-solução-fallback-inteligente)
3. [Arquitetura Implementada (Fase 1)](#3-arquitetura-implementada-fase-1)
4. [Segurança: Proteção de API Keys](#4-segurança-proteção-de-api-keys)
5. [Decisão de Infraestrutura](#5-decisão-de-infraestrutura)
6. [Roadmap de Implementação](#6-roadmap-de-implementação)
7. [Configurações e Variáveis](#7-configurações-e-variáveis)
8. [Referências Técnicas](#8-referências-técnicas)

---

## 1. Contexto e Problema

### 1.1 Problema Identificado

Durante testes do Jurisiar, uma tarefa que envolvia múltiplas pesquisas no navegador falhou com o seguinte erro:

```
[LogWatcher] Detected error: AI_APICallError 您的并发请求超过了可用额度,请稍后再试。
```

**Tradução:** "O número de solicitações simultâneas excedeu o limite, por favor tente novamente mais tarde."

### 1.2 Causa Raiz

- **Rate Limit da API MiniMax:** O modelo `MiniMax-M2.1` atingiu o limite de requisições simultâneas
- **Perda de Trabalho:** Toda a tarefa foi perdida, incluindo pesquisas já realizadas
- **Experiência Ruim:** Usuário frustrado com falha após longo processamento

### 1.3 Requisitos de Negócio

- O Jurisiar será um **produto SaaS**
- Usuários **NÃO fornecerão suas próprias API keys** - usarão as APIs do Jurisiar
- Portanto, precisamos de:
  - Sistema resiliente a falhas de rate limit
  - Proteção das API keys proprietárias
  - Controle de custos e quotas

---

## 2. Solução: Fallback Inteligente

### 2.1 Conceito

Quando o modelo principal falha por rate limit, o sistema automaticamente:
1. Detecta o tipo de erro
2. Gera um contexto resumido do trabalho já realizado
3. Troca para um modelo alternativo
4. Continua a tarefa de onde parou

### 2.2 Fluxo do Fallback

```
Usuário inicia task
       ↓
OpenCodeAdapter executa com Modelo Principal (ex: MiniMax)
       ↓
❌ Rate Limit Error detectado
       ↓
🔍 FallbackEngine.handleError()
       ↓
┌─────────────────────────────────────────┐
│  Flag "useLLMSummarization" ativada?    │
├─────────────────────────────────────────┤
│   SIM              │        NÃO         │
│     ↓              │          ↓         │
│ LLM gera resumo    │  Template de tools │
│ (custo ~R$0,02)    │  (gratuito)        │
└─────────────────────────────────────────┘
       ↓
📝 Contexto de continuação gerado
       ↓
🔄 Troca para Modelo de Fallback (ex: DeepSeek)
       ↓
✅ Task continua com contexto preservado
```

### 2.3 Modos de Geração de Contexto

#### Modo Template (Gratuito)
Usa um dicionário que traduz tool calls para texto legível:

```
Entrada: { tool_name: "WebSearch", tool_input: { query: "candidatos empresários" } }
Saída: "Buscou na web: 'candidatos empresários'"
```

**Quando usar:** Modelos de fallback inteligentes (Claude, GPT-4) que conseguem interpretar o contexto.

#### Modo LLM Summarization (Pago)
Usa um modelo barato para gerar resumo inteligente do progresso:

```
"O agente realizou 3 pesquisas sobre candidatos empresários nas eleições
brasileiras de 2024. Foram coletados 15 resultados do TSE e dados de
patrimônio declarado. A próxima etapa é compilar o relatório final."
```

**Quando usar:**
- Muitas tool calls (>5)
- Modelo de fallback mais simples
- Usuário ativou a opção nas configurações

**Custo estimado:** ~R$0,02 por fallback (usando Gemini Flash Lite)

### 2.4 Configuração pelo Usuário

O usuário pode configurar via Settings:

```
┌─────────────────────────────────────────────────────────────┐
│ Fallback Automático                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ☑️ Ativar Fallback Automático                               │
│    Quando o modelo principal falhar por rate limit,         │
│    automaticamente tenta outro modelo.                      │
│                                                             │
│ Modelo de Fallback                                          │
│ [Claude 3 Haiku ▼]                                          │
│                                                             │
│ ▼ Configurações Avançadas                                   │
│ ├─ Tentativas antes do fallback: [3]                       │
│ └─ Delay entre tentativas (ms): [5000]                     │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ ☐ Usar IA para Sumarização de Contexto                     │
│   Modelo: [Definido pelo Admin - não editável]             │
│   ⚠️ Custo estimado: ~R$0,02 por fallback                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Nota:** O modelo de LLM Summarization é definido apenas pelo Admin (via variável de ambiente), não pelo usuário.

---

## 3. Arquitetura Implementada (Fase 1)

### 3.1 Estrutura de Arquivos

```
packages/shared/src/types/
├── fallbackSettings.ts          # Interfaces compartilhadas
└── index.ts                     # Re-export

apps/desktop/src/main/
├── store/migrations/
│   ├── v005-fallback-settings.ts # Schema do banco
│   └── index.ts                  # CURRENT_VERSION = 5
├── store/repositories/
│   └── fallbackSettings.ts       # CRUD no SQLite
├── opencode/fallback/
│   ├── index.ts                  # Re-exports
│   ├── types.ts                  # Tipos internos
│   ├── rate-limit-detector.ts    # Detecta rate limit
│   ├── tool-dictionary.ts        # Traduz tool calls
│   ├── context-generator.ts      # Gera contexto
│   └── fallback-engine.ts        # Orquestrador
└── ipc/handlers.ts               # Handlers IPC

apps/desktop/src/preload/
└── index.ts                      # API exposta ao renderer

apps/desktop/src/renderer/
├── components/settings/
│   └── FallbackSettings.tsx      # UI de configuração
├── components/layout/
│   └── SettingsDialog.tsx        # Aba Fallback adicionada
├── lib/
│   ├── jurisiar.ts               # Wrapper da API
│   └── i18n.ts                   # Namespace fallback
└── locales/
    ├── pt-BR/fallback.json       # Traduções português
    └── en/fallback.json          # Traduções inglês

apps/desktop/e2e/
└── specs/settings-fallback.spec.ts # Testes E2E (8/8 passando)
```

### 3.2 Schema do Banco de Dados

```sql
-- Tabela de configurações (singleton)
CREATE TABLE fallback_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER DEFAULT 0,
  fallback_model_id TEXT,
  fallback_provider TEXT DEFAULT 'openrouter',
  max_retries INTEGER DEFAULT 3,
  retry_delay_ms INTEGER DEFAULT 5000,
  use_llm_summarization INTEGER DEFAULT 0,
  summarization_model_id TEXT,
  summarization_provider TEXT DEFAULT 'openrouter',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de logs (auditoria)
CREATE TABLE fallback_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  session_id TEXT,
  original_model TEXT,
  original_provider TEXT,
  fallback_model TEXT,
  fallback_provider TEXT,
  error_type TEXT,
  error_message TEXT,
  context_method TEXT CHECK (context_method IN ('template', 'llm')),
  context_tokens INTEGER,
  success INTEGER DEFAULT 0,
  duration_ms INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### 3.3 Rate Limit Detector

Detecta padrões de rate limit de múltiplos provedores:

| Provedor | Padrões Detectados |
|----------|-------------------|
| Anthropic | `rate_limit`, `overloaded` |
| OpenAI | `rate_limit_exceeded`, `429` |
| Google | `RESOURCE_EXHAUSTED`, `quota` |
| MiniMax | `并发`, `请求过多` (chinês) |
| DeepSeek | `rate limit`, `too many requests` |
| Genérico | `429`, `503`, `too many requests` |

### 3.4 Tool Dictionary

Traduz tool calls para texto legível em português:

| Tool Name | Template |
|-----------|----------|
| `browser_navigate` | "Navegou para: {url}" |
| `browser_search` | "Pesquisou: '{query}'" |
| `browser_click` | "Clicou em: {selector}" |
| `browser_extract` | "Extraiu dados da página" |
| `WebSearch` | "Buscou na web: '{query}'" |
| `WebFetch` | "Acessou URL: {url}" |
| `Read` / `read_file` | "Leu arquivo: {path}" |
| `Write` / `write_file` | "Escreveu arquivo: {path}" |
| `Bash` | "Executou comando: {command}" |
| `mcp_playwright_*` | "Playwright: {action}" |
| `mcp_supabase_*` | "Supabase: {action}" |
| Default | "Executou: {toolName}" |

### 3.5 IPC Handlers

```typescript
// Main Process → Renderer
'fallback:get-settings'  // Retorna configurações
'fallback:set-settings'  // Atualiza configurações
'fallback:get-logs'      // Lista logs de fallback
'fallback:clear-logs'    // Limpa logs
'fallback:get-stats'     // Estatísticas (total, success, failed)
```

### 3.6 Testes E2E

8 testes criados e passando:

1. ✅ Aba Fallback aparece em Settings
2. ✅ Navegar para aba e exibir configurações
3. ✅ Toggle ativar/desativar fallback
4. ✅ Seletor de modelo aparece quando ativado
5. ✅ Selecionar modelo de fallback
6. ✅ Toggle LLM summarization
7. ✅ Fechar e reabrir dialog
8. ✅ Status message quando configurado

---

## 4. Segurança: Proteção de API Keys

### 4.1 O Problema

Como o Jurisiar é um app Electron (desktop), as API keys **NÃO podem ficar no código ou .env**:

```
❌ INSEGURO:
- Keys no .env → Usuário acessa pasta do app
- Keys hardcoded → Extrai do .asar
- Keys ofuscadas → Security by obscurity não funciona
```

### 4.2 A Solução: Backend como Proxy

As API keys devem ficar em um **servidor backend**, nunca no app desktop:

```
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│   Electron   │   →    │   Backend    │   →    │  OpenRouter  │
│   App        │        │   (Supabase) │        │   API        │
└──────────────┘        └──────────────┘        └──────────────┘
                              │
                         API Key fica
                         APENAS AQUI
```

### 4.3 Fluxo Seguro

1. Usuário faz login no app (Supabase Auth)
2. App recebe JWT token
3. App chama Edge Function com JWT
4. Edge Function valida JWT
5. Edge Function verifica quota do usuário
6. Edge Function chama OpenRouter com API key (server-side)
7. Resultado retorna para o app
8. Uso é registrado para billing

---

## 5. Decisão de Infraestrutura

### 5.1 Opções Avaliadas

| Opção | Componentes | Prós | Contras |
|-------|-------------|------|---------|
| **Supabase** | Auth + DB + Edge Functions | All-in-one, setup rápido | Menos flexível |
| **Neon + Vercel** | Neon DB + Vercel Edge + Better Auth | Muito flexível | 3 serviços |
| **Neon + Cloudflare** | Neon DB + CF Workers + Better Auth | Free tier generoso | 3 serviços |

### 5.2 Decisão: Abordagem em Fases

```
┌─────────────────────────────────────────────────────────────┐
│              ROADMAP DE INFRAESTRUTURA                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  FASE 1: MVP/VALIDAÇÃO (AGORA)                             │
│  ════════════════════════════════════════                  │
│  Plataforma: SUPABASE (all-in-one)                         │
│                                                             │
│  Justificativa:                                             │
│  - Setup em horas, não dias                                │
│  - Foco no produto, não na infra                           │
│  - Free tier suficiente para MVP                           │
│  - Auth + DB + Edge Functions integrados                   │
│                                                             │
│  ───────────────────────────────────────────────────────── │
│                                                             │
│  FASE 2: ESCALA (APÓS VALIDAÇÃO DO PRODUTO)                │
│  ════════════════════════════════════════                  │
│  Plataforma: NEON + CLOUDFLARE WORKERS + BETTER AUTH       │
│                                                             │
│  Justificativa:                                             │
│  - Cloudflare Workers: 100k requests/dia FREE              │
│  - Neon: Database branching para dev/staging               │
│  - Better Auth: Controle total sobre autenticação          │
│  - Migração PostgreSQL → PostgreSQL é simples              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Por que Cloudflare Workers (Fase 2)?

| Aspecto | Vercel Edge | Cloudflare Workers |
|---------|-------------|-------------------|
| **Free Tier** | 100k requests/mês | 100k requests/dia |
| **Execução** | 30s max | 30s (50ms CPU) |
| **Global Edge** | Sim | Sim |
| **Integração Neon** | Boa | Excelente (Hyperdrive) |

Cloudflare é **30x mais generoso** no free tier.

---

## 6. Roadmap de Implementação

### 6.1 Fase 1: Sistema de Fallback (✅ CONCLUÍDA)

| Task | Status | Descrição |
|------|--------|-----------|
| Migration v005 | ✅ | Schema do banco para fallback settings |
| Repository | ✅ | CRUD para configurações e logs |
| Rate Limit Detector | ✅ | Detecta erros de rate limit |
| Tool Dictionary | ✅ | Traduz tool calls para texto |
| Context Generator | ✅ | Gera contexto (template + placeholder LLM) |
| Fallback Engine | ✅ | Orquestrador com EventEmitter |
| IPC Handlers | ✅ | Comunicação main ↔ renderer |
| UI Settings | ✅ | Componente de configuração |
| i18n | ✅ | Traduções pt-BR/en |
| Testes E2E | ✅ | 8/8 passando |

**Commit:** `7779674`

### 6.2 Fase 2: Integração com Adapter (⏳ PENDENTE)

Conectar o FallbackEngine ao fluxo real de execução:

```typescript
// apps/desktop/src/main/opencode/adapter.ts
import { FallbackEngine, isRateLimitError } from './fallback';

// Quando detectar erro:
if (isRateLimitError(error)) {
  const result = await this.fallbackEngine.handleError(error, this.messages);

  if (result.shouldFallback) {
    // Reiniciar task com novo modelo e contexto
    await this.restartWithModel(result.fallbackModel, result.context);
  }
}
```

### 6.3 Fase 3: Backend Supabase (⏳ PENDENTE)

#### 3.1 Configurar Projeto Supabase
- [ ] Criar projeto no Supabase
- [ ] Configurar Auth (email/password, Google, GitHub)
- [ ] Criar tabelas: `user_quotas`, `usage_logs`

#### 3.2 Edge Function: LLM Proxy
```typescript
// supabase/functions/llm-proxy/index.ts
export async function handler(req: Request) {
  // 1. Validar JWT
  const user = await validateAuth(req);
  if (!user) return unauthorized();

  // 2. Verificar quota
  if (await isOverQuota(user.id)) return quotaExceeded();

  // 3. Chamar OpenRouter (API key segura no servidor)
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}` },
    body: req.body,
  });

  // 4. Registrar uso
  await logUsage(user.id, response.usage.total_tokens);

  return response;
}
```

#### 3.3 Edge Function: LLM Summarization
```typescript
// supabase/functions/llm-summarize/index.ts
const SUMMARIZATION_MODEL = Deno.env.get('SUMMARIZATION_MODEL')
  || 'google/gemini-flash-1.5-8b';

export async function handler(req: Request) {
  const user = await validateAuth(req);
  const { prompt, toolCalls } = await req.json();

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}` },
    body: JSON.stringify({
      model: SUMMARIZATION_MODEL,
      messages: [{
        role: 'user',
        content: `Resuma o progresso desta tarefa:\n\nTarefa: ${prompt}\n\nAções: ${toolCalls}`,
      }],
      max_tokens: 500,
    }),
  });

  return response;
}
```

#### 3.4 Integrar Auth no App Electron
- [ ] Instalar `@supabase/supabase-js`
- [ ] Criar tela de login/registro
- [ ] Armazenar token JWT com `keytar`
- [ ] Passar token nas chamadas às Edge Functions

### 6.4 Fase 4: Migração para Neon + Cloudflare (FUTURO)

Após validação do produto:
- [ ] Criar projeto Neon
- [ ] Configurar Cloudflare Workers
- [ ] Implementar Better Auth
- [ ] Migrar dados do Supabase
- [ ] Configurar Neon MCP para desenvolvimento

---

## 7. Configurações e Variáveis

### 7.1 Variáveis de Ambiente (Servidor)

```env
# Supabase (Fase 1)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenRouter
OPENROUTER_API_KEY=sk-or-v1-xxx

# LLM Summarization (modelo padrão - só admin altera)
SUMMARIZATION_MODEL=google/gemini-flash-1.5-8b

# Outros provedores (se necessário)
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx
```

### 7.2 Configurações do Usuário (App)

```typescript
interface FallbackSettings {
  enabled: boolean;                    // Ativar fallback automático
  fallbackModelId: string | null;      // Modelo alternativo
  fallbackProvider: string;            // 'openrouter' (padrão)
  maxRetries: number;                  // Tentativas antes do fallback (default: 3)
  retryDelayMs: number;                // Delay entre tentativas (default: 5000)
  useLLMSummarization: boolean;        // Usar IA para resumir contexto
  summarizationModelId: string | null; // NÃO editável pelo usuário
  summarizationProvider: string;       // NÃO editável pelo usuário
}
```

### 7.3 Quotas de Usuário

```sql
CREATE TABLE user_quotas (
  user_id UUID PRIMARY KEY REFERENCES auth.users,
  plan TEXT DEFAULT 'free',           -- 'free', 'pro', 'enterprise'
  tokens_used INTEGER DEFAULT 0,
  tokens_limit INTEGER DEFAULT 10000, -- free: 10k, pro: 100k, enterprise: unlimited
  fallbacks_used INTEGER DEFAULT 0,
  fallbacks_limit INTEGER DEFAULT 10, -- free: 10/mês
  reset_at TIMESTAMP,                 -- próximo reset mensal
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 8. Referências Técnicas

### 8.1 Arquivos Principais

| Arquivo | Descrição |
|---------|-----------|
| `src/main/opencode/fallback/fallback-engine.ts` | Motor principal do fallback |
| `src/main/opencode/fallback/rate-limit-detector.ts` | Detecção de rate limit |
| `src/main/opencode/fallback/context-generator.ts` | Geração de contexto |
| `src/main/store/repositories/fallbackSettings.ts` | CRUD de configurações |
| `src/renderer/components/settings/FallbackSettings.tsx` | UI de configuração |

### 8.2 Commits Relevantes

| Commit | Descrição |
|--------|-----------|
| `fff454d` | Checkpoint antes da implementação |
| `7779674` | Sistema de fallback completo |

### 8.3 Links Úteis

- [Supabase Docs](https://supabase.com/docs)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [OpenRouter API](https://openrouter.ai/docs)
- [Neon Docs](https://neon.tech/docs) (para Fase 2)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) (para Fase 2)
- [Better Auth](https://www.better-auth.com/) (para Fase 2)

### 8.4 Decisões Arquiteturais

| Decisão | Justificativa |
|---------|---------------|
| SQLite local para settings | App desktop, não precisa de sync em tempo real |
| OpenRouter como provider padrão | Acesso a múltiplos modelos com uma única API |
| Supabase para MVP | Setup rápido, all-in-one |
| Cloudflare Workers para escala | Free tier 30x maior que Vercel |
| Template mode como padrão | Zero custo, modelos bons entendem o contexto |

---

## Changelog

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-02-02 | Claude Opus 4.5 | Documento inicial com planejamento completo |

---

*Este documento deve ser atualizado conforme a implementação avança.*
