# Architectural Decision Records (ADR)

## Ultima atualizacao: 2026-02-20

---

## ADR-001 - search_after exclusivo para classAndCourt

- **Status:** APROVADO
- **Data:** 2026-02-13
- **Contexto:** API DataJud nao suporta `sort`/`search_after` na maioria dos endpoints (fielddata bloqueado). Porem o Exemplo 3 oficial (classe+orgao) usa `sort: [{"@timestamp": {"order": "asc"}}]` com sucesso.
- **Decisao:** Implementar paginacao `search_after` APENAS para o tipo `classAndCourt`. Demais tipos continuam sem paginacao.
- **Alternativas:** (1) Tentar sort em todos os endpoints (falha), (2) Offset-based pagination (nao suportado pela API), (3) Nao paginar nenhum tipo
- **Impacto:** Frontend acumula resultados apenas em classAndCourt. Demais buscas retornam ate `size` resultados sem "carregar mais".

## ADR-002 - Cache bypass para buscas paginadas

- **Status:** APROVADO
- **Data:** 2026-02-13
- **Contexto:** Buscas com `searchAfter` representam paginas unicas e sequenciais. Cachear essas respostas consumiria memoria sem beneficio (usuario raramente revisita a mesma pagina).
- **Decisao:** Bypass do cache em memoria quando `query.searchAfter` esta presente.
- **Alternativas:** (1) Cachear todas as paginas (desperdicio de memoria), (2) Cache com TTL curto (complexidade desnecessaria)
- **Impacto:** Cada "Carregar mais" sempre faz request real a API. Rate limiting continua ativo.

## ADR-003 - _searchMeta tipado no formulario

- **Status:** APROVADO
- **Data:** 2026-02-13
- **Contexto:** O formulario precisa passar metadados extras (classCode, orgaoJulgadorCode) para a pagina Home poder fazer chamadas de paginacao subsequentes.
- **Decisao:** Criar interface `DataJudClassAndCourtSearchMeta` em vez de usar `any`.
- **Alternativas:** (1) Usar `any` (sem type safety), (2) Passar params via estado global (overengineering)
- **Impacto:** Type safety mantida no fluxo completo formulario -> Home -> IPC.

## ADR-004 - StreamParser v5: JSON.parse por linha sem state machine

- **Status:** APROVADO
- **Data:** 2026-02-19
- **Contexto:** O StreamParser passou por 5 abordagens que falharam (state machine com tracking de inString/escaped, regex-based, etc). O problema fundamental era que o PTY do Windows insere `\r` para line wrapping, corrompendo qualquer tracking de estado baseado em caracteres.
- **Decisao:** Reescrever o parser com abordagem simples: strip total de `\r`, split por `\n`, tentar `JSON.parse` em cada linha. No flush (processo fecha), extrair JSONs concatenados testando posicoes `}` da esquerda para a direita.
- **Alternativas:** (1) State machine com tracking inString/escaped (falha com \r do PTY), (2) Regex-based parsing (fragil), (3) Streaming JSON parser externo (overhead), (4) Buffer com delimitador customizado (complexo), (5) Chunk-based com heuristica de profundidade (instavel)
- **Impacto:** Parser impossivel de desincronizar. Historico das 5 abordagens documentado no codigo para referencia futura.

## ADR-005 - Retry-before-fallback com RateLimitRetryManager

- **Status:** APROVADO
- **Data:** 2026-02-19
- **Contexto:** O sistema de fallback ao trocar de modelo matava a sessao PTY e resetava o CompletionEnforcer, causando perda total de contexto. O agente fallback recebia apenas um resumo textual e completava a tarefa prematuramente. Analise completa em `docs/analise-execucao-continua.md`.
- **Decisao:** Implementar 2 fases: (1) Retry com mesmo modelo/sessao via `spawnSessionResumption()` com backoff exponencial (30s, 60s, 120s) + 10% jitter. (2) So se retries esgotados, fallback para modelo alternativo via FallbackEngine. Novo metodo `resetToolsUsed()` no CompletionEnforcer preserva estado de completion durante fallback. Timeout aumentado de 30s para 120s.
- **Alternativas:** (1) Apenas wait-and-retry sem fallback (perde resiliencia), (2) Apenas fallback melhorado (continua perdendo sessao), (3) Desabilitar fallback (paliativo), (4) Solucao C completa do documento de analise (escolhida)
- **Impacto:** Sessao preservada na maioria dos rate limits. Fallback so ocorre como ultimo recurso. Context Generator enriquecido com tool outputs truncados (300 chars), arquivos modificados e TODOs/FIXMEs extraidos.

## ADR-006 - Better Auth + Cloudflare Workers para autenticacao

- **Status:** APROVADO
- **Data:** 2026-02-20
- **Contexto:** Openwork necessita autenticacao centralizada para manter registro de sessoes, rastrear token usage e suportar modelo freemium. BYOK (bring-your-own-key) atual nao permite billing. Better Auth oferece integracoes prontas com OAuth, session management, e adapters para diferentes backends. Cloudflare Workers + Hyperdrive permitem deployar sem servidor dedicado.
- **Decisao:** Implementar auth backend via Better Auth em Cloudflare Worker. Usar Hyperdrive para conectar ao SQLite da aplicacao. Password hashing via PBKDF2 (CPU-friendly para Workers). Session tokens JWT armazenados em SQLite. Preload IPC handlers para login/logout e verificacao de sessao no renderer.
- **Alternativas:** (1) NextAuth + Vercel (requer servidor sempre ativo, custoso), (2) Auth0 (terceiro, fee mensal), (3) Supabase Auth (cliente-side, complexo para BYOK), (4) Implementacao propria (high maintenance)
- **Impacto:** Electron app redireciona para login antes de usar features. Sessions persistidas. Token usage rastreavel por usuario. Preparado para modelo freemium (pago).

## ADR-007 - PBKDF2 via Web Crypto para password hashing em Workers

- **Status:** APROVADO
- **Data:** 2026-02-20
- **Contexto:** Cloudflare Workers tem limite de CPU (30ms). Algoritmos bcrypt/scrypt excedem limite. Web Crypto API nativa oferece PBKDF2 com salt, dentro do limite.
- **Decisao:** Usar Web Crypto `deriveBits()` com PBKDF2, 100k iteracoes, SHA-256. Salt aleatorio 32 bytes. Hash armazenado em SQLite. Verificacao via comparacao timesafe (crypto-js ou Web Crypto).
- **Alternativas:** (1) bcrypt (timeout em Workers), (2) scrypt (timeout em Workers), (3) Argon2 (nao disponivel em Workers), (4) plain hash sem salt (inseguro)
- **Impacto:** Password hashing rapido e seguro. Nenhum timeout em Workers. Compativel com modelos de producao.

## ADR-008 - AuthGate pattern para protecao de rotas

- **Status:** APROVADO
- **Data:** 2026-02-20
- **Contexto:** Renderer React precisa proteger paginas que requerem autenticacao (Home, DataJud, Settings). Sem autenticacao, usuario ve Login page.
- **Decisao:** Criar componente `AuthGate` que verifica status de autenticacao via contexto React. Se nao autenticado, renderiza `<Login />`. Se autenticado, renderiza `<Outlet />` para child routes. Contexto sincroniza com IPC handlers do main process. Logout limpa session e volta a Login.
- **Alternativas:** (1) Protecao no main process (tira liberdade do renderer), (2) Verificacao em cada page (DRY violation), (3) useEffect em App.tsx (fragil a race conditions)
- **Impacto:** Todas as paginas protegidas com code minimal. Login flow consistente. SessionContext compartilhado entre componentes.

### Fluxo de Autenticacao Completo
1. **Primeiro acesso:** App.tsx carrega, AuthGate verifica sessao (IPC call)
2. **Sem sessao:** AuthGate renderiza `<Login />`
3. **Login form:** Usuario submete credenciais
4. **Main process:** IPC handler chama Cloudflare Worker (fetch com Origin fix)
5. **Worker:** PBKDF2 hash + JWT session token
6. **Store:** Session token persistido em SQLite
7. **Preload/Renderer:** SessionContext atualizado, AuthGate renderiza routes autenticadas
8. **DataJud calls:** Incluem token JWT para rate-limit tracking
9. **Logout:** IPC handler limpa session, AuthGate volta a Login
