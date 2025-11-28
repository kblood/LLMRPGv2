/**
 * Retry helper for LLM calls with exponential backoff
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelay?: number;
  /** Function to determine if error is retryable (default: all errors are retryable) */
  isRetryable?: (error: any) => boolean;
}

const defaultOptions: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  backoffMultiplier: 2,
  maxDelay: 10000,
  isRetryable: () => true
};

/**
 * Retry a function with exponential backoff
 * @param fn The async function to retry
 * @param options Retry configuration options
 * @returns The result of the function
 * @throws The last error if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...defaultOptions, ...options };
  let lastError: any;
  let delay = config.initialDelay;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt === config.maxRetries || !config.isRetryable(error)) {
        throw error;
      }

      // Log retry attempt
      console.warn(`LLM call failed (attempt ${attempt + 1}/${config.maxRetries + 1}), retrying in ${delay}ms...`, error);

      // Wait before retrying
      await sleep(delay);

      // Increase delay for next attempt (exponential backoff)
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
    }
  }

  throw lastError;
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Common retry configuration for different types of LLM calls
 */
export const RetryPresets = {
  /** Fast retries for quick calls (e.g., intent classification) */
  fast: {
    maxRetries: 2,
    initialDelay: 500,
    backoffMultiplier: 2,
    maxDelay: 2000
  } as RetryOptions,

  /** Standard retries for normal LLM calls */
  standard: {
    maxRetries: 3,
    initialDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 5000
  } as RetryOptions,

  /** Patient retries for expensive calls (e.g., content generation) */
  patient: {
    maxRetries: 4,
    initialDelay: 2000,
    backoffMultiplier: 2,
    maxDelay: 10000
  } as RetryOptions
};
