import { Prisma } from '@prisma/client';
import { calcularMontos } from '../../src/common/money/money';

describe('calcularMontos', () => {
  it('calcula sin cupón', () => {
    const montos = calcularMontos(85.5, new Prisma.Decimal(0));
    expect(montos.descuento.toFixed(2)).toBe('0.00');
    expect(montos.igv.toFixed(2)).toBe('15.39');
    expect(montos.total.toFixed(2)).toBe('100.89');
  });

  it('calcula con cupón de 10%', () => {
    const montos = calcularMontos(100, new Prisma.Decimal(10));
    expect(montos.descuento.toFixed(2)).toBe('10.00');
    expect(montos.igv.toFixed(2)).toBe('16.20');
    expect(montos.total.toFixed(2)).toBe('106.20');
  });

  it('calcula con cupón fijo de 15', () => {
    const montos = calcularMontos(85.5, new Prisma.Decimal(15));
    expect(montos.descuento.toFixed(2)).toBe('15.00');
    expect(montos.igv.toFixed(2)).toBe('12.69');
    expect(montos.total.toFixed(2)).toBe('83.19');
  });

  it('topa el descuento al subtotal', () => {
    const montos = calcularMontos(100, new Prisma.Decimal(200));
    expect(montos.descuento.toFixed(2)).toBe('100.00');
    expect(montos.igv.toFixed(2)).toBe('0.00');
    expect(montos.total.toFixed(2)).toBe('0.00');
  });

  it('usa HALF_UP en el redondeo', () => {
    const montos = calcularMontos(0.05, new Prisma.Decimal(0));
    expect(montos.igv.toFixed(2)).toBe('0.01');
    expect(montos.total.toFixed(2)).toBe('0.06');
  });
});
