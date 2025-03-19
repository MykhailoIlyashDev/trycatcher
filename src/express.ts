/**
 * Express middleware integration
 */
import { Request, Response, NextFunction } from 'express';
import { AppError, formatError } from './index';

/**
 * Express error handling middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const formattedError = formatError(err);
  
  res.status(formattedError.statusCode || 500).json({
    error: {
      message: formattedError.message,
      code: formattedError.code,
      ...(formattedError.details && { details: formattedError.details }),
      ...(formattedError.stack && { stack: formattedError.stack })
    }
  });
}

/**
 * Async handler for Express routes
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
