import { AppError } from '../utils/errors.js';

export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    const body = { error: err.code, message: err.message };
    if (err.details) body.details = err.details;
    return res.status(err.status).json(body);
  }
  // Mongo duplicate key
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0];
    const message =
      field === 'phone'
        ? 'This phone number is already registered to another account. Please use a different number.'
        : field === 'email'
          ? 'An account with this email already exists.'
          : 'Resource already exists';
    return res.status(409).json({ error: 'CONFLICT', message });
  }
  console.error(err);
  res.status(500).json({ error: 'INTERNAL', message: 'Something went wrong' });
}