import { describe, expect, it } from 'vitest';
import { formatDate, formatNumber, formatPercent } from './format';

describe('formatDate', () => {
  it('AAAA-MM-DD vira dd/mm/aaaa, sem voltar um dia por causa do fuso', () => {
    expect(formatDate('2026-01-31')).toBe('31/01/2026');
    expect(formatDate('2028-02-29')).toBe('29/02/2028');
  });

  it('aceita ISO com hora (usa só a data)', () => {
    expect(formatDate('2026-12-01T23:59:59.000Z')).toBe('01/12/2026');
  });

  it('sem data devolve null', () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate('')).toBeNull();
  });
});

describe('formatNumber', () => {
  it('usa o separador de milhar pt-BR', () => {
    expect(formatNumber(5047)).toBe('5.047');
    expect(formatNumber(1000000)).toBe('1.000.000');
    expect(formatNumber(15)).toBe('15');
  });
});

describe('formatPercent (REL-08)', () => {
  it.each([
    [0, 100, '0%'],
    [26, 5400, '<1%'],
    [14, 5400, '<1%'],
    [1, 100, '1%'],
    [1, 3, '33%'],
    [2, 3, '67%'],
    [3, 3, '100%'],
    [5, 0, '0%'],
  ])('%i de %i = %s', (parte, total, esperado) => {
    expect(formatPercent(parte, total)).toBe(esperado);
  });
});
