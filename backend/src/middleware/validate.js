import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

export const validate = (schema) => (req, _res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      return next(new AppError('Validation failed: ' + err.issues.map(i => i.message).join('; '), 422));
    }
    next(err);
  }
};