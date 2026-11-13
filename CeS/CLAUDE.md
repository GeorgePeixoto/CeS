# CLAUDE.md — Núcleo Marcus Jussier

Protótipo acadêmico de gestão de oficinas, cursos e eventos. A fonte da verdade são os specs:
[SPEC.md](SPEC.md) (comum) e `SPEC-<module-id>.md` (por módulo). Plano: [tasks/plan.md](tasks/plan.md); tarefas: [tasks/todo.md](tasks/todo.md).

## Comandos
```bash
npm install
npm run db:migrate            # aplica src/db/migrations/*.sql
npm run db:seed               # dados de exemplo
npm run admin:create -- --email equipe@nucleo.local --name "Equipe"
npm run dev                   # http://localhost:3000 (admin em /admin/)
npm test                      # node --test (todos os *.test.js)
node --test tests/<module>/   # só um módulo
npm run test:coverage
npm run check                 # node --check em todos os .js
```
Copie `.env.example` para `.env` antes de rodar `dev` e `start`.

## Stack
Node 26 (ESM) · Express 5 · SQLite via `node:sqlite` (embutido) · express-session · bcryptjs · HTML/CSS/JS puro · Chart.js 4.4.1 por CDN (só nos relatórios). Os testes usam `node:test` + `fetch` contra `createApp({ dbPath: ':memory:' })`.

## Convenções
- Código em inglês; interface e mensagens de erro em pt-BR.
- `src/modules/<id>/{repository,service,routes}.js`. SQL só no repository e sempre com prepared statements.
- API: sucesso `{ data }`, erro `{ error: { code, message, fields? } }`.
- Datas `YYYY-MM-DD`, horários `HH:MM`. "Hoje" vem de `lib/dates.js` (fuso America/Fortaleza).
- Nunca expor dados pessoais nas rotas públicas nem nos relatórios.

## Regras de trabalho
- Novas dependências, mudança de schema fora do spec e configuração de git: **perguntar antes**.
- Commits e pushes ficam com o usuário; só fazer commit se ele pedir.
- Mudanças de escopo vão primeiro para o [BACKLOG.md](BACKLOG.md).
- Atualizar este arquivo quando comandos ou convenções mudarem.
