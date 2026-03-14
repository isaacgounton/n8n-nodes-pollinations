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

/**
 * Build a multipart/form-data body manually from fields and a file buffer.
 * Returns { body: Buffer, contentType: string } with the correct boundary.
 *
 * This is needed because Node.js global FormData + Blob doesn't serialize
 * binary data correctly through n8n's httpRequest (axios-based).
 */
export function buildMultipartBody(
	fields: Record<string, string>,
	file: { fieldName: string; buffer: Buffer; fileName: string; mimeType: string },
): { body: Buffer; contentType: string } {
	const boundary = `----n8nBoundary${Date.now().toString(16)}`;
	const parts: Buffer[] = [];

	// Add string fields
	for (const [key, value] of Object.entries(fields)) {
		parts.push(Buffer.from(
			`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`,
		));
	}

	// Add file field
	parts.push(Buffer.from(
		`--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldName}"; filename="${file.fileName}"\r\nContent-Type: ${file.mimeType}\r\n\r\n`,
	));
	parts.push(file.buffer);
	parts.push(Buffer.from('\r\n'));

	// Closing boundary
	parts.push(Buffer.from(`--${boundary}--\r\n`));

	return {
		body: Buffer.concat(parts),
		contentType: `multipart/form-data; boundary=${boundary}`,
	};
}
