import { applyDecorators } from '@nestjs/common';
import { IsDateString, Matches, ValidateBy } from 'class-validator';
import { DATE_ONLY_FORMAT, DATE_ONLY_PATTERN } from '../constants/date.constants.js';
import { isValidDateOnly } from '../utils/date.util.js';

/**
 * Data no formato YYYY-MM-DD, sem hora nem fuso, que existe no calendario.
 *
 * - texto que nem parece data (ex.: amanha): regra `isDateString`;
 * - formato errado (ex.: 2026/01/01, datetime com fuso): regra `matches`, com o
 *   `format` no contexto para a mensagem de validacao;
 * - formato certo, data impossivel (ex.: 2026-02-30): regra `isCalendarDate`.
 *
 * Um datetime com fuso poderia virar outro dia na coluna `date`, e uma data
 * impossivel viraria erro 500 no Postgres.
 */
export function IsDateOnly(): PropertyDecorator {
  return applyDecorators(
    Matches(DATE_ONLY_PATTERN, { context: { format: DATE_ONLY_FORMAT } }),
    IsDateString(),
    ValidateBy({
      name: 'isCalendarDate',
      validator: {
        // O formato e checado pelo `matches`; aqui so a existencia da data.
        validate: (value: unknown) =>
          typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value) || isValidDateOnly(value),
      },
    }),
  );
}
