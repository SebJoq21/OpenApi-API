import {
  formatNumeroOrden,
  getBusinessYear,
} from '../../src/ordenes/domain/numero-orden';

describe('numero_orden', () => {
  it('formatea con tres dígitos mínimos', () => {
    expect(formatNumeroOrden(2026, 1)).toBe('ORD-2026-001');
    expect(formatNumeroOrden(2026, 42)).toBe('ORD-2026-042');
  });

  it('crece si supera 999', () => {
    expect(formatNumeroOrden(2026, 1000)).toBe('ORD-2026-1000');
  });

  it('usa el año de negocio en America/Lima', () => {
    expect(getBusinessYear(new Date('2026-06-01T12:00:00.000Z'))).toBe(2026);
    expect(getBusinessYear(new Date('2026-01-01T02:00:00.000Z'))).toBe(2025);
  });
});
