/**
 * node-error-kit
 * A lightweight error handling toolkit for Node.js applications
 */

// Custom error types
export class AppError extends Error {
  public code: string;
  public statusCode: number;
  public isOperational: boolean;
  public details?: Record<string, any>;

  constructor(message: string, options: {
    code?: string;
    statusCode?: number;
    isOperational?: boolean;
    details?: Record<string, any>;
    cause?: Error;
  } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code || 'INTERNAL_ERROR';
    this.statusCode = options.statusCode || 500;
    this.isOperational = options.isOperational !== false;
    this.details = options.details;
    (this as any).cause = options.cause;
    Error.captureStackTrace(this, this.constructor);
  }}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>, cause?: Error) {
    super(message, {
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      isOperational: true,
      details,
      cause
    });
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: Record<string, any>, cause?: Error) {
    super(message, {
      code: 'NOT_FOUND',
      statusCode: 404,
      isOperational: true,
      details,
      cause
    });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string, details?: Record<string, any>, cause?: Error) {
    super(message, {
      code: 'UNAUTHORIZED',
      statusCode: 401,
      isOperational: true,
      details,
      cause
    });
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string, details?: Record<string, any>, cause?: Error) {
    super(message, {
      code: 'FORBIDDEN',
      statusCode: 403,
      isOperational: true,
      details,
      cause
    });
  }
}

// Error handling utilities
export type Result<T, E = Error> = 
  | { success: true; value: T; error?: never }
  | { success: false; error: E; value?: never };

/**
 * Safely executes a promise and returns a Result object
 */
export async function tryCatch<T>(promise: Promise<T>): Promise<Result<T>> {
  try {
    const value = await promise;
    return { success: true, value };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

/**
 * Safely executes a synchronous function and returns a Result object
 */
export function tryCatchSync<T>(fn: () => T): Result<T> {
  try {
    const value = fn();
    return { success: true, value };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

/**
 * Wraps an async function to automatically handle errors
 */
export function withErrorHandling<T, Args extends any[]>(
  fn: (...args: Args) => Promise<T>,
  errorHandler: (error: Error) => void
): (...args: Args) => Promise<T | undefined> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (error) {
      errorHandler(error as Error);
      return undefined;
    }
  };
}

/**
 * Retries a function multiple times before giving up
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    attempts?: number;
    delay?: number;
    backoff?: boolean;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const attempts = options.attempts || 3;
  const delay = options.delay || 1000;
  const backoff = options.backoff !== false;
  const onRetry = options.onRetry;

  let lastError: Error;
  
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < attempts) {
        const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay;
        
        if (onRetry) {
          onRetry(attempt, lastError);
        }
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError!;
}

/**
 * Creates a rate-limited version of a function
 */
export function rateLimit<T, Args extends any[]>(
  fn: (...args: Args) => Promise<T>,
  options: {
    maxCalls: number;
    perInterval: number;
  }
): (...args: Args) => Promise<T> {
  const queue: Array<{
    args: Args;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
  }> = [];
  
  let callsMade = 0;
  let interval: NodeJS.Timeout | null = null;
  
  const processQueue = async () => {
    if (queue.length === 0 || callsMade >= options.maxCalls) {
      return;
    }
    
    const { args, resolve, reject } = queue.shift()!;
    callsMade++;
    
    try {
      const result = await fn(...args);
      resolve(result);
    } catch (error) {
      reject(error as Error);
    }
    
    if (queue.length > 0) {
      processQueue();
    }
  };
  
  const resetCalls = () => {
    callsMade = 0;
    processQueue();
  };
  
  return async (...args: Args): Promise<T> => {
    return new Promise((resolve, reject) => {
      queue.push({ args, resolve, reject });
      
      if (interval === null) {
        interval = setInterval(resetCalls, options.perInterval);
      }
      
      processQueue();
    });
  };
}

/**
 * Safely awaits a promise and returns [error, result] tuple
 */
export async function safe<T>(promise: Promise<T>): Promise<[Error | null, T | null]> {
  try {
    const result = await promise;
    return [null, result];
  } catch (error) {
    return [error as Error, null];
  }
}

/**
 * Creates a cancellable promise
 */
export function withCancel<T>(promise: Promise<T>): { 
  promise: Promise<T>; 
  cancel: () => void 
} {
  let isCancelled = false;
  
  const wrappedPromise = new Promise<T>((resolve, reject) => {
    promise.then(
      value => isCancelled ? reject(new AppError('Operation cancelled', { code: 'CANCELLED' })) : resolve(value),
      error => reject(error)
    );
  });
  
  return {
    promise: wrappedPromise,
    cancel: () => { isCancelled = true; }
  };
}

/**
 * Processes items in batches
 */
export async function batch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    size?: number;
    delay?: number;
    concurrency?: number;
  } = {}
): Promise<R[]> {
  const size = options.size || 10;
  const delay = options.delay || 0;
  const concurrency = options.concurrency || size;
  
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    const batchResults = await Promise.all(
      batch.map(item => processor(item))
    );
    
    results.push(...batchResults);
    
    if (delay > 0 && i + size < items.length) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return results;
}

/**
 * Creates a timeout for a promise
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = 'Operation timed out'
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const error = new AppError(message, {
        code: 'TIMEOUT',
        statusCode: 408,
        isOperational: true
      });
      reject(error);
    }, ms);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeoutId));
  });
}

/**
 * Formats an error for logging or response
 */
export function formatError(error: Error): Record<string, any> {
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details || {},
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
  }
  
  return {
    message: error.message || 'Unknown error occurred',
    code: 'INTERNAL_ERROR',
    statusCode: 500,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  };
}

/**
 * Global error handler for uncaught exceptions and unhandled rejections
 */
export function setupGlobalErrorHandlers(
  handler: (error: Error, type: 'uncaughtException' | 'unhandledRejection') => void
): void {
  process.on('uncaughtException', (error) => {
    handler(error, 'uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    handler(reason instanceof Error ? reason : new Error(String(reason)), 'unhandledRejection');
  });
}
