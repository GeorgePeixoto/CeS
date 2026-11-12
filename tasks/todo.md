# Tasks — Núcleo Marcus Jussier

> Plano: [plan.md](plan.md). Cada tarefa só fica concluída com `npm test` verde e os critérios marcados.
> Definição de pronto (vale para todas): testes passando, `npm run check` ok, nenhum segredo no código, textos da interface em pt-BR, CLAUDE.md e BACKLOG.md atualizados se algo mudou.

---

## Phase 1: Foundation — `platform`

### T1: Scaffold do projeto + CLAUDE.md + BACKLOG.md
**Descrição:** `package.json` (ESM, scripts do SPEC.md, `engines.node >= 26`), `.env.example`, instalação das dependências **com sua aprovação**, `CLAUDE.md` (comandos, convenções e ponteiros para os specs) e `BACKLOG.md` (itens fora de escopo + ideias).
**Aceite:**
- [x] `npm install` funciona e só instala `express`, `express-session` e `bcryptjs`
- [x] `.env.example` tem todas as variáveis do SPEC.md e o `.env` está no `.gitignore`
- [x] CLAUDE.md e BACKLOG.md existem
**Verificar:** `npm ls --depth=0`; `git status` não mostra `.env` nem `node_modules`
**Depende de:** —
**Arquivos:** `package.json`, `.env.example`, `CLAUDE.md`, `BACKLOG.md`
**Tamanho:** S

### T2: Erros e validadores (TDD)
**Descrição:** `lib/errors.js` (classes HttpError), `lib/validation.js` (validadores do SPEC-platform) e `lib/dates.js` (`todayInFortaleza()`, `ageOn(birthDate, date)`).
**Aceite:**
- [x] `phoneBR('(88) 99999-1234')` → `'88999991234'`; menos de 10 dígitos → erro
- [x] `isoDate`, `time` e `email` rejeitam formatos inválidos
- [x] `ageOn('2010-11-14', '2026-11-13')` → 15
**Verificar:** `npm test -- tests/platform`
**Depende de:** T1
**Arquivos:** `src/lib/errors.js`, `src/lib/validation.js`, `src/lib/dates.js`, `tests/platform/lib.test.js`
**Tamanho:** S

### T3: Conexão SQLite, migrações e `transaction()`
**Descrição:** `db/connection.js` (`DatabaseSync`, pragmas, `transaction`), `db/migrate.js` (tabela `schema_migrations`, idempotente), `001_init.sql` (vazia, só registra a migração) e o script `db:migrate`.
**Aceite:**
- [x] Rodar a migração duas vezes não aplica nada na segunda
- [x] `transaction()` desfaz tudo se a função lançar erro
- [x] `PRAGMA foreign_keys` = 1
**Verificar:** `npm test -- tests/platform`; `npm run db:migrate` (duas vezes)
**Depende de:** T1
**Arquivos:** `src/db/connection.js`, `src/db/migrate.js`, `src/db/migrations/001_init.sql`, `tests/platform/db.test.js`
**Tamanho:** M

### T4: `createApp`, middleware de erro, health e helper de teste
**Descrição:** `app.js` (json com limite, cabeçalhos de segurança, estáticos, 404 JSON, middleware de erro), `server.js`, `lib/http.js` e `tests/helpers.js` (`startTestApp`).
**Aceite:**
- [x] `GET /api/health` → 200; `/api/nao-existe` → 404 `NOT_FOUND`
- [x] JSON malformado → 400; erro genérico → 500 sem stack no corpo
- [x] `ValidationError` → 400 com `fields`
**Verificar:** `npm test -- tests/platform`; `npm run dev` e abrir `/api/health`
**Depende de:** T2, T3
**Arquivos:** `src/app.js`, `src/server.js`, `src/lib/http.js`, `tests/helpers.js`, `tests/platform/app.test.js`
**Tamanho:** M

### T5: Base do front
**Descrição:** `styles.css` (mobile-first: cabeçalho, cards, formulários, tabelas, mensagens), `api.js` (wrapper de `fetch` + exibição de erros em pt-BR) e `index.html` provisório com o layout.
**Aceite:**
- [x] A página abre sem erros no console, em 360px e em 1280px de largura
- [x] `api.js` mostra `error.message` quando a API devolve erro
**Verificar:** manual no navegador
**Depende de:** T4
**Arquivos:** `public/css/styles.css`, `public/js/api.js`, `public/index.html`
**Tamanho:** S

### Checkpoint 1 — Foundation
- [x] `npm test` verde, `npm run check` ok
- [x] `npm run db:migrate && npm run dev` sobe sem warnings inesperados
- [x] Revisão rápida com você (commit b22cdc3)

---

## Phase 2: `admin-auth`

### T6: Tabela `admin_users` + script `admin:create`
**Descrição:** migração 002, repositório (findByEmail, create) e `scripts/create-admin.js` (lê a senha do terminal sem mostrar, mínimo de 8 caracteres, bcrypt custo 12).
**Aceite:**
- [x] O script cria o admin e o hash começa com `$2`
- [x] E-mail duplicado (sem diferenciar maiúsculas) → erro claro
**Verificar:** `npm test -- tests/admin-auth`; rodar `npm run admin:create`
**Depende de:** Checkpoint 1
**Arquivos:** `src/db/migrations/002_admin_users.sql`, `src/modules/admin-auth/repository.js`, `scripts/create-admin.js`, `tests/admin-auth/repository.test.js`
**Tamanho:** S

### T7: API de login, logout e `me` + `requireAdmin` + limite de tentativas
**Descrição:** sessão (`express-session`, cookie httpOnly/lax, 8h, regenerate no login), rotas, middleware e limite em memória (5 falhas em 15 min). O app não sobe sem `SESSION_SECRET`.
**Aceite:**
- [ ] Critérios 1–7 do SPEC-admin-auth cobertos por testes
- [ ] `password_hash` nunca aparece numa resposta
**Verificar:** `npm test -- tests/admin-auth`
**Depende de:** T6
**Arquivos:** `src/modules/admin-auth/service.js`, `src/modules/admin-auth/routes.js`, `src/modules/admin-auth/middleware.js`, `src/app.js`, `tests/admin-auth/auth.test.js`
**Tamanho:** M

### T8: Página de login + proteção das páginas do admin
**Descrição:** `admin/login.html`, `admin/index.html` (painel com links), `js/admin-guard.js` (chama `/me`; com 401, redireciona para o login; mostra o nome do usuário e o botão Sair).
**Aceite:**
- [ ] Abrir `/admin/index.html` sem sessão leva ao login
- [ ] Login certo leva ao painel; Sair volta ao login
**Verificar:** manual no navegador
**Depende de:** T7
**Arquivos:** `public/admin/login.html`, `public/admin/index.html`, `public/js/admin-guard.js`, `public/js/login.js`
**Tamanho:** S

### Checkpoint 2 — Admin auth
- [ ] `npm test` verde
- [ ] Fluxo de login manual ok
- [ ] Revisão com você

---

## Phase 3: `activities`

### T9: Categorias e instrutores (migração + API do admin)
**Descrição:** migração 003 completa (categories, instructors, activities, activity_schedules), repositório e service de categorias e instrutores e as rotas `/api/admin/categories*` e `/api/admin/instructors*`, mais o público `GET /api/categories`.
**Aceite:**
- [ ] Criar, editar e listar categorias e instrutores; nome de categoria duplicado → 409
- [ ] Desativar instrutor (`active = 0`); sem DELETE
- [ ] Sem sessão → 401
**Verificar:** `npm test -- tests/activities`
**Depende de:** Checkpoint 2
**Arquivos:** `src/db/migrations/003_activities.sql`, `src/modules/activities/repository.js`, `src/modules/activities/service.js`, `src/modules/activities/routes.js`, `tests/activities/catalog-admin.test.js`
**Tamanho:** M

### T10: Atividades no admin (CRUD, horários, status)
**Descrição:** validação de atividade (`activities/validation.js`), criar, editar (substituindo os horários), alterar status e listar todas no admin. Também `countActiveEnrollments` (devolve 0 até existir a tabela de inscrições) e a regra `CAPACITY_BELOW_ENROLLED`.
**Aceite:**
- [ ] Critérios 1, 5 e 6 do SPEC-activities
- [ ] `min_age` opcional é aceito e validado (inteiro de 0 a 120)
**Verificar:** `npm test -- tests/activities`
**Depende de:** T9
**Arquivos:** `src/modules/activities/validation.js`, `src/modules/activities/repository.js`, `src/modules/activities/service.js`, `src/modules/activities/routes.js`, `tests/activities/activities-admin.test.js`
**Tamanho:** M

### T11: API do catálogo público
**Descrição:** `GET /api/activities` (q, category, type; só `published`; ordenado por data) e `GET /api/activities/:id` com `seatsAvailable` e `soldOut`, sem os contatos do instrutor.
**Aceite:**
- [ ] Critérios 2, 3 e 4 do SPEC-activities
**Verificar:** `npm test -- tests/activities`
**Depende de:** T10
**Arquivos:** `src/modules/activities/repository.js`, `src/modules/activities/routes.js`, `tests/activities/catalog-public.test.js`
**Tamanho:** S

### T12: Páginas públicas: catálogo e detalhe
**Descrição:** `index.html` com cards (data, horários por extenso como "Ter e Qui, 14h–16h", instrutor, vagas, selo Esgotado), busca e filtro por categoria e tipo. `atividade.html?id=` com o detalhe (o formulário entra no T16).
**Aceite:**
- [ ] Critério 7 do SPEC-activities
- [ ] Busca e filtro funcionam sem recarregar a página; lista vazia mostra a mensagem "Nenhuma atividade encontrada"
**Verificar:** manual (com o seed do T14 ou dados criados no T13)
**Depende de:** T11
**Arquivos:** `public/index.html`, `public/atividade.html`, `public/js/catalog.js`, `public/js/activity.js`, `public/js/format.js`
**Tamanho:** M

### T13: Páginas do admin: atividades e instrutores
**Descrição:** `admin/atividades.html` (lista com status + formulário com horários dinâmicos + botões Publicar e Cancelar com confirmação) e `admin/instrutores.html` (lista + formulário + ativar/desativar). Categorias geridas num bloco simples dentro da página de atividades.
**Aceite:**
- [ ] Criar uma atividade pela tela, publicá-la e vê-la no catálogo
- [ ] Erros de validação aparecem ao lado dos campos (`fields`)
**Verificar:** manual
**Depende de:** T10, T8
**Arquivos:** `public/admin/atividades.html`, `public/admin/instrutores.html`, `public/js/admin-activities.js`, `public/js/admin-instructors.js`
**Tamanho:** M

### T14: Script de seed
**Descrição:** `scripts/seed.js`: 4 categorias (Música, Teatro, Dança, Artes Visuais), 4 instrutores e cerca de 8 atividades variadas (uma quase lotada, uma em rascunho, um evento de um dia, uma com `min_age`). É idempotente: não duplica se rodar de novo.
**Aceite:**
- [ ] `npm run db:seed` duas vezes não duplica nada
**Verificar:** rodar o seed e abrir o catálogo
**Depende de:** T10
**Arquivos:** `scripts/seed.js`
**Tamanho:** S

### Checkpoint 3 — Activities
- [ ] `npm test` verde
- [ ] Catálogo com o seed: busca, filtro e detalhe ok no celular e no desktop
- [ ] Revisão com você

---

## Phase 4: `enrollments`

### T15: Pré-inscrição pública com bloqueio de vagas (alto risco, TDD)
**Descrição:** migração 004, geração de protocolo, reaproveitamento de participante (nome normalizado + telefone), validação (menor de idade → responsável obrigatório; consentimento; `min_age`; `ACTIVITY_ENDED`) e `POST /api/activities/:id/enrollments` dentro de `transaction()`. Atualizar `countActiveEnrollments` para contar de verdade.
**Aceite:**
- [ ] Critérios 1–6 do SPEC-enrollments, incluindo o teste de 10 pedidos simultâneos para 3 vagas
- [ ] `BELOW_MIN_AGE` quando a idade (em Fortaleza, na data de hoje) é menor que `min_age`
**Verificar:** `npm test -- tests/enrollments`
**Depende de:** Checkpoint 3
**Arquivos:** `src/db/migrations/004_enrollments.sql`, `src/modules/enrollments/repository.js`, `src/modules/enrollments/service.js`, `src/modules/enrollments/routes.js`, `tests/enrollments/public.test.js`
**Tamanho:** M

### T16: Formulário de inscrição + consulta por protocolo
**Descrição:** `GET /api/enrollments/lookup`, formulário em `atividade.html` (campos do responsável aparecem conforme a data de nascimento, aviso de LGPD, aceite), tela de sucesso com o protocolo e `consulta.html`.
**Aceite:**
- [ ] Critério 7 do SPEC-enrollments (teste)
- [ ] Manual: inscrever-se, anotar o protocolo e consultá-lo; atividade esgotada desabilita o formulário
**Verificar:** `npm test -- tests/enrollments`; manual
**Depende de:** T15, T12
**Arquivos:** `src/modules/enrollments/routes.js`, `public/atividade.html`, `public/js/enroll.js`, `public/consulta.html`, `public/js/lookup.js`
**Tamanho:** M

### T17: API do admin: inscrições e participantes
**Descrição:** listar com filtros, mudar status (transições válidas), inscrição presencial (já `confirmed`) e listar, ver e editar participantes.
**Aceite:**
- [ ] Critérios 4 (recadastro depois de cancelar), 8 e 9 do SPEC-enrollments
- [ ] Transição inválida (por exemplo, cancelada → confirmada) → 409
**Verificar:** `npm test -- tests/enrollments`
**Depende de:** T15
**Arquivos:** `src/modules/enrollments/service.js`, `src/modules/enrollments/routes.js`, `src/modules/enrollments/repository.js`, `tests/enrollments/admin.test.js`
**Tamanho:** M

### T18: Páginas do admin: inscrições e participantes
**Descrição:** `admin/inscricoes.html` (filtros, Confirmar e Cancelar com confirmação, inscrição presencial) e `admin/participantes.html` (busca, detalhe com histórico, edição).
**Aceite:**
- [ ] Cancelar pela tela faz a vaga voltar no catálogo
- [ ] Toda ação destrutiva pede confirmação
**Verificar:** manual
**Depende de:** T17, T8
**Arquivos:** `public/admin/inscricoes.html`, `public/admin/participantes.html`, `public/js/admin-enrollments.js`, `public/js/admin-participants.js`
**Tamanho:** M

### Checkpoint 4 — P0 completo (meta: fim do Dia 1)
- [ ] `npm test` verde
- [ ] De ponta a ponta: catálogo → inscrição até esgotar → consulta → admin confirma e cancela → vaga volta
- [ ] Critérios de sucesso 1–4 e 6 do SPEC.md atendidos
- [ ] Revisão com você + decisão sobre P1/P2

---

## Phase 5: `attendance`

### T19: Datas de encontro + API de chamada
**Descrição:** `listSessionDates(activity)` (pura, TDD), migração 005 e as rotas `sessions`, GET e PUT de `attendance` (upsert numa transação, validação de data e de inscrição).
**Aceite:**
- [ ] Critérios 1–6 do SPEC-attendance
**Verificar:** `npm test -- tests/attendance`
**Depende de:** Checkpoint 4
**Arquivos:** `src/db/migrations/005_attendance.sql`, `src/modules/attendance/sessions.js`, `src/modules/attendance/repository.js`, `src/modules/attendance/routes.js`, `tests/attendance/attendance.test.js`
**Tamanho:** M

### T20: Página de chamada
**Descrição:** `admin/presenca.html`: escolher a atividade e a data (o padrão é o último encontro até hoje), aviso de inscrições pendentes, checkboxes, "Marcar todos" e "Salvar chamada".
**Aceite:**
- [ ] Salvar, recarregar e ver os mesmos valores
**Verificar:** manual
**Depende de:** T19
**Arquivos:** `public/admin/presenca.html`, `public/js/admin-attendance.js`
**Tamanho:** S

### Checkpoint 5
- [ ] `npm test` verde; chamada manual ok

---

## Phase 6: `reports`

### T21: API de resumo
**Descrição:** `GET /api/admin/reports/summary` com totais, `byActivity` e `byCategory`, filtros `from`/`to`/`category` e frequência `null` quando não há registros.
**Aceite:**
- [ ] Critérios 1–4 e 6 do SPEC-reports
- [ ] A resposta não contém nenhum dado pessoal
**Verificar:** `npm test -- tests/reports`
**Depende de:** Checkpoint 5 (ou Checkpoint 4, se o attendance for cortado: nesse caso a frequência fica sempre `null`)
**Arquivos:** `src/modules/reports/repository.js`, `src/modules/reports/routes.js`, `src/app.js`, `tests/reports/summary.test.js`
**Tamanho:** S

### T22: Página de relatórios (cartões, tabela, filtros) — plano B termina aqui
**Aceite:**
- [ ] Cartões e tabela ordenável batem com a API; os filtros funcionam
**Verificar:** manual
**Depende de:** T21
**Arquivos:** `public/admin/relatorios.html`, `public/js/admin-reports.js`
**Tamanho:** S

### T23: Gráficos com Chart.js
**Descrição:** gráficos de inscritos × vagas e de frequência por atividade (Chart.js 4.4.1 via cdnjs), responsivos.
**Aceite:**
- [ ] Critério 5 do SPEC-reports
**Verificar:** manual em 360px e 1280px de largura
**Depende de:** T22
**Arquivos:** `public/admin/relatorios.html`, `public/js/admin-reports.js`
**Tamanho:** S

### Checkpoint 6
- [ ] `npm test` verde; números do relatório conferidos à mão contra o seed

---

## Phase 7: Entrega

### T24: Ensaio da demo e atualização da documentação
**Descrição:** apagar o banco (**com sua confirmação**), rodar `db:migrate`, `db:seed` e `admin:create`, percorrer os critérios de sucesso do SPEC.md, escrever o roteiro da demo no CLAUDE.md (ou num README, se você quiser), atualizar o BACKLOG.md e marcar no SPEC o que foi cortado.
**Aceite:**
- [ ] Critérios de sucesso 1–7 do SPEC.md verificados
- [ ] `npm run test:coverage` ≥ 80% em services e lib
**Verificar:** roteiro manual completo
**Depende de:** Checkpoint 6 (ou o último checkpoint alcançado)
**Arquivos:** `CLAUDE.md`, `BACKLOG.md`, `SPEC.md`
**Tamanho:** S

### Checkpoint final
- [ ] Tudo verde, demo ensaiada, você faz o commit e o push
