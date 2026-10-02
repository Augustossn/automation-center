# Etapa posterior: Kubernetes

Os manifestos são uma base revisável, ainda não aplicada a um cluster. Substitua as imagens por tags imutáveis do seu registro, hostname, endereços dos serviços gerenciados e certificados. Provisionar PostgreSQL, Redis e Kafka com backups, autenticação e TLS é responsabilidade da plataforma; estes manifestos não criam bancos efêmeros.

1. Aplicar namespace e ConfigMap.
2. Criar `automation-secrets` no namespace com `DJANGO_SECRET_KEY`, `POSTGRES_PASSWORD` e `WEBHOOK_SECRET` pelo gerenciador de segredos da plataforma.
3. Executar o Job de migração e aguardar sua conclusão antes dos Deployments.
4. Aplicar workloads, services e ingress. O scheduler deve ter apenas uma réplica.
5. Configurar scraping interno de `/metrics`, alertas, NetworkPolicies, armazenamento de logs, HPA, revisão de imagens e recuperação de desastres.

Autenticação Basic é destinada à demonstração local; no ambiente corporativo, integrar SSO/OIDC, autorização por workspace e retenção de dados. Aprovar um rascunho não envia mensagens.
