# BACKLOG

Itens fora do escopo da v1 ou adiados. Mudanças pedidas depois da validação com o Núcleo entram aqui primeiro e só vão para o spec depois de aprovadas.

## Fora de escopo (v1)
- Pagamentos
- Certificados de participação
- Notificações por e-mail ou WhatsApp (confirmação de inscrição, lembretes)
- App mobile
- Integração com sistemas da prefeitura
- Relatórios avançados (exportação CSV/PDF, séries históricas)
- Deploy em hospedagem
- Níveis de permissão na equipe (hoje há um perfil único)
- Cancelamento da inscrição pelo próprio público

## Débitos técnicos do protótipo
- Sessão em memória (`MemoryStore`): se perde ao reiniciar o servidor. Para produção, usar um store persistente.
- Limite de tentativas de login em memória: zera ao reiniciar.
- Exclusão e anonimização de dados de participantes (LGPD: direito de eliminação).
- Sem linter nem testes E2E automatizados.

## Ideias para depois da validação
_(vazio)_
