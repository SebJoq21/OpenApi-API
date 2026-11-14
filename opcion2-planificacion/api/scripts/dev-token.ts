import * as dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

const DEFAULT_EMPRESA = '11111111-1111-4111-8111-111111111111';
const empresaId = process.argv[2] ?? process.env.DEMO_EMPRESA_ID ?? DEFAULT_EMPRESA;
const secret = process.env.JWT_SECRET ?? 'dev-secret-change-me';

const token = jwt.sign(
  {
    sub: 'demo-user',
    empresa_id: empresaId,
  },
  secret,
  { expiresIn: '12h' },
);

// eslint-disable-next-line no-console
console.log(`Empresa: ${empresaId}`);
// eslint-disable-next-line no-console
console.log(`Token: ${token}`);
