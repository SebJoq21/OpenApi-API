import { Orden } from '@prisma/client';
import { calcularAlertaSla } from './domain/sla';

export interface OrdenResponse {
  id: string;
  empresa_id: string;
  sucursal_id: string;
  numero_orden: string;
  mesa_id: string | null;
  cliente_id: string | null;
  mesero_id: string | null;
  origen: string;
  estado: string;
  subtotal: number;
  descuento_cupon: number;
  igv: number;
  total: number;
  lista_precio_id: string | null;
  cupon_id: string | null;
  ingreso_at: string;
  confirmacion_at: string | null;
  listo_at: string | null;
  entrega_at: string | null;
  alerta_sla: boolean;
  created_at: string;
  updated_at: string;
}

export function toOrdenResponse(orden: Orden, now: Date = new Date()): OrdenResponse {
  return {
    id: orden.id,
    empresa_id: orden.empresaId,
    sucursal_id: orden.sucursalId,
    numero_orden: orden.numeroOrden,
    mesa_id: orden.mesaId,
    cliente_id: orden.clienteId,
    mesero_id: orden.meseroId,
    origen: orden.origen,
    estado: orden.estado,
    subtotal: Number(orden.subtotal.toFixed(2)),
    descuento_cupon: Number(orden.descuentoCupon.toFixed(2)),
    igv: Number(orden.igv.toFixed(2)),
    total: Number(orden.total.toFixed(2)),
    lista_precio_id: orden.listaPrecioId,
    cupon_id: orden.cuponId,
    ingreso_at: orden.ingresoAt.toISOString(),
    confirmacion_at: orden.confirmacionAt ? orden.confirmacionAt.toISOString() : null,
    listo_at: orden.listoAt ? orden.listoAt.toISOString() : null,
    entrega_at: orden.entregaAt ? orden.entregaAt.toISOString() : null,
    alerta_sla: calcularAlertaSla(orden.estado, orden.ingresoAt, orden.slaMinutos, now),
    created_at: orden.createdAt.toISOString(),
    updated_at: orden.updatedAt.toISOString(),
  };
}
