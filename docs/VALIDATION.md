# Validação executada

Rodada final em 2 de outubro de 2026.

| Verificação | Resultado confirmado |
|---|---|
| Back-end em Docker | **26 testes aprovados**, Python 3.12, PostgreSQL 16 e Kafka real |
| Back-end no host | 25 testes aprovados, 1 Kafka ignorado; Python 3.14 e SQLite de desenvolvimento |
| React/Vitest | **9 testes aprovados** |
| Playwright | **5 testes aprovados**, incluindo arraste real, persistência, rollback, formulário, logs e permissões |
| OpenAPI | Geração e validação sem warnings |
| Django/migrações | System check sem erros; nenhuma migração pendente de geração |
| Interface | TypeScript/Vite compilados; telas em módulos com carregamento sob demanda |
| Docker | Stack completo ativo: API, interface, consumer, worker, beat, PostgreSQL, Redis, Kafka, Prometheus e Grafana |

O teste Kafka publicou um evento no broker, consumiu a mensagem, confirmou o offset e verificou que consumir novamente o mesmo evento não duplica a tarefa. Os testes de retries usam o Task real do Celery com respostas de integração simuladas para verificar espera progressiva, limite de tentativas e conclusão idempotente.

O smoke test `scripts/verify_stack.py` confirmou, no Docker: criação de lead pela API, publicação e consumo Kafka, recomendação persistida, criação de tarefa, PATCH de status persistido e sincronização do lead, interface servida, alvo Prometheus ativo e banco Grafana saudável. Resultados em `docs/stack-smoke.json`. O worker também executou um retry real de integração simulada. A prévia Docker desta rodada usa portas 18018 (API), 18088 (interface), 19090 (Prometheus) e 13000 (Grafana).

Os tópicos físicos usam o prefixo configurável `KAFKA_TOPIC_PREFIX` (padrão `automation-center.`). O teste de integração usa um prefixo UUID exclusivo por execução para que eventos de bancos temporários não bloqueiem o consumer da aplicação.

A suíte de navegador usa respostas REST simuladas para verificar ações determinísticas. As quatro capturas em `docs/evidence` foram obtidas contra a API Django real, com dados fictícios do seed, e verificadas visualmente. A prévia local usa SQLite explicitamente; a rodada Docker valida PostgreSQL.

Correções confirmadas durante a validação: pin `rpds-py` compatível com Python 3.12; inicialização das permissões do volume Kafka; produtor com tolerância à inicialização dos coordenadores; permissões de escrita do usuário do contêiner; portas exclusivas nos testes; sincronização do status do lead com suas tarefas. O lead só é resolvido após todas as tarefas, inclusive revisão humana, estarem resolvidas.

O build ainda informa um aviso de tamanho para o pacote inicial, aproximadamente 527 kB minificado / 160 kB gzip. Esse aviso não impede a compilação. Os workflows foram preparados, mas ainda não executados no GitHub. Publicação de imagens e aplicação dos manifestos Kubernetes permanecem etapas posteriores.
