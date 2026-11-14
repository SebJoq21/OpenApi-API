import { Injectable } from '@nestjs/common';
import { EstadoOrden, OrigenOrden, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProblemDetailsException } from '../common/errors/problem-details.exception';
import { calcularDescuento } from './domain/cupon';
import { calcularMontos } from '../common/money/money';
import { formatNumeroOrden, getBusinessYear } from './domain/numero-orden';
import {
  esTransicionValida,
  timestampParaEstado,
} from './domain/estado-machine';
import { isUuid } from '../common/utils/uuid';
import { CrearOrdenSalonDto } from './dto/crear-orden-salon.dto';
import { CrearOrdenDeliveryDto, OrigenDelivery } from './dto/crear-orden-delivery.dto';
import { ListarOrdenesQuery } from './dto/listar-ordenes.query';
import { ListarAlertasQuery } from './dto/listar-alertas.query';
import { ActualizarEstadoDto } from './dto/actualizar-estado.dto';
import { toOrdenResponse } from './ordenes.mapper';

interface CreacionBase {
  sucursal_id: string;
  cliente_id?: string;
  subtotal: number;
  cupon_id?: string;
  lista_precio_id?: string;
}

interface ListaResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

@Injectable()
export class OrdenesService {
  constructor(private readonly prisma: PrismaService) {}

  async crearSalon(
    empresaId: string,
    dto: CrearOrdenSalonDto,
  ): Promise<ReturnType<typeof toOrdenResponse>> {
    return this.crearOrden(
      empresaId,
      OrigenOrden.SALON,
      dto,
      dto.mesa_id,
      dto.mesero_id,
    );
  }

  async crearDelivery(
    empresaId: string,
    dto: CrearOrdenDeliveryDto,
  ): Promise<ReturnType<typeof toOrdenResponse>> {
    if (dto.origen === OrigenDelivery.DELIVERY && !dto.cliente_id) {
      throw new ProblemDetailsException(400, 'Cliente obligatorio para DELIVERY');
    }

    return this.crearOrden(
      empresaId,
      dto.origen as unknown as OrigenOrden,
      dto,
      null,
      null,
    );
  }

  private async crearOrden(
    empresaId: string,
    origen: OrigenOrden,
    dto: CreacionBase,
    mesaId: string | null,
    meseroId: string | null,
  ): Promise<ReturnType<typeof toOrdenResponse>> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const orden = await this.prisma.$transaction(async (tx) =>
          this.crearEnTransaccion(
            tx,
            empresaId,
            origen,
            dto,
            mesaId,
            meseroId,
          ),
        );
        return toOrdenResponse(orden);
      } catch (error) {
        const esColision =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002';
        if (esColision && attempt < 2) {
          continue;
        }
        if (esColision) {
          throw new ProblemDetailsException(
            409,
            'No se pudo generar un número de orden único',
          );
        }
        throw error;
      }
    }

    throw new ProblemDetailsException(
      409,
      'No se pudo generar un número de orden único',
    );
  }

  private async crearEnTransaccion(
    tx: Prisma.TransactionClient,
    empresaId: string,
    origen: OrigenOrden,
    dto: CreacionBase,
    mesaId: string | null,
    meseroId: string | null,
  ) {
    const sucursal = await tx.sucursal.findFirst({
      where: { id: dto.sucursal_id, empresaId },
    });
    if (!sucursal) {
      throw new ProblemDetailsException(400, 'Sucursal no válida para la empresa');
    }

    if (mesaId) {
      const mesa = await tx.mesa.findFirst({
        where: { id: mesaId, sucursalId: sucursal.id },
      });
      if (!mesa) {
        throw new ProblemDetailsException(400, 'Mesa no válida para la sucursal');
      }
    }

    if (meseroId) {
      const mesero = await tx.usuario.findFirst({
        where: { id: meseroId, empresaId },
      });
      if (!mesero) {
        throw new ProblemDetailsException(400, 'Mesero no válido para la empresa');
      }
    }

    if (dto.cliente_id) {
      const cliente = await tx.cliente.findFirst({
        where: { id: dto.cliente_id, empresaId },
      });
      if (!cliente) {
        throw new ProblemDetailsException(400, 'Cliente no válido para la empresa');
      }
    }

    if (dto.lista_precio_id) {
      const lista = await tx.listaPrecio.findFirst({
        where: { id: dto.lista_precio_id, empresaId },
      });
      if (!lista) {
        throw new ProblemDetailsException(
          400,
          'Lista de precio no válida para la empresa',
        );
      }
    }

    const subtotal = new Prisma.Decimal(dto.subtotal);
    let descuento = new Prisma.Decimal(0);

    if (dto.cupon_id) {
      const now = new Date();
      const cupon = await tx.cupon.findFirst({
        where: {
          id: dto.cupon_id,
          empresaId,
          activo: true,
          vigenteDesde: { lte: now },
          vigenteHasta: { gte: now },
        },
      });
      if (!cupon) {
        throw new ProblemDetailsException(400, 'Cupón inválido o vencido');
      }
      descuento = calcularDescuento(subtotal, cupon);
    }

    const montos = calcularMontos(dto.subtotal, descuento);
    const year = getBusinessYear();
    const ultimo = await this.siguienteNumero(tx, sucursal.id, year);
    const numeroOrden = formatNumeroOrden(year, ultimo);

    return tx.orden.create({
      data: {
        empresaId,
        sucursalId: sucursal.id,
        numeroOrden,
        mesaId,
        clienteId: dto.cliente_id ?? null,
        meseroId,
        origen,
        estado: EstadoOrden.PENDIENTE,
        subtotal: montos.subtotal,
        descuentoCupon: montos.descuento,
        igv: montos.igv,
        total: montos.total,
        listaPrecioId: dto.lista_precio_id ?? null,
        cuponId: dto.cupon_id ?? null,
        slaMinutos: sucursal.slaMinutos,
      },
    });
  }

  private async siguienteNumero(
    tx: Prisma.TransactionClient,
    sucursalId: string,
    year: number,
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ ultimo: number }>>(
      Prisma.sql`
        INSERT INTO orden_secuencias (sucursal_id, anio, ultimo)
        VALUES (${sucursalId}::uuid, ${year}, 1)
        ON CONFLICT (sucursal_id, anio)
        DO UPDATE SET ultimo = orden_secuencias.ultimo + 1
        RETURNING ultimo
      `,
    );

    return Number(rows[0]?.ultimo ?? 1);
  }

  async listar(
    empresaId: string,
    query: ListarOrdenesQuery,
  ): Promise<ListaResponse<ReturnType<typeof toOrdenResponse>>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const desde = query.desde ? new Date(query.desde) : undefined;
    const hasta = query.hasta ? new Date(query.hasta) : undefined;

    if (desde && hasta && desde.getTime() > hasta.getTime()) {
      throw new ProblemDetailsException(400, 'desde no puede ser mayor que hasta');
    }

    const where: Prisma.OrdenWhereInput = { empresaId };
    if (query.estado) where.estado = query.estado;
    if (query.origen) where.origen = query.origen;
    if (query.sucursal_id) where.sucursalId = query.sucursal_id;
    if (query.mesa_id) where.mesaId = query.mesa_id;
    if (desde || hasta) {
      where.ingresoAt = {
        ...(desde ? { gte: desde } : {}),
        ...(hasta ? { lte: hasta } : {}),
      };
    }

    const [total, ordenes] = await this.prisma.$transaction([
      this.prisma.orden.count({ where }),
      this.prisma.orden.findMany({
        where,
        orderBy: [{ ingresoAt: Prisma.SortOrder.desc }, { id: Prisma.SortOrder.desc }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: ordenes.map((orden) => toOrdenResponse(orden)),
      meta: {
        page,
        limit,
        total,
        total_pages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async listarAlertas(
    empresaId: string,
    query: ListarAlertasQuery,
  ): Promise<ListaResponse<ReturnType<typeof toOrdenResponse>>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const conditions: Prisma.Sql[] = [
      Prisma.sql`empresa_id = ${empresaId}::uuid`,
      Prisma.sql`estado IN ('PENDIENTE', 'CONFIRMADO', 'PREPARANDO', 'LISTO')`,
      Prisma.sql`ingreso_at < now() - (sla_minutos * interval '1 minute')`,
    ];
    if (query.sucursal_id) {
      conditions.push(Prisma.sql`sucursal_id = ${query.sucursal_id}::uuid`);
    }

    const where = Prisma.join(conditions, ' AND ');
    const totalRows = await this.prisma.$queryRaw<Array<{ total: number }>>(
      Prisma.sql`SELECT COUNT(*)::int AS total FROM ordenes WHERE ${where}`,
    );
    const total = Number(totalRows[0]?.total ?? 0);

    const idRows = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT id
        FROM ordenes
        WHERE ${where}
        ORDER BY ingreso_at DESC, id DESC
        LIMIT ${limit} OFFSET ${(page - 1) * limit}
      `,
    );

    const ids = idRows.map((row) => row.id);
    const ordenes =
      ids.length === 0
        ? []
        : await this.prisma.orden.findMany({
            where: { id: { in: ids }, empresaId },
          });

    const byId = new Map(ordenes.map((orden) => [orden.id, orden]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((orden): orden is NonNullable<typeof orden> => Boolean(orden));

    return {
      data: ordered.map((orden) => toOrdenResponse(orden)),
      meta: {
        page,
        limit,
        total,
        total_pages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async obtener(
    empresaId: string,
    id: string,
  ): Promise<ReturnType<typeof toOrdenResponse>> {
    if (!isUuid(id)) {
      throw new ProblemDetailsException(404, 'Orden no encontrada');
    }
    const orden = await this.prisma.orden.findFirst({
      where: { id, empresaId },
    });
    if (!orden) {
      throw new ProblemDetailsException(404, 'Orden no encontrada');
    }
    return toOrdenResponse(orden);
  }

  async actualizarEstado(
    empresaId: string,
    id: string,
    dto: ActualizarEstadoDto,
  ): Promise<ReturnType<typeof toOrdenResponse>> {
    if (!isUuid(id)) {
      throw new ProblemDetailsException(400, 'id debe ser un UUID válido');
    }

    const actual = await this.prisma.orden.findFirst({
      where: { id, empresaId },
    });
    if (!actual) {
      throw new ProblemDetailsException(404, 'Orden no encontrada');
    }

    const siguiente = dto.estado as unknown as EstadoOrden;
    if (!esTransicionValida(actual.estado, siguiente)) {
      throw new ProblemDetailsException(
        409,
        `Transición de estado inválida de ${actual.estado} a ${dto.estado}`,
      );
    }

    const data: Prisma.OrdenUpdateManyMutationInput = { estado: siguiente };
    const field = timestampParaEstado(siguiente);
    if (field === 'confirmacionAt') data.confirmacionAt = new Date();
    if (field === 'listoAt') data.listoAt = new Date();
    if (field === 'entregaAt') data.entregaAt = new Date();

    const result = await this.prisma.orden.updateMany({
      where: { id, empresaId, estado: actual.estado },
      data,
    });

    if (result.count === 0) {
      const refreshed = await this.prisma.orden.findFirst({
        where: { id, empresaId },
      });
      if (!refreshed) {
        throw new ProblemDetailsException(404, 'Orden no encontrada');
      }
      throw new ProblemDetailsException(
        409,
        `Transición de estado inválida de ${refreshed.estado} a ${dto.estado}`,
      );
    }

    return this.obtener(empresaId, id);
  }

  async anular(empresaId: string, id: string): Promise<void> {
    if (!isUuid(id)) {
      throw new ProblemDetailsException(404, 'Orden no encontrada');
    }

    const actual = await this.prisma.orden.findFirst({
      where: { id, empresaId },
    });
    if (!actual) {
      throw new ProblemDetailsException(404, 'Orden no encontrada');
    }
    if (actual.estado === EstadoOrden.ENTREGADO || actual.estado === EstadoOrden.ANULADO) {
      throw new ProblemDetailsException(
        409,
        `No se puede anular una orden en estado ${actual.estado}`,
      );
    }

    const result = await this.prisma.orden.updateMany({
      where: {
        id,
        empresaId,
        estado: { notIn: [EstadoOrden.ENTREGADO, EstadoOrden.ANULADO] },
      },
      data: { estado: EstadoOrden.ANULADO },
    });

    if (result.count === 0) {
      const refreshed = await this.prisma.orden.findFirst({
        where: { id, empresaId },
      });
      if (!refreshed) {
        throw new ProblemDetailsException(404, 'Orden no encontrada');
      }
      throw new ProblemDetailsException(
        409,
        `No se puede anular una orden en estado ${refreshed.estado}`,
      );
    }
  }
}
