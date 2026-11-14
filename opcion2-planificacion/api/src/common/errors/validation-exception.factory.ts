import { BadRequestException, ValidationError } from '@nestjs/common';

function flatten(errors: ValidationError[]): string[] {
  const messages: string[] = [];

  for (const error of errors) {
    if (error.constraints) {
      messages.push(...Object.values(error.constraints));
    }
    if (error.children && error.children.length > 0) {
      messages.push(...flatten(error.children));
    }
  }

  return messages;
}

export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  const messages = flatten(errors);
  return new BadRequestException(messages.length > 0 ? messages.join('; ') : 'Datos inválidos');
}
