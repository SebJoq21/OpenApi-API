import { EstadoOrden } from '@prisma/client';
import { calcularAlertaSla } from '../../src/ordenes/domain/sla';

describe('calcularAlertaSla', () => {
  const now = new Date('2026-01-01T12:00:00.000Z');

  it('alerta una orden activa vencida', () => {
    const ingreso = new Date('2026-01-01T11:00:00.000Z');
    expect(calcularAlertaSla(EstadoOrden.PENDIENTE, ingreso, 20, now)).toBe(true);
  });

  it('no alerta una orden activa dentro del SLA', () => {
    const ingreso = new Date('2026-01-01T11:50:00.000Z');
    expect(calcularAlertaSla(EstadoOrden.PREPARANDO, ingreso, 20, now)).toBe(false);
  });

  it('no alerta una orden entregada', () => {
    const ingreso = new Date('2026-01-01T10:00:00.000Z');
    expect(calcularAlertaSla(EstadoOrden.ENTREGADO, ingreso, 20, now)).toBe(false);
  });

  it('no alerta una orden anulada', () => {
    const ingreso = new Date('2026-01-01T10:00:00.000Z');
    expect(calcularAlertaSla(EstadoOrden.ANULADO, ingreso, 20, now)).toBe(false);
  });
});
