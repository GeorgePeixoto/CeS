import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  HttpError, ValidationError, NotFoundError, ConflictError, UnauthorizedError,
} from '../../src/lib/errors.js';
import {
  validate, requiredString, optionalString, integer, optionalInteger, isoDate, optionalIsoDate,
  time, phoneBR, optionalPhoneBR, optionalEmail, oneOf, mustBeTrue,
} from '../../src/lib/validation.js';
import { todayInFortaleza, ageOn, isValidIsoDate, weekdayOf } from '../../src/lib/dates.js';

describe('errors', () => {
  test('HttpError subclasses carry status and code', () => {
    assert.equal(new NotFoundError().status, 404);
    assert.equal(new NotFoundError().code, 'NOT_FOUND');
    assert.equal(new UnauthorizedError().status, 401);
    const conflict = new ConflictError('NO_SEATS', 'Sem vagas.');
    assert.equal(conflict.status, 409);
    assert.equal(conflict.code, 'NO_SEATS');
    assert.ok(conflict instanceof HttpError);
  });

  test('ValidationError exposes fields', () => {
    const err = new ValidationError({ name: 'Obrigatório.' });
    assert.equal(err.status, 400);
    assert.equal(err.code, 'VALIDATION_ERROR');
    assert.deepEqual(err.fields, { name: 'Obrigatório.' });
  });
});

describe('validators', () => {
  test('requiredString trims and enforces bounds', () => {
    assert.equal(requiredString({ max: 10 })('  Ana  '), 'Ana');
    assert.throws(() => requiredString()(''));
    assert.throws(() => requiredString()('   '));
    assert.throws(() => requiredString()(undefined));
    assert.throws(() => requiredString({ max: 3 })('abcd'));
    assert.throws(() => requiredString({ min: 3 })('ab'));
    assert.throws(() => requiredString()(42));
  });

  test('optionalString returns null for empty values', () => {
    assert.equal(optionalString()(''), null);
    assert.equal(optionalString()(undefined), null);
    assert.equal(optionalString()(null), null);
    assert.equal(optionalString()(' x '), 'x');
    assert.throws(() => optionalString({ max: 2 })('abc'));
  });

  test('integer parses numeric strings and enforces range', () => {
    assert.equal(integer({ min: 1, max: 500 })('20'), 20);
    assert.equal(integer({ min: 1 })(3), 3);
    assert.throws(() => integer({ min: 1 })(0));
    assert.throws(() => integer({ max: 5 })(6));
    assert.throws(() => integer()('2.5'));
    assert.throws(() => integer()('abc'));
    assert.throws(() => integer()(''));
    assert.equal(optionalInteger()(''), null);
    assert.equal(optionalInteger()(null), null);
    assert.equal(optionalInteger({ min: 0 })('12'), 12);
  });

  test('isoDate accepts only real calendar dates', () => {
    assert.equal(isoDate()('2026-11-13'), '2026-11-13');
    assert.throws(() => isoDate()('2026-02-30'));
    assert.throws(() => isoDate()('13/11/2026'));
    assert.throws(() => isoDate()(''));
    assert.equal(optionalIsoDate()(''), null);
  });

  test('time accepts HH:MM 24h', () => {
    assert.equal(time()('08:30'), '08:30');
    assert.equal(time()('23:59'), '23:59');
    assert.throws(() => time()('24:00'));
    assert.throws(() => time()('8:30'));
    assert.throws(() => time()('08:60'));
  });

  test('phoneBR normalizes to digits and requires 10 or 11 digits', () => {
    assert.equal(phoneBR()('(88) 99999-1234'), '88999991234');
    assert.equal(phoneBR()('88 3511-1234'), '8835111234');
    assert.throws(() => phoneBR()('99999-1234'));
    assert.throws(() => phoneBR()('123456789012'));
    assert.throws(() => phoneBR()(''));
    assert.equal(optionalPhoneBR()(''), null);
  });

  test('optionalEmail lowercases valid e-mails', () => {
    assert.equal(optionalEmail()(' Ana@Exemplo.com '), 'ana@exemplo.com');
    assert.equal(optionalEmail()(''), null);
    assert.throws(() => optionalEmail()('ana@'));
    assert.throws(() => optionalEmail()('ana exemplo.com'));
  });

  test('oneOf and mustBeTrue', () => {
    assert.equal(oneOf(['a', 'b'])('a'), 'a');
    assert.throws(() => oneOf(['a', 'b'])('c'));
    assert.equal(mustBeTrue()(true), true);
    assert.throws(() => mustBeTrue()('true'));
    assert.throws(() => mustBeTrue()(false));
  });

  test('validate collects every field error at once', () => {
    const schema = { name: requiredString(), phone: phoneBR() };
    assert.deepEqual(
      validate({ name: 'Ana', phone: '(88) 99999-1234', extra: 'ignored' }, schema),
      { name: 'Ana', phone: '88999991234' },
    );
    try {
      validate({ name: '', phone: '1' }, schema);
      assert.fail('should throw');
    } catch (err) {
      assert.ok(err instanceof ValidationError);
      assert.deepEqual(Object.keys(err.fields).sort(), ['name', 'phone']);
      assert.equal(typeof err.fields.name, 'string');
    }
  });

  test('validate tolerates a missing body', () => {
    assert.throws(() => validate(undefined, { name: requiredString() }), ValidationError);
  });
});

describe('dates', () => {
  test('todayInFortaleza uses UTC-3 regardless of machine timezone', () => {
    // 02:00 UTC on Nov 13 is still Nov 12 in Fortaleza (UTC-3)
    assert.equal(todayInFortaleza(new Date('2026-11-13T02:00:00Z')), '2026-11-12');
    assert.equal(todayInFortaleza(new Date('2026-11-13T03:00:00Z')), '2026-11-13');
  });

  test('ageOn counts completed years', () => {
    assert.equal(ageOn('2010-11-14', '2026-11-13'), 15);
    assert.equal(ageOn('2010-11-13', '2026-11-13'), 16);
    assert.equal(ageOn('2008-02-29', '2026-02-28'), 17);
  });

  test('isValidIsoDate and weekdayOf', () => {
    assert.equal(isValidIsoDate('2024-02-29'), true);
    assert.equal(isValidIsoDate('2026-02-29'), false);
    assert.equal(weekdayOf('2026-11-15'), 0); // domingo
    assert.equal(weekdayOf('2026-11-17'), 2); // terça
  });
});
