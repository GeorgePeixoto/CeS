# Spec: `attendance`

> Módulo P1. Depende de: `enrollments`. Áreas comuns em [SPEC.md](SPEC.md).

## Objetivo
A equipe registra quem esteve presente em cada encontro de uma atividade, para acompanhar a frequência e alimentar os relatórios.

## Conceitos
- **Encontro:** cada data entre `start_date` e `end_date` que cai num `weekday` dos horários da atividade. As datas são calculadas, não ficam gravadas.
- **Chamada:** feita só para inscrições `confirmed`. Inscrições `pending` aparecem num aviso ("há N inscrições pendentes de confirmação"), mas não entram na lista.

## Modelo de dados (migração `005_attendance.sql`)
```sql
CREATE TABLE attendance (
  id            INTEGER PRIMARY KEY,
  enrollment_id INTEGER NOT NULL REFERENCES enrollments(id),
  session_date  TEXT NOT NULL,                     -- YYYY-MM-DD
  present       INTEGER NOT NULL CHECK (present IN (0,1)),
  recorded_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (enrollment_id, session_date)
);
```

## Interface (`requireAdmin`)
| Rota | Descrição |
|---|---|
| `GET /api/admin/activities/:id/sessions` | lista de datas de encontro `{ date, recorded: bool }` |
| `GET /api/admin/activities/:id/attendance?date=` | inscritos confirmados com `present: true/false/null` (null = ainda sem registro) |
| `PUT /api/admin/activities/:id/attendance?date=` `{ records: [{ enrollmentId, present }] }` | grava a chamada inteira numa transação (upsert); 200 com o resumo |

**Validação:** `date` precisa ser uma data de encontro da atividade e não pode ser futura (400 `INVALID_SESSION_DATE`); cada `enrollmentId` precisa ser uma inscrição `confirmed` desta atividade.

**Página:** `public/admin/presenca.html`: escolher a atividade e a data (o padrão é o encontro mais recente até hoje), lista com checkbox, "Marcar todos" e "Salvar chamada".

## Critérios de aceite
1. Uma atividade de 01/11 a 15/11 com horários às terças e quintas devolve exatamente as terças e quintas desse intervalo.
2. Salvar uma chamada com 3 presentes e 1 ausente → ao reabrir, os mesmos valores. Salvar de novo sobrescreve, sem duplicar.
3. Data que não é encontro, ou data futura → 400.
4. `enrollmentId` de outra atividade ou com status `pending` → 400, e nada é gravado (a transação inteira é desfeita).
5. Uma inscrição cancelada depois de ter presença registrada mantém o histórico, mas não aparece nas chamadas seguintes.
6. Sem sessão → 401.

## Verificação
- `npm test -- tests/attendance`
- Manual: confirmar inscrições do seed, fazer a chamada de um encontro passado, reabrir e conferir.
