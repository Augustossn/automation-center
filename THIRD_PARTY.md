# Componentes de interface

- **Bklit UI**: fontes oficiais instaladas pelo registry `https://ui.bklit.com/r/area-chart.json` e dependências transitivas do registry. Código em `frontend/src/components/charts` e `shimmering-text.tsx`. Correção local: caminho de importação do label de loading para a estrutura Vite. [Documentação](https://ui.bklit.com/docs/installation).
- **shadcn/ui**: composição do botão com Slot, CVA e utilitário `cn`, adaptada ao tema da aplicação. [Documentação](https://ui.shadcn.com/docs/components/button).
- **MicroKit**: padrões de tabs e ação/sucesso adaptados de [Sliding Content Tabs](https://microkit.co/components/sliding-content-tabs) e [Secure Purchase Button](https://microkit.co/components/secure-purchase-button). Estado controlado pela aplicação; timers de sucesso fictício e efeitos irrelevantes removidos.
- **Kokonut UI**: adaptação mínima das posições do [Card Stack](https://github.com/kokonut-labs/kokonutui/blob/main/components/kokonutui/card-stack.tsx), de Dorian Baffier, MIT, para o vazio do Kanban. Imagens de produtos, expansão ao hover e conteúdo financeiro removidos. Licença em `THIRD_PARTY_KOKONUT_LICENSE.txt`.

As versões exatas das dependências npm estão em `frontend/package-lock.json`. Bencho não foi instalado porque não há command palette.
