# Implementation Plan: Sistema de Gestão de Oficinas — Núcleo Marcus Jussier

> Baseado em [SPEC.md](../SPEC.md) e nos specs de módulo, aprovados em 2026-11-11.
> Entrega: **2026-11-13**. Tarefas detalhadas em [todo.md](todo.md).

## Overview
Protótipo web local (Node 26 + Express 5 + SQLite embutido + HTML/CSS/JS puro), construído módulo a módulo na ordem do mapa aprovado. Dentro de cada módulo, as tarefas são fatias verticais (migração → service → rota → página) e cada fatia termina com `npm test` verde. O caminho público inteiro (catálogo → pré-inscrição → consulta) precisa estar funcionando no fim do Dia 1.

## Architecture Decisions
- **`createApp({ dbPath, sessionSecret })` separado de `server.js`:** os testes de integração sobem o app com SQLite `:memory:` numa porta aleatória, sem mocks.
- **Um repositório por módulo, o único lugar com SQL:** isola o `node:sqlite` e mantém viável trocar para MySQL depois.
- **Contagem de vagas num único método** (`activities/repository.countActiveEnrollments`): o catálogo e a pré-inscrição usam a mesma regra. Até a tabela `enrollments` existir, o método devolve 0.
- **`BEGIN IMMEDIATE` na pré-inscrição:** o `DatabaseSync` é síncrono, então as requisições de um processo já executam em série. Mesmo assim, a transação garante que a checagem da vaga e o INSERT sejam atômicos e protege contra um segundo processo (por exemplo, um script) gravando ao mesmo tempo.
- **"Hoje" calculado com `Intl` no fuso `America/Fortaleza`**, em `lib/dates.js`, em vez de depender da variável `TZ` no Windows.
- **Datas de encontro calculadas, não gravadas:** a função pura `listSessionDates(activity)` é testada isoladamente.
- **Front sem build:** um arquivo JS por página, `api.js` para o `fetch` e `admin-guard.js` para proteger as páginas do admin.

## Cronograma
| Quando | Fases | Meta |
|---|---|---|
| Dia 1 (12/11) manhã | 1 Foundation, 2 Admin auth | app sobe, login funciona |
| Dia 1 (12/11) tarde | 3 Activities, 4 Enrollments | **P0 completo:** fluxo público de ponta a ponta + admin |
| Dia 2 (13/11) manhã | 5 Attendance, 6 Reports | P1 e P2 (plano B: relatório só em tabela) |
| Dia 2 (13/11) antes da entrega | 7 Ensaio da demo | banco limpo + seed + roteiro de apresentação |

**Regra de corte:** se o P0 não estiver verde até o fim do Dia 1, o Dia 2 começa terminando o P0. Depois vem o `attendance`, e o `reports` fica só com a tabela (T21–T22). O T23 (gráficos) é o primeiro a sair.

## Task List (índice; detalhes em todo.md)

### Phase 1: Foundation — `platform`
- [x] T1: Scaffold do projeto + CLAUDE.md + BACKLOG.md
- [x] T2: Erros e validadores (TDD)
- [x] T3: Conexão SQLite, migrações e `transaction()`
- [x] T4: `createApp`, middleware de erro, health e helper de teste
- [x] T5: Base do front (CSS, `api.js`, layout)
- [x] **Checkpoint 1**

### Phase 2: `admin-auth`
- [x] T6: Tabela `admin_users` + script `admin:create`
- [x] T7: API de login, logout e `me` + `requireAdmin` + limite de tentativas
- [ ] T8: Página de login + proteção das páginas do admin
- [ ] **Checkpoint 2**

### Phase 3: `activities`
- [ ] T9: Categorias e instrutores (migração + API do admin)
- [ ] T10: Atividades no admin (CRUD, horários, status)
- [ ] T11: API do catálogo público (busca, filtros, vagas)
- [ ] T12: Páginas públicas: catálogo e detalhe
- [ ] T13: Páginas do admin: atividades e instrutores
- [ ] T14: Script de seed
- [ ] **Checkpoint 3**

### Phase 4: `enrollments`
- [ ] T15: Pré-inscrição pública com bloqueio de vagas (alto risco, TDD)
- [ ] T16: Formulário de inscrição + consulta por protocolo
- [ ] T17: API do admin: inscrições e participantes
- [ ] T18: Páginas do admin: inscrições e participantes
- [ ] **Checkpoint 4: P0 completo**

### Phase 5: `attendance`
- [ ] T19: Datas de encontro + API de chamada
- [ ] T20: Página de chamada
- [ ] **Checkpoint 5**

### Phase 6: `reports`
- [ ] T21: API de resumo
- [ ] T22: Página de relatórios (cartões, tabela, filtros)
- [ ] T23: Gráficos com Chart.js
- [ ] **Checkpoint 6**

### Phase 7: Entrega
- [ ] T24: Ensaio da demo e atualização da documentação
- [ ] **Checkpoint final**

## Risks and Mitigations
| Risco | Impacto | Mitigação |
|---|---|---|
| Prazo de 2 dias | Alto | Prioridades P0/P1/P2 e regra de corte acima; checkpoints com você a cada fase |
| `node:sqlite` com API diferente do esperado ou emitindo warning | Médio | O T3 valida a API logo no começo; o acesso fica isolado em `db/connection.js` |
| Vagas excedidas | Alto | Teste de concorrência (10 pedidos para 3 vagas) escrito antes da implementação, no T15 |
| Sessão em memória se perde ao reiniciar o servidor | Baixo | Aceito no protótipo; registrado no BACKLOG |
| Fuso horário no Windows (data "de hoje" errada) | Médio | `lib/dates.js` com `Intl` e fuso fixo, coberto por teste |
| Erros de português ou tela confusa na demo | Médio | O T24 percorre o roteiro completo no navegador, com tempo reservado |
| Dados pessoais de menores | Alto | Coleta mínima; nenhum dado pessoal nas rotas públicas nem nos relatórios; checado nos testes |

## Parallelization
O trabalho é sequencial: há um só agente e as migrações são encadeadas. As páginas (T12/T13, T18, T20, T22) podem ser adiadas para depois da API de cada fase, se isso ajudar a garantir o P0 primeiro.

## Open Questions
- Nenhuma. A aprovação das dependências (`express`, `express-session`, `bcryptjs`) é pedida no T1.
