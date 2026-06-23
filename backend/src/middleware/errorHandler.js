import { AppError } from '../utils/errors.js';

export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.code, message: err.message });
  }
  // Mongo duplicate key
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'CONFLICT', message: 'Resource already exists' });
  }
  console.error(err);
  res.status(500).json({ error: 'INTERNAL', message: 'Something went wrong' });
}