/**
 * Open Responses API Client
 *
 * Client for making requests to the Open Responses API endpoint.
 * Supports both regular responses and streaming responses.
 */

import { ApplicationError } from 'n8n-workflow';
import type {
	OpenResponsesRequest,
	OpenResponsesResponse,
	OpenResponsesStreamEvent,
} from './types';

export class PollinationsOpenResponsesClient {
	private readonly baseURL: string;
	private readonly apiKey: string;

	constructor(baseURL: string, apiKey: string) {
		this.baseURL = baseURL;
		this.apiKey = apiKey;
	}

	/**
	 * Create a non-streaming response
	 */
	async createResponse(request: OpenResponsesRequest): Promise<OpenResponsesResponse> {
		const response = await fetch(`${this.baseURL}/v1/responses`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify(request),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new ApplicationError(
				`Open Responses API error: ${response.status} - ${errorText}`,
			);
		}

		return (await response.json()) as Promise<OpenResponsesResponse>;
	}

	/**
	 * Create a streaming response
	 * Yields Open Responses stream events
	 */
	async *streamResponse(request: OpenResponsesRequest): AsyncGenerator<OpenResponsesStreamEvent> {
		const response = await fetch(`${this.baseURL}/v1/responses`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify({ ...request, stream: true }),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new ApplicationError(
				`Open Responses API streaming error: ${response.status} - ${errorText}`,
			);
		}

		const reader = response.body?.getReader();
		if (!reader) {
			throw new ApplicationError('No response body for streaming');
		}

		const decoder = new TextDecoder();
		let buffer = '';

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const data = line.slice(6).trim();
						if (data === '[DONE]') return;
						if (data === '') continue;
						try {
							yield JSON.parse(data) as OpenResponsesStreamEvent;
						} catch {
							// Skip invalid JSON lines
						}
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
	}
}
