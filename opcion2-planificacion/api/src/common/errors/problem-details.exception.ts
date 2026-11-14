import { HttpException } from '@nestjs/common';

export class ProblemDetailsException extends HttpException {
  constructor(status: number, public readonly detail: string) {
    super({ status, detail }, status);
  }
}
