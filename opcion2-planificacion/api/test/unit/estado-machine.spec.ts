import { EstadoOrden } from '@prisma/client';
import {
  esTransicionValida,
  siguienteEstado,
  timestampParaEstado,
} from '../../src/ordenes/domain/estado-machine';

describe('máquina de estados', () => {
  it('permite solo el siguiente estado', () => {
    expect(esTransicionValida(EstadoOrden.PENDIENTE, EstadoOrden.CONFIRMADO)).toBe(true);
    expect(esTransicionValida(EstadoOrden.CONFIRMADO, EstadoOrden.PREPARANDO)).toBe(true);
    expect(esTransicionValida(EstadoOrden.PREPARANDO, EstadoOrden.LISTO)).toBe(true);
    expect(esTransicionValida(EstadoOrden.LISTO, EstadoOrden.ENTREGADO)).toBe(true);
  });

  it('rechaza saltos, retrocesos y mismos estados', () => {
    expect(esTransicionValida(EstadoOrden.PENDIENTE, EstadoOrden.LISTO)).toBe(false);
    expect(esTransicionValida(EstadoOrden.CONFIRMADO, EstadoOrden.PENDIENTE)).toBe(false);
    expect(esTransicionValida(EstadoOrden.PENDIENTE, EstadoOrden.PENDIENTE)).toBe(false);
    expect(esTransicionValida(EstadoOrden.ENTREGADO, EstadoOrden.ANULADO)).toBe(false);
  });

  it('identifica el siguiente estado', () => {
    expect(siguienteEstado(EstadoOrden.PENDIENTE)).toBe(EstadoOrden.CONFIRMADO);
    expect(siguienteEstado(EstadoOrden.LISTO)).toBe(EstadoOrden.ENTREGADO);
    expect(siguienteEstado(EstadoOrden.ENTREGADO)).toBeNull();
    expect(siguienteEstado(EstadoOrden.ANULADO)).toBeNull();
  });

  it('asigna el timestamp correcto', () => {
    expect(timestampParaEstado(EstadoOrden.CONFIRMADO)).toBe('confirmacionAt');
    expect(timestampParaEstado(EstadoOrden.LISTO)).toBe('listoAt');
    expect(timestampParaEstado(EstadoOrden.ENTREGADO)).toBe('entregaAt');
    expect(timestampParaEstado(EstadoOrden.PREPARANDO)).toBeNull();
  });
});
