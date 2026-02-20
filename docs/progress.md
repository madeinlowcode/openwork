# Progress Tracking

## Ultima atualizacao: 2026-02-20

---

## Resumo

| Metrica | Valor |
|---------|-------|
| Total de tarefas conhecidas | 20 |
| Concluidas | 16 |
| Em progresso | 0 |
| Pendentes | 4 |
| Bloqueadas | 0 |
| Progresso geral | 80% |

---

## Tarefas Concluidas

| ID | Tarefa | Data | Notas |
|----|--------|------|-------|
| TASK-001 | Busca por numero NPU (end-to-end) | - | Validacao CNJ 20 digitos |
| TASK-002 | Lista de 91 tribunais + CourtSelect | - | 6 categorias, busca via IPC |
| TASK-003 | DataJudQueryForm (5 tipos de busca) | - | Dialog modal com animacao |
| TASK-004 | DataJudResults + movimentacoes | - | Dialog com lista expansivel |
| TASK-005 | Settings + API key validation | - | Keychain via keytar |
| TASK-006 | Rate limiting, retry, cache, privacy | - | 60 req/min, 3 retries, TTL |
| TASK-007 | 20 IPC handlers + historico SQLite | - | Todos registrados via preload |
| TASK-008 | Busca classe+orgao com search_after | 2026-02-13 | Exemplo 3 DataJud. 9 arquivos. Paginacao funcional |
| TASK-013 | StreamParser v5 (reescrita completa) | 2026-02-19 | JSON.parse por linha, flush com posicoes }, strip \r. 5 abordagens anteriores falharam |
| TASK-014 | PTY cols fix (200 -> 30000) | 2026-02-19 | PTY inseria \r\n a cada 200 cols corrompendo JSON |
| TASK-015 | RateLimitRetryManager | 2026-02-19 | 3 retries backoff exponencial (30s/60s/120s) + 10% jitter. Retry mesmo modelo antes de fallback |
| TASK-016 | Adapter retry-before-fallback + Context Generator melhorado | 2026-02-19 | 2 fases: retry mesmo modelo, depois fallback. CompletionEnforcer timeout 30s->120s. Contexto com tool outputs truncados |
| TASK-017 | SQLite encryption at rest + installation UUID key derivation | 2026-02-20 | PBKDF2 derive key de UUID, XChaCha20-Poly1305 encriptação. Migration v008 |
| TASK-018 | Zod validation em critical IPC handlers | 2026-02-20 | Schemas para searchByNumber, searchByClass, taskCreate. Type-safe request validation |
| TASK-019 | Better Auth Cloudflare Worker + Hyperdrive + PBKDF2 | 2026-02-20 | Auth backend com Web Crypto (CPU-friendly), Hyperdrive para SQLite, session management |
| TASK-020 | AuthGate, Login page, auth-client, preload bridge | 2026-02-20 | Proteção de routes, login form, IPC handlers, usage-reporter. Fix: Origin header Electron fetch |

## Tarefas Pendentes

| ID | Tarefa | Prioridade | Bloqueada por |
|----|--------|------------|---------------|
| TASK-009 | Unificar tipos shared vs renderer | ALTA | - |
| TASK-010 | Conectar useDataJud hook (remover simulacoes) | MEDIA | - |
| TASK-011 | Testar E2E buscas por classe, parte, periodo | MEDIA | - |
| TASK-012 | Implementar busca cross-court | BAIXA | - |

---

## Por Camada

| Camada | Concluidas | Pendentes |
|--------|-----------|-----------|
| Backend (Main/Service) | 13 | 1 |
| Frontend (Renderer) | 8 | 2 |
| Tipos (Shared) | 2 | 1 |
| Testes | 2 | 1 |
| Auth/Security (Workers + Electron) | 1 | 0 |
