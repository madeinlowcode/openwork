# Bug Tracking

## Ultima atualizacao: 2026-02-20

---

## Resumo

| Metrica | Valor |
|---------|-------|
| Total de bugs | 10 |
| Ativos | 3 |
| Corrigidos | 7 |

---

## Bugs Ativos

### BUG-001 - Tipos divergentes shared vs renderer
- **Severidade:** MEDIA
- **Status:** ABERTO
- **Tarefa relacionada:** TASK-009
- **Descricao:** `DataJudProcess.classe` eh objeto no shared e string no renderer. `DataJudMovement` usa campos diferentes. Componentes usam `any` para contornar.
- **Impacto:** Type safety comprometida nos componentes React

### BUG-002 - window.jurisiar.datajud nao tipado
- **Severidade:** BAIXA
- **Status:** ABERTO
- **Descricao:** `window.jurisiar.datajud` nao esta no tipo `JurisiarAPI`. Acessado via `(window as any)`.
- **Impacto:** Sem autocomplete nem verificacao de tipos nas chamadas IPC do renderer

### BUG-003 - Campo partes ausente na API publica
- **Severidade:** BAIXA
- **Status:** ABERTO
- **Descricao:** API publica DataJud nao retorna campo `partes`. UI mostra badge vazio para busca por parte.
- **Impacto:** Busca por parte pode retornar resultados sem dados de partes visiveis

---

## Bugs Corrigidos

| ID | Descricao | Data | Correcao |
|----|-----------|------|----------|
| BUG-004 | StreamParser perdia mensagens complete_task por corrupcao de JSON | 2026-02-19 | StreamParser v5: JSON.parse por linha + strip \r + flush com posicoes }. PTY cols 200->30000 |
| BUG-005 | Fallback quebrava sessao e contexto causando conclusao prematura | 2026-02-19 | RateLimitRetryManager: retry mesmo modelo/sessao antes de fallback. resetToolsUsed() preserva estado. Timeout 30s->120s |
| BUG-006 | `protocol.registerSchemesAsPrivileged` erro "scheme not registered" | 2026-02-20 | Chamar antes de app.ready. Mover para src/main/index.ts antes de createWindow(). |
| BUG-007 | `electron` plugin quebrava Worker deploy (CommonJS import) | 2026-02-20 | Remover electron plugin do Worker. Usar Hono no lugar. Fix: npm install hono em cloudflare-workers/auth-worker/. |
| BUG-008 | Workers CPU time exceeded com scrypt/bcrypt (>30ms timeout) | 2026-02-20 | Substituir por PBKDF2 via Web Crypto. Parametros: 100k iteracoes, SHA-256, salt 32 bytes. <5ms por hash. |
| BUG-009 | Better Auth espera camelCase (createdAt, not created_at) | 2026-02-20 | Migration v009: renomear colunas de snake_case para camelCase. Ou usar DatabaseAdapter custom. |
| BUG-010 | Electron fetch envia `Origin: null`, Better Auth rejeita CORS | 2026-02-20 | No IPC handler, fazer fetch com header customizado: `Origin: electron://`. Ou simplificar CORS no Worker. |
