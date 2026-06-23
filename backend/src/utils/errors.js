export class AppError extends Error {
  constructor(message, status = 400, code = 'BAD_REQUEST') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const Unauthorized = (msg = 'Unauthorized')      => new AppError(msg, 401, 'UNAUTHORIZED');
export const Forbidden    = (msg = 'Forbidden')         => new AppError(msg, 403, 'FORBIDDEN');
export const NotFound     = (msg = 'Not found')         => new AppError(msg, 404, 'NOT_FOUND');
export const Conflict     = (msg = 'Conflict')          => new AppError(msg, 409, 'CONFLICT');
export const TooMany      = (msg = 'Too many requests') => new AppError(msg, 429, 'TOO_MANY');