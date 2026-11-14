import { IsEnum } from 'class-validator';

export enum EstadoAvance {
  CONFIRMADO = 'CONFIRMADO',
  PREPARANDO = 'PREPARANDO',
  LISTO = 'LISTO',
  ENTREGADO = 'ENTREGADO',
}

export class ActualizarEstadoDto {
  @IsEnum(EstadoAvance)
  estado: EstadoAvance;
}
