/**
 * Tokenizer utility for estimating token counts in a way that better approximates GPT tokenization
 */

/**
 * Estimate token count of a text string
 * Based on GPT tokenization patterns with improved heuristics
 * @param text Text to estimate token count for
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;

  // Common GPT tokenization patterns
  // Spaces, common punctuation, and common words are often 1 token
  // Words are generally split at subword level based on common patterns

  // Count basic components
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const punctuationCount = (text.match(/[.,!?;:()[\]{}'""-]/g) || []).length;
  const numberCount = (text.match(/\d+/g) || []).length;
  const whitespaceCount = (text.match(/\s+/g) || []).length;

  // Special character handling
  const specialCharCount = (text.match(/[^a-zA-Z0-9\s.,!?;:()[\]{}'""-]/g) || []).length;

  // Count tokens based on character encoding patterns
  const charsPerToken = 3.5; // Slightly more accurate than 4 for most languages
  const charBasedCount = Math.ceil(text.length / charsPerToken);

  // Combine heuristics (weighted)
  const tokenEstimate = Math.ceil(
    0.5 * charBasedCount +
      0.3 * wordCount +
      0.1 * punctuationCount +
      0.05 * specialCharCount +
      0.05 * whitespaceCount +
      0.3 * numberCount
  );

  // Apply corrections for specific patterns
  let adjustment = 0;

  // URLs and code tend to use more tokens
  if (text.includes('http') || text.includes('www.')) {
    adjustment += text.length / 10;
  }

  // JSON, code blocks use more tokens
  if ((text.includes('{') && text.includes('}')) || (text.includes('[') && text.includes(']'))) {
    adjustment += text.length / 15;
  }

  // Long repeating patterns may tokenize more efficiently
  const repeatingPatterns = (text.match(/(.{3,})\1{2,}/g) || []).join('').length;
  adjustment -= repeatingPatterns / 20;

  return Math.max(1, Math.ceil(tokenEstimate + adjustment));
}

/**
 * Calculate tokens for a given text
 * Alias for estimateTokenCount for backward compatibility
 */
export function calculateTokens(text: string): number {
  return estimateTokenCount(text);
}

/**
 * Truncate text to fit within a token limit
 * @param text Text to truncate
 * @param maxTokens Maximum number of tokens allowed
 * @returns Truncated text
 */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
  if (!text) return '';

  const currentTokens = calculateTokens(text);
  if (currentTokens <= maxTokens) {
    return text;
  }

  // Binary search for the right cutoff point
  let low = 0;
  let high = text.length;
  let mid;
  let bestCutoff = 0;

  while (low <= high) {
    mid = Math.floor((low + high) / 2);
    const truncated = text.substring(0, mid) + '...';
    const tokens = calculateTokens(truncated);

    if (tokens <= maxTokens) {
      bestCutoff = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return text.substring(0, bestCutoff) + '...';
}

/**
 * Check if a message array exceeds token limit
 * @param messages Array of text messages
 * @param maxTokens Maximum token limit
 * @returns Whether the token limit is exceeded
 */
export function exceedsTokenLimit(messages: string[], maxTokens: number): boolean {
  if (!messages || messages.length === 0) return false;

  // More accurate than just joining with spaces - include message format overhead
  let totalTokens = 0;

  for (const message of messages) {
    // Each message has a small overhead beyond just the text content
    totalTokens += calculateTokens(message) + 4; // +4 tokens for message formatting
  }

  // Add system overhead for the conversation format
  totalTokens += 3;

  return totalTokens > maxTokens;
}
