import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CrearOrdenSalonDto } from './dto/crear-orden-salon.dto';
import { CrearOrdenDeliveryDto } from './dto/crear-orden-delivery.dto';
import { ListarOrdenesQuery } from './dto/listar-ordenes.query';
import { ListarAlertasQuery } from './dto/listar-alertas.query';
import { ActualizarEstadoDto } from './dto/actualizar-estado.dto';
import { OrdenesService } from './ordenes.service';

@Controller('ordenes')
export class OrdenesController {
  constructor(private readonly ordenesService: OrdenesService) {}

  @Post('salon')
  async crearSalon(
    @CurrentTenant() empresaId: string,
    @Body() dto: CrearOrdenSalonDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const orden = await this.ordenesService.crearSalon(empresaId, dto);
    response.setHeader('Location', `/api/v1/ordenes/${orden.id}`);
    return orden;
  }

  @Post('delivery')
  async crearDelivery(
    @CurrentTenant() empresaId: string,
    @Body() dto: CrearOrdenDeliveryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const orden = await this.ordenesService.crearDelivery(empresaId, dto);
    response.setHeader('Location', `/api/v1/ordenes/${orden.id}`);
    return orden;
  }

  @Get()
  listar(
    @CurrentTenant() empresaId: string,
    @Query() query: ListarOrdenesQuery,
  ) {
    return this.ordenesService.listar(empresaId, query);
  }

  @Get('alertas')
  listarAlertas(
    @CurrentTenant() empresaId: string,
    @Query() query: ListarAlertasQuery,
  ) {
    return this.ordenesService.listarAlertas(empresaId, query);
  }

  @Get(':id')
  obtener(@CurrentTenant() empresaId: string, @Param('id') id: string) {
    return this.ordenesService.obtener(empresaId, id);
  }

  @Patch(':id/estado')
  actualizarEstado(
    @CurrentTenant() empresaId: string,
    @Param('id') id: string,
    @Body() dto: ActualizarEstadoDto,
  ) {
    return this.ordenesService.actualizarEstado(empresaId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async anular(
    @CurrentTenant() empresaId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.ordenesService.anular(empresaId, id);
  }
}
