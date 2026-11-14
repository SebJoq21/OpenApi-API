import { EstadoOrden } from '@prisma/client';

const SIGUIENTE: Record<EstadoOrden, EstadoOrden | null> = {
  PENDIENTE: EstadoOrden.CONFIRMADO,
  CONFIRMADO: EstadoOrden.PREPARANDO,
  PREPARANDO: EstadoOrden.LISTO,
  LISTO: EstadoOrden.ENTREGADO,
  ENTREGADO: null,
  ANULADO: null,
};

export const ESTADOS_ACTIVOS: EstadoOrden[] = [
  EstadoOrden.PENDIENTE,
  EstadoOrden.CONFIRMADO,
  EstadoOrden.PREPARANDO,
  EstadoOrden.LISTO,
];

export function siguienteEstado(actual: EstadoOrden): EstadoOrden | null {
  return SIGUIENTE[actual];
}

export function esTransicionValida(actual: EstadoOrden, siguiente: EstadoOrden): boolean {
  return SIGUIENTE[actual] === siguiente;
}

export function timestampParaEstado(
  estado: EstadoOrden,
): 'confirmacionAt' | 'listoAt' | 'entregaAt' | null {
  switch (estado) {
    case EstadoOrden.CONFIRMADO:
      return 'confirmacionAt';
    case EstadoOrden.LISTO:
      return 'listoAt';
    case EstadoOrden.ENTREGADO:
      return 'entregaAt';
    default:
      return null;
  }
}
