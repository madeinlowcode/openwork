# Supabase Backend - Jurisiar

Este diretorio contem o backend Supabase para o sistema de fallback inteligente do Jurisiar.

## Estrutura

```
supabase/
├── functions/
│   ├── _shared/           # Utilitarios compartilhados
│   │   ├── auth.ts        # Validacao de JWT
│   │   ├── cors.ts        # Headers CORS
│   │   └── quota.ts       # Gerenciamento de quotas
│   ├── llm-proxy/         # Proxy seguro para APIs LLM
│   │   └── index.ts
│   └── llm-summarize/     # Sumarizacao de contexto para fallback
│       └── index.ts
├── .env.example           # Variaveis de ambiente
├── config.toml            # Configuracao local
└── README.md              # Este arquivo
```

## Tabelas do Banco de Dados

### user_quotas
Gerencia limites de uso por usuario.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| user_id | UUID | Referencia ao auth.users |
| plan | TEXT | 'free', 'pro', 'enterprise' |
| tokens_used | INTEGER | Tokens consumidos no periodo |
| tokens_limit | INTEGER | Limite de tokens (free: 10k, pro: 100k) |
| fallbacks_used | INTEGER | Fallbacks usados no periodo |
| fallbacks_limit | INTEGER | Limite de fallbacks (free: 10) |
| reset_at | TIMESTAMP | Data de reset das quotas |

### usage_logs
Log detalhado de todas as requisicoes para billing e analytics.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID | Identificador unico |
| user_id | UUID | Referencia ao auth.users |
| request_type | TEXT | 'llm_proxy', 'llm_summarize', 'fallback' |
| model | TEXT | Modelo usado (ex: claude-opus-4-5) |
| provider | TEXT | Provider (ex: openrouter) |
| tokens_input | INTEGER | Tokens de entrada |
| tokens_output | INTEGER | Tokens de saida |
| tokens_total | INTEGER | Total de tokens |
| cost_usd | DECIMAL | Custo estimado em USD |
| success | BOOLEAN | Se a requisicao teve sucesso |
| error_message | TEXT | Mensagem de erro (se houver) |
| metadata | JSONB | Metadados adicionais |

## Edge Functions

### llm-proxy

Proxy seguro para chamadas LLM via OpenRouter.

**Endpoint:** `POST /functions/v1/llm-proxy`

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Body:**
```json
{
  "model": "anthropic/claude-3.5-sonnet",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "max_tokens": 1000
}
```

**Response:**
```json
{
  "id": "chatcmpl-...",
  "choices": [...],
  "usage": {...},
  "_quota": {
    "tokens_remaining": 8500,
    "tokens_used": 1500,
    "tokens_limit": 10000,
    "reset_at": "2026-03-01T00:00:00Z"
  }
}
```

### llm-summarize

Gera resumo de contexto para o sistema de fallback.

**Endpoint:** `POST /functions/v1/llm-summarize`

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Body:**
```json
{
  "taskDescription": "Pesquisar sobre candidatos empresarios",
  "toolCalls": [
    "Buscou na web: 'candidatos empresarios eleicoes 2024'",
    "Navegou para: https://tse.jus.br/..."
  ],
  "lastResponse": "Encontrei 15 resultados...",
  "maxTokens": 300
}
```

**Response:**
```json
{
  "summary": "O agente realizou pesquisas sobre candidatos empresarios nas eleicoes de 2024. Foram coletados dados do TSE e informacoes de patrimonio. Os proximos passos incluem compilar o relatorio final.",
  "tokens_used": 150,
  "model": "google/gemini-flash-1.5-8b",
  "_quota": {
    "tokens_remaining": 9850,
    "fallbacks_remaining": 9,
    "reset_at": "2026-03-01T00:00:00Z"
  }
}
```

## Desenvolvimento Local

### Pre-requisitos

1. [Supabase CLI](https://supabase.com/docs/guides/cli)
2. [Docker](https://docker.com)
3. [Deno](https://deno.land) (para Edge Functions)

### Setup

```bash
# Instalar Supabase CLI
npm install -g supabase

# Iniciar Supabase local
supabase start

# Criar arquivo de secrets locais
cp supabase/.env.example supabase/.env.local
# Edite .env.local com suas chaves

# Servir Edge Functions localmente
supabase functions serve --env-file supabase/.env.local
```

### Testar Edge Functions

```bash
# Obter token JWT (via Supabase Auth)
# Ou use o token anon para testes

# Testar llm-proxy
curl -X POST http://localhost:54321/functions/v1/llm-proxy \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model": "google/gemini-flash-1.5-8b", "messages": [{"role": "user", "content": "Ola!"}]}'

# Testar llm-summarize
curl -X POST http://localhost:54321/functions/v1/llm-summarize \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"taskDescription": "Teste", "toolCalls": ["Acao 1", "Acao 2"]}'
```

## Deploy

### Configurar Secrets

```bash
# Via CLI
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-your-key

# Ou via Dashboard:
# https://supabase.com/dashboard/project/YOUR_PROJECT/settings/functions
```

### Deploy das Functions

```bash
# Deploy individual
supabase functions deploy llm-proxy
supabase functions deploy llm-summarize

# Deploy todas
supabase functions deploy
```

## Seguranca

1. **JWT Validation:** Todas as Edge Functions validam o JWT antes de processar
2. **RLS Policies:** Users so podem ver seus proprios dados
3. **Service Role:** Usado apenas no servidor, nunca exposto ao cliente
4. **API Keys:** Armazenadas apenas no servidor (Supabase Secrets)

## Limites por Plano

| Plano | Tokens/mes | Fallbacks/mes |
|-------|------------|---------------|
| Free | 10,000 | 10 |
| Pro | 100,000 | 100 |
| Enterprise | Ilimitado | Ilimitado |

## Funcoes do Banco

### reset_expired_quotas()

Reseta quotas expiradas. Deve ser chamada periodicamente.

```sql
-- Via pg_cron (recomendado)
SELECT cron.schedule('reset-quotas', '0 0 * * *', 'SELECT reset_expired_quotas()');

-- Ou manualmente
SELECT reset_expired_quotas();
```

## Troubleshooting

### "OPENROUTER_API_KEY not configured"

Configure a secret via CLI ou Dashboard:
```bash
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-your-key
```

### "Quota exceeded"

O usuario atingiu o limite de tokens ou fallbacks. As quotas resetam mensalmente.

### "Invalid token"

O JWT expirou ou e invalido. O cliente deve renovar o token via Supabase Auth.
