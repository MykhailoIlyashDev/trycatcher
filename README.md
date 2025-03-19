# node-trycatcher
TryCatcher is a lightweight TypeScript library that simplifies error handling in Node.js with custom error classes, safe promise handling, and Express integration.

## Features

- Custom error classes with status codes and error details
- Result type for safe error handling
- Utility functions for common error handling patterns
- Express middleware integration
- Timeout handling
- Retry mechanism
- Rate limiting
- Cancellable promises
- Batch processing
- Global error handlers

## Installation

```bash
npm install node-trycatcher
```

## Usage

### Custom Error Classes

```typescript
import { AppError, NotFoundError, ValidationError } from 'node-trycatcher';

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
import { tryCatch } from 'node-trycatcher';

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

### Alternative Safe Error Handling with Tuple

```typescript
import { safe } from 'node-trycatcher';

async function getUserData(userId: string) {
  const [error, data] = await safe(fetchUserFromDatabase(userId));
  
  if (error) {
    console.error('Failed to fetch user:', error);
    return null;
  }
  
  return data;
}
```

### Retry Mechanism

```typescript
import { retry } from 'node-trycatcher';

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
import { withTimeout } from 'node-trycatcher';

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

### Rate Limiting

```typescript
import { rateLimit } from 'node-trycatcher';

// Create a rate-limited version of your API call function
const rateLimitedFetch = rateLimit(fetchFromAPI, {
  maxCalls: 5,
  perInterval: 1000 // 1 second
});

// Use it like the original function
const results = await Promise.all([
  rateLimitedFetch('id1'),
  rateLimitedFetch('id2'),
  rateLimitedFetch('id3'),
  rateLimitedFetch('id4'),
  rateLimitedFetch('id5'),
  rateLimitedFetch('id6'), // This will be queued
  rateLimitedFetch('id7')  // This will be queued
]);
```

### Cancellable Promises

```typescript
import { withCancel } from 'node-trycatcher';

const { promise, cancel } = withCancel(longRunningOperation());

// Cancel the operation after 2 seconds
setTimeout(() => {
  console.log('Cancelling operation...');
  cancel();
}, 2000);

try {
  const result = await promise;
  console.log('Operation completed:', result);
} catch (error) {
  console.log('Operation was cancelled or failed:', error.message);
}
```

### Batch Processing

```typescript
import { batch } from 'node-trycatcher';

const items = ['item1', 'item2', 'item3', 'item4', 'item5', 'item6', 'item7', 'item8', 'item9', 'item10'];

const results = await batch(
  items,
  async (item) => {
    // Process each item
    return await processItem(item);
  },
  {
    size: 3,         // Process 3 items per batch
    delay: 500,      // Wait 500ms between batches
    concurrency: 2   // Allow 2 concurrent operations
  }
);
```

### Express Integration

```typescript
import express from 'express';
import { errorHandler, asyncHandler } from 'node-trycatcher/express';
import { NotFoundError } from 'node-trycatcher';

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
import { setupGlobalErrorHandlers } from 'node-trycatcher';

setupGlobalErrorHandlers((error, type) => {
  console.error(`Uncaught ${type}:`, error);
  // Send to error monitoring service
  // Gracefully shutdown if needed
});
```

## License

MIT

Made with by Michael Ilyash
