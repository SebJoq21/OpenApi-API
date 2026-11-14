import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ProblemDetailsException } from '../common/errors/problem-details.exception';

interface JwtPayload {
  sub?: string;
  empresa_id?: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: { empresaId: string; sub?: string };
    }>();

    const authorization = request.headers.authorization;
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new ProblemDetailsException(401, 'Token ausente o inválido');
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(authorization.slice(7));
      if (!payload.empresa_id) {
        throw new Error('Token sin empresa_id');
      }
      request.user = {
        empresaId: payload.empresa_id,
        sub: payload.sub,
      };
      return true;
    } catch {
      throw new ProblemDetailsException(401, 'Token ausente o inválido');
    }
  }
}
