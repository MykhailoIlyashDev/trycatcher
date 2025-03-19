# trycatcher
TryCatcher is a lightweight TypeScript library that simplifies error handling in Node.js with custom error classes, safe promise handling, and Express integration.

## Features

- Custom error classes with status codes and error details
- Result type for safe error handling
- Utility functions for common error handling patterns
- Express middleware integration
- Timeout handling
- Retry mechanism
- Global error handlers

## Installation

```bash
npm install trycatcher
```

## Usage

### Custom Error Classes

```typescript
import { AppError, NotFoundError, ValidationError } from 'trycatcher';

// Create a custom error
throw new NotFoundError('User not found', { userId: 123 });

// Create a custom application error
throw new AppError('Something went wrong', {
  code: 'PAYMENT_FAILED',
  statusCode: 402,
  details: { orderId: '12345' }
});
```

### Safe Error Handling with Result Type

```typescript
import { tryCatch } from 'trycatcher';

async function getUserData(userId: string) {
  const result = await tryCatch(fetchUserFromDatabase(userId));
  
  if (result.success) {
    return result.value;
  } else {
    console.error('Failed to fetch user:', result.error);
    return null;
  }
}
```

### Retry Mechanism

```typescript
import { retry } from 'trycatcher';

const data = await retry(
  () => fetchFromUnreliableAPI(),
  {
    attempts: 5,
    delay: 1000,
    backoff: true,
    onRetry: (attempt, error) => console.log(`Retry ${attempt} after error: ${error.message}`)
  }
);
```

### Timeout Handling

```typescript
import { withTimeout } from 'trycatcher';

try {
  const result = await withTimeout(
    fetchLargeDataset(),
    5000, // 5 seconds timeout
    'Data fetch timed out'
  );
} catch (error) {
  console.log('Operation took too long');
}
```

### Express Integration

```typescript
import express from 'express';
import { errorHandler, asyncHandler } from 'trycatcher/express';
import { NotFoundError } from 'trycatcher';

const app = express();

app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await getUserById(req.params.id);
  
  if (!user) {
    throw new NotFoundError('User not found', { userId: req.params.id });
  }
  
  res.json(user);
}));

// Error handling middleware (should be last)
app.use(errorHandler);
```

### Global Error Handlers

```typescript
import { setupGlobalErrorHandlers } from 'trycatcher';

setupGlobalErrorHandlers((error, type) => {
  console.error(`Uncaught ${type}:`, error);
  // Send to error monitoring service
  // Gracefully shutdown if needed
});
```

## License

MIT

Made with by Michael Ilyash
