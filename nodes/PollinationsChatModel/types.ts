/**
 * Open Responses API Type Definitions
 *
 * Types for the Open Responses API specification.
 * See: https://openresponses.org
 */

// Open Responses API Request
export interface OpenResponsesRequest {
	model: string;
	input: string | Array<OpenResponsesInputItem>;
	instructions?: string;
	stream?: boolean;
	tools?: OpenResponsesTool[];
	tool_choice?: 'auto' | 'none' | { type: string; name: string };
	reasoning?: { effort: 'low' | 'medium' | 'high' };
	temperature?: number;
	max_tokens?: number;
	top_p?: number;
}

// Input item for Open Responses API
export interface OpenResponsesInputItem {
	type?: 'message' | 'function_call' | 'function_call_output';
	role?: 'user' | 'assistant' | 'system';
	content?: string;
	call_id?: string;
	name?: string;
	arguments?: string;
	output?: string;
}

// Tool definition for Open Responses API
export interface OpenResponsesTool {
	type: 'function';
	name: string;
	description?: string;
	parameters?: Record<string, unknown>;
}

// Open Responses API Response
export interface OpenResponsesResponse {
	id: string;
	status: string;
	output: OpenResponsesOutputItem[];
	output_text: string;
	usage: {
		input_tokens: number;
		output_tokens: number;
		total_tokens: number;
	};
	error?: {
		type: string;
		message: string;
	};
}

// Output item in Open Responses API response
export interface OpenResponsesOutputItem {
	type: 'message' | 'function_call';
	id?: string;
	content?: string;
	name?: string;
	call_id?: string;
	arguments?: string;
}

// Stream event for Open Responses API streaming
export interface OpenResponsesStreamEvent {
	type: string;
	event?: string;
	delta?: string;
	item?: OpenResponsesOutputItem;
	response?: OpenResponsesResponse;
}
