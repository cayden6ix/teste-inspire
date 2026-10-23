import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import {
  CONSTRAINT_TEMPLATES,
  FALLBACK_CONSTRAINT_TEMPLATE,
  FIELD_LABELS,
} from '../messages/validation-messages.js';

/**
 * Prioridade das regras violadas por um mesmo campo: a menor vence.
 * Assim, campo vazio mostra so "nao pode estar vazio", nao tambem o tipo ou o tamanho.
 */
const CONSTRAINT_PRIORITY: Record<string, number> = {
  isNotEmpty: 0,
  whitelistValidation: 0,
  isEmail: 1,
  isString: 1,
  isInt: 1,
  isBoolean: 1,
  isArray: 1,
  isUuid: 1,
  isEnum: 1,
  isIn: 1,
  isDateString: 1,
  isCalendarDate: 1,
  min: 2,
  max: 2,
  minLength: 2,
  maxLength: 2,
  matches: 2,
};

const DEFAULT_PRIORITY = 3;

/**
 * Converte os erros do ValidationPipe em uma excecao 400 com mensagens em portugues.
 */
export function buildValidationException(errors: ValidationError[]): BadRequestException {
  return new BadRequestException(translateValidationErrors(errors));
}

/**
 * Uma mensagem por campo, no formato `O campo "E-mail" deve ser um e-mail válido.`
 * Quando um campo viola varias regras, aparece apenas a mais especifica.
 *
 * Erros de objetos aninhados (`children`) sao percorridos recursivamente; a mensagem
 * usa o rotulo do campo mais interno.
 */
export function translateValidationErrors(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => {
    const nested = translateValidationErrors(error.children ?? []);
    const entries = Object.entries(error.constraints ?? {});
    if (entries.length === 0) {
      return nested;
    }

    const [constraint, original] = entries.reduce((best, current) =>
      priorityOf(current[0]) < priorityOf(best[0]) ? current : best,
    );

    const format = (error.contexts?.[constraint] as { format?: unknown } | undefined)?.format;

    return [
      buildFieldMessage(error.property, constraint, original, typeof format === 'string' ? format : undefined),
      ...nested,
    ];
  });
}

function priorityOf(constraint: string): number {
  return CONSTRAINT_PRIORITY[constraint] ?? DEFAULT_PRIORITY;
}

/**
 * O class-validator nao entrega os argumentos das regras (ex.: o limite do maxLength) em
 * campos separados. Eles sao lidos do texto padrao em ingles, que traz o valor depois
 * do nome da propriedade (ex.: "limit must not be greater than 100").
 * O `{format}` vem do contexto da regra; sem ele, vale o texto generico.
 */
function buildFieldMessage(
  property: string,
  constraint: string,
  original: string,
  format: string | undefined,
): string {
  const label = FIELD_LABELS[property] ?? property;
  let template = CONSTRAINT_TEMPLATES[constraint] ?? FALLBACK_CONSTRAINT_TEMPLATE;
  if (template.includes('{format}') && !format) {
    template = FALLBACK_CONSTRAINT_TEMPLATE;
  }

  const detail = original.slice(property.length);

  const rule = template
    .replace('{n}', detail.match(/\d+/)?.[0] ?? '')
    .replace('{values}', detail.split('following values: ')[1] ?? '')
    .replace('{format}', format ?? '');

  return `O campo "${label}" ${rule}.`;
}
