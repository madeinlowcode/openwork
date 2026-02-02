# PRD - SDR Agent: Agente de Vendas Inteligente

## Documento de Requisitos do Produto

**Versao:** 1.0.0
**Data:** 2026-01-31
**Autor:** Script7
**Status:** Draft

---

## Sumario Executivo

O **SDR Agent** e um agente de vendas autonomo (Sales Development Representative) que utiliza inteligencia artificial para prospectar, qualificar e entrar em contato com leads de forma automatizada. O agente e configuravel para diferentes nichos de mercado e utiliza multiplos canais de comunicacao (WhatsApp, Email, Instagram).

### Proposta de Valor

> "Um vendedor incansavel que trabalha 24/7, adaptavel a qualquer nicho, com custo operacional drasticamente menor que um SDR humano."

---

## 1. Visao Geral do Produto

### 1.1 O que e o SDR Agent?

Uma aplicacao desktop (Electron) que hospeda um agente de IA capaz de:

1. **Prospectar** - Buscar empresas/leads em bases de dados via APIs
2. **Qualificar** - Analisar e classificar leads por potencial
3. **Enriquecer** - Coletar informacoes adicionais sobre o lead
4. **Abordar** - Entrar em contato via WhatsApp, Email ou Instagram
5. **Nutrir** - Acompanhar e responder interacoes
6. **Reportar** - Gerar metricas e relatorios de desempenho

### 1.2 Diferenciais

| Caracteristica | SDR Humano | SDR Agent |
|----------------|------------|-----------|
| Custo mensal | R$ 3.000 - 5.000 | R$ 200 - 500 (API) |
| Horario | 8h/dia | 24/7 |
| Volume de contatos | 50-100/dia | 500-1000/dia |
| Consistencia | Variavel | 100% padronizado |
| Adaptabilidade | Treinamento longo | Configuracao imediata |
| Multicanal | Limitado | WhatsApp + Email + Instagram |

### 1.3 Stack Tecnologico

```
┌─────────────────────────────────────────────────────────────┐
│                     ARQUITETURA                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              ELECTRON (Desktop App)                  │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │   React UI  │  │   Preload   │  │    Main     │  │   │
│  │  │  (Renderer) │  │   (Bridge)  │  │  (Node.js)  │  │   │
│  │  └─────────────┘  └─────────────┘  └──────┬──────┘  │   │
│  └───────────────────────────────────────────┼──────────┘   │
│                                              │              │
│  ┌───────────────────────────────────────────▼──────────┐   │
│  │              CLAUDE AGENT SDK                        │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │  Model Router (Haiku / Sonnet / Opus)           │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  └──────────────────────────┬───────────────────────────┘   │
│                             │                               │
│  ┌──────────────────────────▼───────────────────────────┐   │
│  │                    MCP SERVERS                       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │   │
│  │  │dev-browser│ │api-cnpj │ │whatsapp  │ │  email  │ │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └─────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Problema e Oportunidade

### 2.1 Problema

Pequenas e medias empresas (PMEs) enfrentam dificuldades para:

1. **Custo de equipe comercial** - Contratar SDRs e caro (salario + encargos + ferramentas)
2. **Escala limitada** - Um SDR humano tem limite de contatos diarios
3. **Inconsistencia** - Qualidade da abordagem varia conforme o dia/humor
4. **Multicanal** - Dificil gerenciar varios canais simultaneamente
5. **Nichos dinamicos** - Mudar de nicho requer retreinamento

### 2.2 Oportunidade

- Mercado de automacao de vendas em crescimento exponencial
- PMEs buscando reducao de custos operacionais
- IA generativa madura o suficiente para conversacao natural
- APIs de dados empresariais amplamente disponiveis
- Integracao com WhatsApp Business viavel

### 2.3 Mercado-Alvo

| Segmento | Exemplo de Uso |
|----------|----------------|
| Contabilidades | Vender servicos para empresas recem-abertas |
| Certificadoras | Vender certificado digital para novos CNPJs |
| Consultorias | Prospectar empresas por porte/setor |
| Agencias de Marketing | Abordar empresas sem presenca digital |
| Fornecedores B2B | Prospectar por segmento especifico |

---

## 3. Personas

### 3.1 Persona Primaria: Empreendedor Digital

**Nome:** Carlos, 35 anos
**Cargo:** Dono de agencia de certificacao digital
**Dor:** "Preciso de mais clientes, mas nao tenho budget para contratar vendedores"
**Objetivo:** Automatizar prospeccao para focar em fechamento
**Comportamento:** Usa tecnologia, busca eficiencia, orientado a resultados

### 3.2 Persona Secundaria: Gestor Comercial

**Nome:** Mariana, 42 anos
**Cargo:** Gerente Comercial em contabilidade
**Dor:** "Minha equipe perde muito tempo em prospeccao fria"
**Objetivo:** Aumentar produtividade da equipe comercial
**Comportamento:** Foco em metricas, busca ferramentas que integrem com CRM

---

## 4. Funcionalidades Principais

### 4.1 Configurador de Campanhas

**Descricao:** Interface para criar e configurar campanhas de prospeccao.

**Funcionalidades:**
- Definir nicho/segmento alvo
- Configurar filtros de busca (porte, localizacao, data abertura, etc.)
- Criar/editar pitch de abordagem
- Definir canais de contato (WhatsApp, Email, Instagram)
- Configurar horarios de envio
- Definir metas (contatos/dia, respostas esperadas)

**Tela:**
```
┌─────────────────────────────────────────────────────────────┐
│  Nova Campanha                                    [Salvar]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Nome: [Certificado Digital - Empresas Novas           ]   │
│                                                             │
│  ┌─ Segmentacao ──────────────────────────────────────────┐ │
│  │ Nicho: [ ] Todas  [x] Empresas abertas hoje           │ │
│  │ UF:    [SP] [RJ] [MG]                                  │ │
│  │ Porte: [x] MEI  [x] ME  [ ] EPP  [ ] Demais           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ Canais ───────────────────────────────────────────────┐ │
│  │ [x] WhatsApp  [ ] Email  [ ] Instagram                 │ │
│  │ Horario: 09:00 - 18:00                                 │ │
│  │ Max contatos/dia: [100]                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ Pitch ────────────────────────────────────────────────┐ │
│  │ Ola {nome}! Vi que voce abriu a {empresa} recente...  │ │
│  │ [Editar com IA]                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Buscador de Leads

**Descricao:** Motor de busca que consulta APIs para encontrar leads.

**Funcionalidades:**
- Integracao com API de CNPJ (dados cadastrais)
- Integracao com API de enriquecimento (telefone, email, redes sociais)
- Filtros avancados (CNAE, data abertura, capital social, etc.)
- Deduplicacao automatica
- Exportacao de listas

**APIs Integradas:**
| API | Dados | Uso |
|-----|-------|-----|
| ReceitaWS / CNPJa | CNPJ, razao social, CNAE, data abertura | Prospeccao |
| API Propria (usuario) | Telefone, email, redes sociais | Enriquecimento |
| Google Search API | Informacoes publicas, site, avaliacoes | Contexto |

### 4.3 Central de Mensagens

**Descricao:** Painel para visualizar e gerenciar conversas com leads.

**Funcionalidades:**
- Inbox unificado (WhatsApp + Email + Instagram)
- Historico de conversas
- Respostas sugeridas por IA
- Classificacao de leads (quente, morno, frio)
- Handoff para humano quando necessario
- Agendamento de follow-ups

**Tela:**
```
┌─────────────────────────────────────────────────────────────┐
│  Central de Mensagens                      [Filtros] [+]   │
├─────────────────────────────────────────────────────────────┤
│ ┌─ Conversas ─────┐ ┌─ Chat ────────────────────────────┐  │
│ │                 │ │                                    │  │
│ │ [W] Joao Silva  │ │ Joao Silva - Tech Solutions LTDA  │  │
│ │     "Quanto..." │ │ ─────────────────────────────────  │  │
│ │                 │ │                                    │  │
│ │ [E] Maria Costa │ │ [SDR] Ola Joao! Vi que voce...    │  │
│ │     "Obrigado"  │ │                                    │  │
│ │                 │ │ [Joao] Quanto custa?               │  │
│ │ [I] Pedro Souza │ │                                    │  │
│ │     Aguardando  │ │ [IA Sugerindo resposta...]         │  │
│ │                 │ │ ┌──────────────────────────────┐   │  │
│ │                 │ │ │ Joao, nosso certificado A1   │   │  │
│ │                 │ │ │ custa R$ 150. Posso emitir   │   │  │
│ │                 │ │ │ agora mesmo para voce!       │   │  │
│ │                 │ │ └──────────────────────────────┘   │  │
│ │                 │ │           [Enviar] [Editar]        │  │
│ └─────────────────┘ └────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 4.4 Automacao de Contato

**Descricao:** Motor de envio de mensagens multi-canal.

**Funcionalidades:**
- Envio via WhatsApp (API oficial ou MegaAPI)
- Envio via Email (SMTP)
- Envio via Instagram DM (via browser automation)
- Personalizacao dinamica com dados do lead
- Controle de rate limiting
- Retry automatico em caso de falha
- Agendamento de mensagens

**Fluxo de Envio:**
```
Lead selecionado
      │
      ▼
┌─────────────────┐
│ Enriquecer dados│ ← API de enriquecimento
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Gerar mensagem  │ ← Claude (Haiku/Sonnet)
│ personalizada   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐
│ Canal disponivel│ ──▶ │  WhatsApp    │
│ ?               │     └──────────────┘
└────────┬────────┘     ┌──────────────┐
         │          ──▶ │    Email     │
         │              └──────────────┘
         │              ┌──────────────┐
         └──────────▶   │  Instagram   │
                        └──────────────┘
```

### 4.5 Dashboard de Performance

**Descricao:** Metricas e KPIs das campanhas.

**Metricas:**
- Total de leads prospectados
- Taxa de contato (mensagens enviadas / leads)
- Taxa de resposta (respostas / mensagens)
- Taxa de conversao (vendas / respostas)
- Custo por lead / Custo por conversao
- Performance por canal
- Performance por campanha/nicho

**Tela:**
```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard                              Periodo: [Hoje ▼]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │   127    │ │    89    │ │    23    │ │     5    │       │
│  │  Leads   │ │ Enviados │ │Respostas │ │ Vendas   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                             │
│  ┌─ Funil ────────────────────────────────────────────────┐ │
│  │ Leads      ████████████████████████████████████ 127    │ │
│  │ Enviados   █████████████████████████████        89     │ │
│  │ Respostas  ██████                               23     │ │
│  │ Vendas     ██                                   5      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ Por Canal ────────┐ ┌─ Custo API ─────────────────────┐ │
│  │ WhatsApp: 70%      │ │ Haiku:  $0.45 (89 mensagens)    │ │
│  │ Email:    20%      │ │ Sonnet: $0.12 (5 negociacoes)   │ │
│  │ Instagram: 10%     │ │ Total:  $0.57                   │ │
│  └────────────────────┘ └─────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.6 Personalidade do Agente

**Descricao:** Configuracao da persona e tom de voz do SDR.

**Funcionalidades:**
- Nome do agente
- Tom de voz (formal, casual, tecnico)
- Avatar/foto
- Assinatura de mensagens
- Regras de comportamento
- Limites (o que NAO fazer)
- Base de conhecimento (FAQ, objecoes, precos)

**Configuracao:**
```
┌─────────────────────────────────────────────────────────────┐
│  Personalidade do Agente                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Nome: [Ana]                                                │
│  Cargo: [Consultora de Certificacao Digital]                │
│                                                             │
│  Tom de voz:                                                │
│  ( ) Muito formal   (•) Profissional   ( ) Casual           │
│                                                             │
│  ┌─ Instrucoes Especiais ─────────────────────────────────┐ │
│  │ - Sempre cumprimentar pelo nome                        │ │
│  │ - Mencionar que a empresa foi aberta recentemente      │ │
│  │ - Destacar a promocao de primeira compra               │ │
│  │ - Se perguntarem preco, informar R$ 150 (A1)          │ │
│  │ - NAO prometer prazos menores que 24h                  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ FAQ / Objecoes ───────────────────────────────────────┐ │
│  │ + Adicionar pergunta frequente                         │ │
│  │ ┌──────────────────────────────────────────────────┐   │ │
│  │ │ P: "Esta muito caro"                             │   │ │
│  │ │ R: "Entendo! Mas considere que o certificado... │   │ │
│  │ └──────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Skills (MCP Servers)

### 5.1 Skills Reutilizados do Jurisiar

| Skill | Funcao | Modificacoes |
|-------|--------|--------------|
| `dev-browser` | Automacao de navegador | Nenhuma |
| `dev-browser-mcp` | MCP wrapper do browser | Nenhuma |
| `ask-user-question` | Interacao com usuario | Nenhuma |
| `complete-task` | Sinalizar conclusao | Nenhuma |
| `file-permission` | Permissoes de arquivo | Nenhuma |

### 5.2 Skills Novos (a desenvolver)

#### 5.2.1 `api-cnpj`

**Descricao:** Consulta dados cadastrais de empresas.

**Ferramentas:**
```typescript
// Buscar empresa por CNPJ
buscar_cnpj(cnpj: string): EmpresaData

// Listar empresas por filtros
listar_empresas(filtros: {
  data_abertura_inicio?: string,
  data_abertura_fim?: string,
  uf?: string[],
  cnae?: string[],
  porte?: string[],
  limit?: number
}): EmpresaData[]

// Tipos
interface EmpresaData {
  cnpj: string
  razao_social: string
  nome_fantasia: string
  data_abertura: string
  cnae_principal: string
  cnae_descricao: string
  endereco: Endereco
  porte: string
  capital_social: number
  situacao: string
  socios: Socio[]
}
```

#### 5.2.2 `api-enrichment`

**Descricao:** Enriquece dados do lead com informacoes de contato.

**Ferramentas:**
```typescript
// Enriquecer dados de uma empresa
enriquecer_empresa(cnpj: string): EnrichedData

// Tipos
interface EnrichedData {
  telefones: string[]
  emails: string[]
  whatsapp: string | null
  instagram: string | null
  linkedin: string | null
  website: string | null
  google_rating: number | null
  google_reviews: number | null
}
```

#### 5.2.3 `whatsapp-sender`

**Descricao:** Envia mensagens via WhatsApp.

**Ferramentas:**
```typescript
// Enviar mensagem
enviar_whatsapp(params: {
  numero: string,
  mensagem: string,
  midia?: { tipo: 'imagem' | 'documento', url: string }
}): ResultadoEnvio

// Verificar status de entrega
verificar_status(message_id: string): StatusMensagem

// Listar conversas
listar_conversas(filtros?: { nao_lidas?: boolean }): Conversa[]

// Responder mensagem
responder_whatsapp(params: {
  conversa_id: string,
  mensagem: string
}): ResultadoEnvio
```

#### 5.2.4 `email-sender`

**Descricao:** Envia emails via SMTP.

**Ferramentas:**
```typescript
// Enviar email
enviar_email(params: {
  para: string,
  assunto: string,
  corpo_html: string,
  corpo_texto?: string,
  anexos?: Anexo[]
}): ResultadoEnvio

// Verificar inbox (respostas)
verificar_inbox(filtros?: {
  nao_lidos?: boolean,
  de?: string
}): Email[]
```

#### 5.2.5 `instagram-dm`

**Descricao:** Envia DMs no Instagram (via browser automation).

**Ferramentas:**
```typescript
// Enviar DM
enviar_dm_instagram(params: {
  perfil: string,
  mensagem: string
}): ResultadoEnvio

// Verificar DMs
verificar_dms(): DM[]
```

#### 5.2.6 `lead-manager`

**Descricao:** Gerencia o banco de leads local.

**Ferramentas:**
```typescript
// Adicionar lead
adicionar_lead(lead: Lead): Lead

// Atualizar status
atualizar_lead(id: string, dados: Partial<Lead>): Lead

// Buscar leads
buscar_leads(filtros: FiltrosLead): Lead[]

// Tipos
interface Lead {
  id: string
  cnpj: string
  empresa: string
  contato_nome: string
  telefone: string
  email: string
  instagram: string
  status: 'novo' | 'contatado' | 'respondeu' | 'negociando' | 'vendido' | 'perdido'
  canal_preferido: 'whatsapp' | 'email' | 'instagram'
  ultima_interacao: string
  historico: Interacao[]
  campanha_id: string
  tags: string[]
}
```

---

## 6. Roteamento de Modelos

### 6.1 Estrategia de Custos

O sistema usa diferentes modelos Claude conforme a complexidade da tarefa:

```
┌─────────────────────────────────────────────────────────────┐
│                  MODEL ROUTER                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tarefa                          Modelo      Custo/1M      │
│  ───────────────────────────────────────────────────────    │
│  Classificar lead                Haiku       $0.80/$4.00   │
│  Extrair dados de API            Haiku       $0.80/$4.00   │
│  Formatar mensagem simples       Haiku       $0.80/$4.00   │
│  Personalizar pitch              Sonnet      $3.00/$15.00  │
│  Responder objecao               Sonnet      $3.00/$15.00  │
│  Analisar conversa               Sonnet      $3.00/$15.00  │
│  Negociacao complexa             Opus        $15.00/$75.00 │
│  Estrategia de campanha          Opus        $15.00/$75.00 │
│                                                             │
│  Distribuicao esperada: 80% Haiku | 18% Sonnet | 2% Opus   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Implementacao

```typescript
// model-router.ts
type TaskComplexity = 'simple' | 'moderate' | 'complex';

interface TaskClassification {
  type: string;
  complexity: TaskComplexity;
}

const MODEL_MAP: Record<TaskComplexity, string> = {
  simple: 'claude-3-5-haiku-20241022',
  moderate: 'claude-sonnet-4-20250514',
  complex: 'claude-opus-4-20250514',
};

function classifyTask(task: string): TaskClassification {
  // Tarefas simples (Haiku)
  const simpleTasks = [
    'classificar_lead',
    'extrair_dados',
    'formatar_mensagem',
    'validar_telefone',
    'verificar_status',
  ];

  // Tarefas moderadas (Sonnet)
  const moderateTasks = [
    'personalizar_pitch',
    'responder_objecao',
    'analisar_conversa',
    'gerar_followup',
    'qualificar_lead',
  ];

  // Tarefas complexas (Opus)
  const complexTasks = [
    'negociacao_complexa',
    'estrategia_campanha',
    'resolver_conflito',
    'analise_competitiva',
  ];

  // Logica de classificacao...
}

function selectModel(task: string): string {
  const classification = classifyTask(task);
  return MODEL_MAP[classification.complexity];
}
```

---

## 7. Integracao de APIs

### 7.1 API de CNPJ (Dados Cadastrais)

**Opcoes:**
| Provedor | Preco | Dados |
|----------|-------|-------|
| ReceitaWS | Gratuito (3/min) | Basico |
| CNPJa | R$ 0.01/consulta | Completo |
| Speedio | Sob consulta | Empresarial |
| BrasilAPI | Gratuito | Basico |

**Recomendacao:** Iniciar com BrasilAPI (gratuito) e migrar para CNPJa conforme escala.

### 7.2 API de Enriquecimento (Propria do Usuario)

O usuario fornecera endpoint e credenciais da sua API de enriquecimento.

**Configuracao:**
```json
{
  "enrichment_api": {
    "base_url": "https://api.usuario.com",
    "api_key": "xxx",
    "endpoints": {
      "enrich": "/v1/enrich/{cnpj}",
      "search": "/v1/search"
    }
  }
}
```

### 7.3 WhatsApp

**Opcoes:**
| Provedor | Tipo | Preco |
|----------|------|-------|
| WhatsApp Business API | Oficial | ~R$ 0.50/msg |
| MegaAPI | Nao-oficial | R$ 97/mes |
| Z-API | Nao-oficial | R$ 79/mes |
| Evolution API | Self-hosted | Gratuito |

**Recomendacao:** MegaAPI para MVP (estabilidade + suporte).

### 7.4 Email

**Configuracao SMTP padrao:**
```json
{
  "email": {
    "smtp_host": "smtp.gmail.com",
    "smtp_port": 587,
    "smtp_user": "usuario@gmail.com",
    "smtp_pass": "app_password",
    "from_name": "Ana - Certificadora XYZ",
    "from_email": "contato@certificadora.com"
  }
}
```

### 7.5 Instagram

Via `dev-browser` (automacao de navegador) - sem API oficial para DMs.

---

## 8. Fluxo de Usuario

### 8.1 Primeiro Uso (Onboarding)

```
1. Instalar aplicativo
      │
      ▼
2. Configurar API Anthropic (API Key)
      │
      ▼
3. Configurar integracao WhatsApp
   (conectar MegaAPI ou similar)
      │
      ▼
4. Configurar API de dados (CNPJ + Enriquecimento)
      │
      ▼
5. Criar primeira campanha
   - Definir nicho
   - Configurar filtros
   - Escrever pitch
      │
      ▼
6. Iniciar prospeccao
```

### 8.2 Uso Diario

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO DIARIO                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  MANHA                                                      │
│  ├─ Agente busca novos leads (empresas abertas hoje)       │
│  ├─ Enriquece dados automaticamente                         │
│  └─ Envia primeiras mensagens (WhatsApp prioritario)        │
│                                                             │
│  DURANTE O DIA                                              │
│  ├─ Agente monitora respostas                               │
│  ├─ Responde automaticamente (com supervisao)               │
│  └─ Escala leads quentes para usuario                       │
│                                                             │
│  FIM DO DIA                                                 │
│  ├─ Agente envia follow-ups pendentes                       │
│  ├─ Atualiza status dos leads                               │
│  └─ Gera relatorio do dia                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Requisitos Nao-Funcionais

### 9.1 Performance

| Metrica | Requisito |
|---------|-----------|
| Tempo de resposta UI | < 200ms |
| Tempo de envio WhatsApp | < 5s |
| Tempo de busca leads | < 3s (100 leads) |
| Processamento IA (Haiku) | < 2s |
| Processamento IA (Sonnet) | < 5s |

### 9.2 Seguranca

- API Keys armazenadas em keychain do sistema
- Dados de leads criptografados em repouso
- Comunicacao HTTPS obrigatoria
- Logs sem dados sensiveis

### 9.3 Escalabilidade

- Suporte a multiplas campanhas simultaneas
- Ate 1000 leads por campanha
- Ate 500 mensagens/dia

### 9.4 Disponibilidade

- App desktop (funciona offline para visualizacao)
- Depende de conexao para envio e IA

---

## 10. Roadmap

### Fase 1: MVP (4-6 semanas)

**Objetivo:** Validar conceito com fluxo basico.

| Semana | Entrega |
|--------|---------|
| 1-2 | Setup projeto + Claude Agent SDK adapter |
| 3 | Skill api-cnpj + Skill lead-manager |
| 4 | Skill whatsapp-sender (MegaAPI) |
| 5 | UI: Campanhas + Central de mensagens |
| 6 | Testes + Ajustes + Documentacao |

**Entregaveis MVP:**
- [x] Buscar empresas por data de abertura
- [x] Enviar mensagem WhatsApp personalizada
- [x] Receber e responder mensagens
- [x] Dashboard basico

### Fase 2: Expansao (4 semanas)

| Semana | Entrega |
|--------|---------|
| 7 | Skill api-enrichment |
| 8 | Skill email-sender |
| 9 | UI: Personalidade do agente |
| 10 | Dashboard avancado + Metricas |

**Entregaveis:**
- [ ] Enriquecimento de leads
- [ ] Canal email
- [ ] Configuracao de persona
- [ ] Metricas detalhadas

### Fase 3: Otimizacao (4 semanas)

| Semana | Entrega |
|--------|---------|
| 11 | Skill instagram-dm |
| 12 | Model router inteligente |
| 13 | Integracao CRM (Pipedrive/HubSpot) |
| 14 | Polish + Performance |

**Entregaveis:**
- [ ] Canal Instagram
- [ ] Otimizacao de custos IA
- [ ] Integracoes externas
- [ ] App estavel para producao

---

## 11. Metricas de Sucesso

### 11.1 Metricas de Produto

| Metrica | Meta MVP | Meta 6 meses |
|---------|----------|--------------|
| Leads prospectados/dia | 100 | 500 |
| Taxa de resposta | 5% | 15% |
| Taxa de conversao | 1% | 5% |
| Custo por lead | R$ 0.50 | R$ 0.20 |
| NPS usuarios | 30 | 50 |

### 11.2 Metricas Tecnicas

| Metrica | Meta |
|---------|------|
| Uptime | 99% |
| Erros de envio | < 2% |
| Tempo medio resposta IA | < 3s |
| Custo API/usuario/mes | < R$ 100 |

---

## 12. Riscos e Mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|---------------|---------|-----------|
| Bloqueio WhatsApp | Media | Alto | Usar API oficial, rate limiting |
| Custos API altos | Media | Medio | Model routing, cache respostas |
| Qualidade respostas IA | Baixa | Alto | Supervisao humana, fine-tuning prompts |
| Mudanca termos Anthropic | Baixa | Alto | Monitorar, ter plano B (OpenAI) |
| Concorrencia | Alta | Medio | Foco em nicho, UX superior |

---

## 13. Glossario

| Termo | Definicao |
|-------|-----------|
| **SDR** | Sales Development Representative - profissional de pre-vendas |
| **Lead** | Potencial cliente identificado |
| **Prospeccao** | Processo de identificar e contatar leads |
| **Enriquecimento** | Adicionar dados a um lead (telefone, email, etc.) |
| **Pitch** | Mensagem inicial de abordagem comercial |
| **Follow-up** | Mensagem de acompanhamento |
| **MCP** | Model Context Protocol - protocolo de skills Claude |
| **Haiku/Sonnet/Opus** | Modelos Claude de diferentes capacidades |

---

## 14. Anexos

### Anexo A: Comparativo de Custos

```
Cenario: 100 leads/dia, 30 dias

SDR Humano:
- Salario: R$ 3.000
- Encargos: R$ 1.500
- Ferramentas: R$ 500
- Total: R$ 5.000/mes

SDR Agent:
- API Claude (80% Haiku): ~R$ 50
- API Claude (18% Sonnet): ~R$ 30
- API Claude (2% Opus): ~R$ 20
- WhatsApp (MegaAPI): R$ 97
- APIs dados: ~R$ 50
- Total: ~R$ 250/mes

Economia: 95% (R$ 4.750/mes)
```

### Anexo B: Estrutura de Pastas do Projeto

```
sdr-agent/
├── apps/
│   └── desktop/
│       ├── src/
│       │   ├── main/
│       │   │   ├── agent/           # Claude Agent SDK
│       │   │   ├── ipc/             # IPC handlers
│       │   │   └── store/           # SQLite storage
│       │   ├── preload/
│       │   └── renderer/
│       │       ├── components/
│       │       │   ├── campaigns/   # Componentes de campanha
│       │       │   ├── leads/       # Componentes de leads
│       │       │   ├── messages/    # Central de mensagens
│       │       │   └── settings/    # Configuracoes
│       │       └── pages/
│       └── skills/
│           ├── dev-browser/         # Reutilizado
│           ├── api-cnpj/            # Novo
│           ├── api-enrichment/      # Novo
│           ├── whatsapp-sender/     # Novo
│           ├── email-sender/        # Novo
│           ├── instagram-dm/        # Novo
│           └── lead-manager/        # Novo
├── packages/
│   └── shared/
└── docs/
    └── PRD.md
```

---

## Aprovacoes

| Papel | Nome | Data | Status |
|-------|------|------|--------|
| Product Owner | | | Pendente |
| Tech Lead | | | Pendente |
| Stakeholder | | | Pendente |

---

*Documento gerado em 2026-01-31*
*Versao: 1.0.0*
