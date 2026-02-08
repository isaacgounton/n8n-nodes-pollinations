/**
 * Shared utility functions for Pollinations node operations.
 */

/**
 * Extract base64 string from n8n binary data, handling data URLs, plain strings, and Buffer.
 */
export function extractBase64(data: string | Buffer): string {
	if (typeof data === 'string') {
		if (data.startsWith('data:')) {
			return data.split(',')[1];
		}
		return data;
	}
	return Buffer.from(data).toString('base64');
}

/**
 * Sanitize prompt text for use in URL path segments.
 * Replaces % with "percent" to avoid API 400 errors (encoded %25 in path causes issues).
 */
export function sanitizePromptForUrl(prompt: string): string {
	return prompt.replace(/%/g, 'percent');
}
