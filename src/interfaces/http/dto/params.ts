import { Request } from 'express';

/** Express 5 types route params as `string | string[]` to allow for wildcard segments; our routes never use those, so this narrows back to plain string. */
export function idParam(req: Request, name = 'id'): string {
  const v = req.params[name];
  return Array.isArray(v) ? v[0] : v;
}
