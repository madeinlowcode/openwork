# Openwork Auth Worker

Cloudflare Worker que serve como servidor de autenticacao Better Auth para o Openwork.

## Pre-requisitos

- Conta Cloudflare com Workers Paid plan (~$5/mes) para Hyperdrive
- PostgreSQL acessivel externamente (ex: Supabase, Neon, Railway)
- Wrangler CLI instalado: `npm install -g wrangler`

## Setup

### 1. Criar Hyperdrive no Cloudflare Dashboard

1. Acesse: Workers & Pages > Hyperdrive > Create
2. Aponte para seu PostgreSQL existente (connection string)
3. Copie o ID gerado

### 2. Atualizar wrangler.toml

Substitua `SEU_HYPERDRIVE_ID` pelo ID copiado no passo anterior.

### 3. Configurar secret

```bash
wrangler secret put BETTER_AUTH_SECRET
# Gerar um secret seguro (minimo 32 chars):
# openssl rand -base64 32
```

### 4. Criar tabela de usage no PostgreSQL

Execute o seguinte SQL no seu banco:

```sql
CREATE TABLE IF NOT EXISTS openwork_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  task_id TEXT,
  model_id TEXT,
  provider TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,6),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_usage_user_id ON openwork_usage(user_id);
```

As tabelas do Better Auth (user, session, account) sao criadas automaticamente na primeira execucao.

### 5. Instalar dependencias e deploy

```bash
cd cloudflare-workers/auth-worker
npm install
npx wrangler deploy
```

A URL gerada sera algo como: `https://openwork-auth.SEU_SUBDOMINIO.workers.dev`

### 6. Verificar

```bash
curl https://openwork-auth.SEU_SUBDOMINIO.workers.dev/health
# Deve retornar: {"ok":true}
```

## Rotas

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET/POST | `/api/auth/**` | Rotas do Better Auth (login, signup, session, etc.) |
| GET | `/health` | Health check |
| POST | `/usage/record` | Registrar uso de tokens (requer sessao autenticada) |

## Desenvolvimento local

```bash
npm run dev
# Wrangler inicia servidor local em http://localhost:8787
```
