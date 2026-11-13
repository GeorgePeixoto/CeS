# Spec: `reports`

> Módulo P2. Depende de: `enrollments`, `attendance`. Áreas comuns em [SPEC.md](SPEC.md).
> Plano B para o prazo: se não der tempo para os gráficos, entregar só a tabela (critérios 1–4) e deixar o Chart.js no BACKLOG.

## Objetivo
Dar à equipe uma visão rápida de procura e participação: inscritos por atividade, ocupação das vagas e frequência. Substitui as planilhas manuais.

## Definições
- **Inscritos ativos** = inscrições `pending` + `confirmed`.
- **Ocupação (%)** = inscritos ativos ÷ `capacity` × 100, arredondado para inteiro.
- **Frequência da atividade (%)** = registros com `present = 1` ÷ total de registros de presença da atividade × 100. Se não houver registros, mostra "—" (nunca 0% nem divisão por zero).
- **Período:** filtro opcional `from`/`to` aplicado sobre `start_date` da atividade. Só entram atividades `published` ou `cancelled`; rascunhos ficam de fora.

## Interface (`requireAdmin`)
| Rota | Descrição |
|---|---|
| `GET /api/admin/reports/summary?from=&to=&category=` | `{ totals: { activities, enrollments, participants, avgOccupancy, avgAttendance }, byActivity: [{ id, title, category, capacity, enrolled, confirmed, occupancy, attendanceRate }], byCategory: [{ category, enrolled }] }` |

**Página:** `public/admin/relatorios.html`
- Cartões com os totais.
- Gráfico de barras: inscritos × vagas por atividade.
- Gráfico de barras: frequência (%) por atividade.
- Tabela com todas as colunas do `byActivity`, com ordenação por clique no cabeçalho.
- Filtros de período e categoria.
- Chart.js 4.4.1 por `https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js`.

Nenhum dado pessoal aparece nos relatórios, só números agregados.

## Critérios de aceite
1. Com as inscrições do cenário de teste (atividade A: 10 vagas, 6 ativas e 1 cancelada), `byActivity` de A mostra `enrolled = 6` e `occupancy = 60`.
2. Com 8 registros de presença em A, sendo 6 presentes, `attendanceRate = 75`.
3. Uma atividade sem registros de presença → `attendanceRate: null`.
4. Os filtros de período e categoria mudam os resultados conforme esperado. Rascunhos nunca aparecem.
5. A página mostra os dois gráficos e a tabela com dados do seed, e funciona no celular (os gráficos se ajustam à largura).
6. Sem sessão → 401.

## Verificação
- `npm test -- tests/reports`
- Manual: rodar `db:seed`, gerar algumas inscrições e presenças, abrir `/admin/relatorios.html` e conferir os números com a tabela.
