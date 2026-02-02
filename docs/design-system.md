# Design System Jurisiar

Este documento define a identidade visual e os padrões de design do app Jurisiar.

## Filosofia

O Jurisiar é um assistente jurídico com personalidade **profissional e técnica**. A interface prioriza:

- **Clareza** - informação organizada e hiérarchica
- **Foco** - cores neutras que não distraem do conteúdo
- **Confiabilidade** - paleta sóbria para ambiente profissional jurídico

## Paleta de Cores

### Cores Primárias

| Nome | Token | Hex | HSL | Uso |
|------|-------|-----|-----|-----|
| Azul Marinho | `--primary` | `#1e3a5f` | `123 30% 20%` | Ações principais, botões, estados ativos |
| Branco | `--primary-foreground` | `#ffffff` | - | Texto sobre fundo primary |

### Cores de Superfície

| Nome | Token | Hex | HSL | Uso |
|------|-------|-----|-----|-----|
| Background | `--background` | `#f9f9f9` | `0 0% 97.6%` | Fundo principal da aplicação |
| Card | `--card` | `#fcfcfc` | `0 0% 98.8%` | Containers elevados (cards, diálogos) |
| Muted | `--muted` | `#efefef` | `0 0% 93.7%` | Fundos secundários, áreas de destaque sutil |
| Border | `--border` | `#eae2e1` | `12 8% 90%` | Bordas de elementos |

### Cores de Texto

| Nome | Token | Hex | HSL | Uso |
|------|-------|-----|-----|-----|
| Foreground | `--foreground` | `#202020` | `0 0% 12.5%` | Texto principal |
| Muted Foreground | `--muted-foreground` | `#646464` | `0 0% 39.2%` | Texto secundário, placeholders |

### Cores de Status

| Status | Token | Hex | Uso |
|--------|-------|-----|-----|
| Success | `text-green-500` | `#22c55e` | Tarefa concluída |
| Error | `text-red-500` | `#ef4444` | Tarefa falhou |
| Warning | `text-amber-500` | `#f59e0b` | Tarefa interrompida/pendente |
| Info | `text-primary` | `#1e3a5f` | Tarefa em execução |

## Tokens Tailwind

### Extensão de Cores

```typescript
// tailwind.config.ts
colors: {
  primary: {
    DEFAULT: '#1e3a5f',
    foreground: 'hsl(var(--primary-foreground))',
    50: '#f0f4f8',
    100: '#d9e2ec',
    // ... escala completa
  },
  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',
  card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
  muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
  border: 'hsl(var(--border))',
  // Cores de status
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
}
```

## Padrões de Uso

### Botões

```tsx
// Botão primário (ações principais)
<Button variant="default" className="bg-primary text-primary-foreground">
  Nova Tarefa
</Button>

// Botão secundário
<Button variant="outline">
  Cancelar
</Button>
```

### Hover em Items de Lista

Para estados de hover e ativo em listas de conversas:

```tsx
// Estado normal
className="text-zinc-700"

// Estado hover
hover:bg-primary/10 hover:text-primary

// Estado ativo (selecionado)
bg-primary text-primary-foreground
```

### Fatos Importantes

- **NÃO usar `bg-accent`** para fundos de hover - usar `bg-primary/10`
- **NÃO usar `bg-accent`** para backgrounds principais - usar `bg-background`
- O botão "Nova Tarefa" (`variant="default"`) usa `bg-primary` por padrão
- Estados ativos de navegação devem usar `bg-primary text-primary-foreground`

## Hierarquia Visual

```
1. primary (#1e3a5f)    → Ações principais, navegação ativa
2. foreground (#202020) → Conteúdo principal
3. muted (#efefef)      → Fundos secundários
4. border (#eae2e1)     → Separadores
```

## Evolução do Design

### Antes (Inconsistente)
- `bg-accent` usava dourado (#c9a227) em alguns contextos
- Hover nas conversas usava cor dourada
- Background da home usava dourado

### Depois (Padronizado)
- Todas as superfícies de fundo usam tons neutros
- Hover e estados ativos usam azul marinho (primary)
- Consistência com o botão "Nova Tarefa"

## Recursos

- Ícones: Phosphor Icons
- Tipografia: DM Sans
- Framework: Tailwind CSS + shadcn/ui
