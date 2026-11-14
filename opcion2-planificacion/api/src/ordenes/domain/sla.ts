import { EstadoOrden } from '@prisma/client';

export function calcularAlertaSla(
  estado: EstadoOrden,
  ingresoAt: Date,
  slaMinutos: number,
  now: Date = new Date(),
): boolean {
  if (estado === EstadoOrden.ENTREGADO || estado === EstadoOrden.ANULADO) {
    return false;
  }
  return now.getTime() > ingresoAt.getTime() + slaMinutos * 60_000;
}
