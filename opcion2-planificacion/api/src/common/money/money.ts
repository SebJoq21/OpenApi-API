import { Prisma } from '@prisma/client';

export const IGV_RATE = new Prisma.Decimal('0.18');

export function round2(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function calcularMontos(
  subtotalInput: number,
  descuentoInput: Prisma.Decimal,
): {
  subtotal: Prisma.Decimal;
  descuento: Prisma.Decimal;
  igv: Prisma.Decimal;
  total: Prisma.Decimal;
} {
  const subtotal = round2(new Prisma.Decimal(subtotalInput));
  const descuento = round2(
    descuentoInput.lessThan(0)
      ? new Prisma.Decimal(0)
      : descuentoInput.greaterThan(subtotal)
        ? subtotal
        : descuentoInput,
  );
  const base = subtotal.minus(descuento);
  const igv = round2(base.mul(IGV_RATE));
  const total = round2(base.plus(igv));

  return { subtotal, descuento, igv, total };
}
