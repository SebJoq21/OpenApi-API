import { IsEnum, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum OrigenDelivery {
  LLEVAR = 'LLEVAR',
  DELIVERY = 'DELIVERY',
}

export class CrearOrdenDeliveryDto {
  @IsUUID()
  sucursal_id: string;

  @IsEnum(OrigenDelivery)
  origen: OrigenDelivery;

  @IsOptional()
  @IsUUID()
  cliente_id?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subtotal: number;

  @IsOptional()
  @IsUUID()
  cupon_id?: string;

  @IsOptional()
  @IsUUID()
  lista_precio_id?: string;
}
