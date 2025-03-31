/**
 * Simple utility functions for estimating token counts
 */

/**
 * Estimate token count of a text string
 * Simple approximation based on GPT tokenization patterns
 * @param text Text to estimate token count for
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
  // Simple approximation: average 4 chars per token for English text
  return Math.ceil(text.length / 4);
}

/**
 * Simple utility to estimate token count of text
 * Uses an approximate ratio of 4 characters per token for English text
 */
export function calculateTokens(text: string): number {
  // Simple approximation: ~4 characters per token for English
  // For a more accurate count, libraries like GPT-3-Encoder should be used
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to fit within a token limit
 * @param text Text to truncate
 * @param maxTokens Maximum number of tokens allowed
 * @returns Truncated text
 */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const currentTokens = calculateTokens(text);

  if (currentTokens <= maxTokens) {
    return text;
  }

  // Simple truncation: estimate character count and add ellipsis
  const approxCharLimit = maxTokens * 4;
  return text.substring(0, approxCharLimit - 3) + '...';
}

/**
 * Check if a message array exceeds token limit
 * @param messages Array of text messages
 * @param maxTokens Maximum token limit
 * @returns Whether the token limit is exceeded
 */
export function exceedsTokenLimit(messages: string[], maxTokens: number): boolean {
  const totalTokens = calculateTokens(messages.join(' '));
  return totalTokens > maxTokens;
}
