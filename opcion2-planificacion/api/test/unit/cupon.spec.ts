import { Prisma, TipoCupon } from '@prisma/client';
import { calcularDescuento } from '../../src/ordenes/domain/cupon';

describe('calcularDescuento', () => {
  it('aplica porcentaje', () => {
    const descuento = calcularDescuento(new Prisma.Decimal(100), {
      tipo: TipoCupon.PORCENTAJE,
      valor: new Prisma.Decimal(10),
    });
    expect(descuento.toFixed(2)).toBe('10.00');
  });

  it('aplica monto fijo', () => {
    const descuento = calcularDescuento(new Prisma.Decimal(85.5), {
      tipo: TipoCupon.MONTO_FIJO,
      valor: new Prisma.Decimal(15),
    });
    expect(descuento.toFixed(2)).toBe('15.00');
  });

  it('nunca supera el subtotal', () => {
    const descuento = calcularDescuento(new Prisma.Decimal(100), {
      tipo: TipoCupon.MONTO_FIJO,
      valor: new Prisma.Decimal(200),
    });
    expect(descuento.toFixed(2)).toBe('100.00');
  });

  it('redondea a dos decimales', () => {
    const descuento = calcularDescuento(new Prisma.Decimal(99.99), {
      tipo: TipoCupon.PORCENTAJE,
      valor: new Prisma.Decimal(33.33),
    });
    expect(descuento.toFixed(2)).toBe('33.33');
  });
});
