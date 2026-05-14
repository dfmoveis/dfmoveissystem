## 1. Olho para mostrar/ocultar senha

No `src/routes/index.tsx` (formulário de login):
- Adicionar estado `showPassword` (boolean).
- Envolver o `<Input type="password">` em um wrapper `relative` com botão `Eye`/`EyeOff` (lucide-react) posicionado à direita dentro do campo.
- Alternar `type` entre `"password"` e `"text"` ao clicar.
- O mesmo padrão será aplicável depois em telas de "trocar senha" se necessário.

## 2. Mostrar erro de login claramente

Hoje o erro só aparece como toast e some rápido. Vou:
- Adicionar estado `errorMessage` no componente.
- Exibir um bloco `Alert` (vermelho, destrutivo) acima do botão "Acessar Sistema" sempre que login falhar, com mensagens específicas:
  - "E-mail ou senha incorretos" quando não encontra usuário.
  - "Erro ao conectar com o servidor" quando a chamada falha.
- Limpar o erro ao começar a digitar de novo.
- Manter o toast também (curto), mas o Alert fica visível até nova tentativa.

## 3. Bug crítico no login (preciso corrigir junto)

O código atual está quebrado:

```ts
.eq('email', email)
.eq('avatar_url', password as any) // comparando senha com avatar_url
```

Isso faz NINGUÉM conseguir entrar. Vou corrigir para `.eq('password', password)` (que é a coluna real de senha conforme decisões anteriores). Sem isso, o "olho" e o "mostrar erro" não adiantam — o login sempre vai falhar.

## 4. Compatibilidade com Vercel — situação real

O projeto **não é um app Vite/SPA comum**. É **TanStack Start com SSR rodando em Cloudflare Workers** (`@cloudflare/vite-plugin`, `wrangler.jsonc`, `src/server.ts`). Por isso:

- O `vercel.json` atual com `rewrites` para `/index.html` **está errado** — o build não gera um `index.html` estático, gera um Worker SSR. Esse arquivo é o que está causando seu `404: NOT_FOUND` na Vercel.
- A Vercel **não roda Cloudflare Workers**. Para deploy nativo na Vercel seria preciso trocar o adapter do TanStack Start para o de Vercel (Node/Edge Functions), o que mexe em `vite.config.ts`, remove `@cloudflare/vite-plugin`, remove `wrangler.jsonc`, e exige reconfigurar variáveis de ambiente no painel da Vercel — uma migração estrutural, não um ajuste.

### Duas opções para você escolher antes de eu mexer

**Opção A — Manter Cloudflare (recomendado, é o ambiente nativo do Lovable):**
- Apenas **deletar `vercel.json`** (está enganando você).
- Publicar pelo botão "Publish" do Lovable (URL `*.lovable.app`) ou conectar domínio custom lá.
- Zero risco de quebrar nada.

**Opção B — Migrar para deploy nativo na Vercel:**
- Remover `@cloudflare/vite-plugin`, `wrangler.jsonc`, `src/server.ts` específico de CF.
- Trocar o preset do TanStack Start para Vercel.
- Reescrever `vercel.json` com a config correta de SSR (functions, não rewrites de SPA).
- Configurar `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` no dashboard da Vercel.
- Risco médio: pode exigir ajustes em server functions e quebrar SSR temporariamente.

## Pergunta antes de implementar

O item 1, 2 e 3 eu já sigo direto (são pequenos e necessários). Para o item 4, **qual opção você quer**: A (manter Cloudflare/Lovable e só remover o `vercel.json` quebrado) ou B (migrar de fato para Vercel)?
