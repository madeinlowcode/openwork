# Sistema de Internacionalizacao (i18n) - Jurisiar

## Visao Geral

O Jurisiar usa `react-i18next` para internacionalizacao no renderer e um sistema leve customizado no main process.

## Estrutura de Arquivos

```
locales/
├── pt-BR/              # Portugues (Brasil) - idioma padrao
│   ├── common.json     # Strings compartilhadas (navegacao, botoes, acoes)
│   ├── status.json     # Status de tarefas (queued, running, completed...)
│   ├── tools.json      # Labels de ferramentas (Read, Write, Bash...)
│   ├── home.json       # Pagina inicial e use cases
│   ├── execution.json  # Pagina de execucao e permissoes
│   ├── settings.json   # Configuracoes e tabs
│   ├── providers.json  # Provedores de IA
│   └── speech.json     # Entrada de voz
└── en/                 # English (fallback)
    └── ... (mesma estrutura)
```

## Como Usar

### No Componente React

```typescript
import { useTranslation } from 'react-i18next';

function MeuComponente() {
  const { t } = useTranslation(); // namespace 'common' por padrao
  
  return <h1>{t('navigation.home')}</h1>;
}
```

### Com Namespace Especifico

```typescript
const { t } = useTranslation('settings');
return <span>{t('debugMode')}</span>;
```

### Com Multiplos Namespaces

```typescript
const { t } = useTranslation(['execution', 'status', 'common']);
return <span>{t('status:task.running')}</span>;
```

### Com Interpolacao

```typescript
// No JSON: "taskHistory.viewAll": "Ver todas as {{count}} tarefas"
t('taskHistory.viewAll', { count: 5 }) // "Ver todas as 5 tarefas"
```

## Como Adicionar Nova String

1. Adicione a chave no arquivo JSON do namespace apropriado (pt-BR primeiro)
2. Adicione a mesma chave no arquivo en/
3. Use no componente com `t('namespace:key')` ou `t('key')` para common

### Exemplo

**1. Adicionar em `pt-BR/common.json`:**
```json
{
  "minhaNovaChave": "Minha nova traducao"
}
```

**2. Adicionar em `en/common.json`:**
```json
{
  "minhaNovaChave": "My new translation"
}
```

**3. Usar no componente:**
```typescript
const { t } = useTranslation();
return <span>{t('minhaNovaChave')}</span>;
```

## Como Adicionar Novo Idioma

1. Crie pasta `locales/[codigo-idioma]/` (ex: `locales/es/`)
2. Copie todos os JSONs de pt-BR
3. Traduza os valores
4. Adicione imports em `lib/i18n.ts`:

```typescript
// Adicionar imports
import esCommon from '../locales/es/common.json';
import esHome from '../locales/es/home.json';
// ... outros namespaces

// Adicionar ao resources
const resources = {
  // ... existentes
  es: {
    common: esCommon,
    home: esHome,
    // ... outros namespaces
  },
};
```

5. Adicione em `availableLanguages`:

```typescript
export const availableLanguages = [
  { code: 'pt-BR', name: 'Portugues (Brasil)', flag: 'BR' },
  { code: 'en', name: 'English', flag: 'US' },
  { code: 'es', name: 'Espanol', flag: 'ES' }, // Novo idioma
] as const;
```

## Main Process

O main process usa sistema separado em `src/main/i18n/index.ts`.

### Uso Basico

```typescript
import { t, setLocale } from './i18n';

// Definir locale (geralmente feito no startup)
import { app } from 'electron';
setLocale(app.getLocale());

// Usar traducao
dialog.showMessageBox({ title: t('dialog.updateRequired.title') });

// Com parametros
t('dialog.updateRequired.message', { storedVersion: 5 });
```

### Adicionar Nova Traducao no Main Process

Edite `src/main/i18n/index.ts`:

```typescript
const ptBR: Translations = {
  // ... existentes
  'minha.nova.chave': 'Minha traducao',
};

const en: Translations = {
  // ... existentes
  'minha.nova.chave': 'My translation',
};
```

## Idioma Padrao

- **Renderer**: pt-BR (salvo no localStorage como `i18nextLng`)
- **Main Process**: Detectado automaticamente via `app.getLocale()`, fallback para pt-BR

## Namespaces Disponiveis

| Namespace | Descricao | Uso Tipico |
|-----------|-----------|------------|
| `common` | Strings gerais | Navegacao, botoes, acoes comuns |
| `home` | Pagina inicial | Titulo, placeholder, use cases |
| `execution` | Execucao de tarefas | Permissoes, status, mensagens |
| `settings` | Configuracoes | Tabs, labels, toggles |
| `providers` | Provedores de IA | Nomes, descricoes, formularios |
| `speech` | Entrada de voz | Botoes, status, configuracoes |
| `status` | Status de tarefas | Badges, estados, transicoes |
| `tools` | Ferramentas | Labels das tools usadas pelo agente |

## Boas Praticas

1. **Organize por contexto**: Use namespaces apropriados
2. **Mantenha consistencia**: Use mesmas chaves em todos os idiomas
3. **Evite strings hardcoded**: Sempre use o sistema i18n
4. **Teste ambos idiomas**: Verifique que as traducoes funcionam
5. **Use interpolacao**: Para valores dinamicos, use `{{variavel}}`

## Depuracao

Em modo desenvolvimento, o i18next mostra logs no console. Procure por:

- `[i18n]` - Logs do sistema
- Avisos sobre chaves faltando
- Erros de carregamento de namespace

## Arquivos Relacionados

- `src/renderer/lib/i18n.ts` - Configuracao do react-i18next
- `src/renderer/main.tsx` - Inicializacao do i18n
- `src/main/i18n/index.ts` - Sistema i18n do main process
- `src/renderer/components/layout/SettingsDialog.tsx` - Seletor de idioma
