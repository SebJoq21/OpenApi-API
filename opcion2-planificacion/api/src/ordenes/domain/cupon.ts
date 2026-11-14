import { Prisma, TipoCupon } from '@prisma/client';
import { round2 } from '../../common/money/money';

export interface CuponAplicable {
  tipo: TipoCupon;
  valor: Prisma.Decimal;
}

export function calcularDescuento(
  subtotal: Prisma.Decimal,
  cupon: CuponAplicable,
): Prisma.Decimal {
  const valor = new Prisma.Decimal(cupon.valor);
  let descuento =
    cupon.tipo === TipoCupon.PORCENTAJE
      ? subtotal.mul(valor).div(100)
      : valor;

  if (descuento.lessThan(0)) {
    descuento = new Prisma.Decimal(0);
  }
  if (descuento.greaterThan(subtotal)) {
    descuento = subtotal;
  }

  return round2(descuento);
}
