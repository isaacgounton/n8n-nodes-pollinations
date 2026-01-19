import { DynamicStructuredTool } from '@langchain/core/tools';
import type {
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	SupplyData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { z } from 'zod';

async function getTool(ctx: ISupplyDataFunctions, itemIndex: number) {
	const model = ctx.getNodeParameter('model', itemIndex, 'openai') as string;

	// Get credentials if available
	let apiKey = '';
	try {
		const credentials = await ctx.getCredentials('pollinationsApi');
		if (credentials?.apiKey) {
			apiKey = credentials.apiKey as string;
		}
	} catch {
		// Credentials are optional
	}

	const textGenerationTool = new DynamicStructuredTool({
		name: 'generate_text',
		description: 'Generate text or get chat completions using AI language models. Supports OpenAI, Claude, Gemini, Llama, DeepSeek, and more. Can use JSON mode for structured outputs.',
		schema: z.object({
			prompt: z.string().describe('Text prompt or question for the AI'),
			model: z.string().optional().describe('AI model to use (openai, claude, gemini, llama, deepseek-chat, etc.). Default: openai'),
			maxTokens: z.number().optional().describe('Maximum tokens to generate. Default: 1000'),
			temperature: z.number().optional().describe('Controls randomness (0-2). Higher = more creative. Default: 1'),
			top_p: z.number().optional().describe('Nucleus sampling parameter (0-1). Default: 1'),
			jsonMode: z.boolean().optional().describe('Enable JSON mode for structured output. Default: false'),
			seed: z.number().optional().describe('Random seed for reproducible results. Use -1 for random. Default: -1'),
		}),
		func: async ({ prompt, model: toolModel, maxTokens, temperature, top_p, jsonMode, seed }) => {
			const headers: Record<string, string> = { 'Content-Type': 'application/json' };
			if (apiKey) {
				headers['Authorization'] = `Bearer ${apiKey}`;
			}

			const selectedModel = toolModel || model;
			const requestBody: Record<string, unknown> = {
				model: selectedModel,
				messages: [{ role: 'user', content: prompt }],
			};

			// Add optional parameters
			if (maxTokens !== undefined) requestBody.max_tokens = maxTokens;
			if (temperature !== undefined) requestBody.temperature = temperature;
			if (top_p !== undefined) requestBody.top_p = top_p;
			if (seed !== undefined && seed !== -1) requestBody.seed = seed;
			if (jsonMode) requestBody.response_format = { type: 'json_object' };

			try {
				const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
					method: 'POST',
					headers,
					body: JSON.stringify(requestBody),
				});

				if (!response.ok) {
					const errorText = await response.text();
				throw new NodeOperationError(ctx.getNode(), `HTTP error! status: ${response.status}, message: ${errorText}`);
			}

				const result = await response.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: Record<string, number> };
				const content = result.choices?.[0]?.message?.content || '';

				return JSON.stringify({
					success: true,
					content,
					model: selectedModel,
					prompt,
					usage: result.usage || {},
				});
			} catch (error) {
				return JSON.stringify({
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error',
					prompt,
				});
			}
		},
	});

	return textGenerationTool;
}

export class ToolPollinationsText implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pollinations Text Generation',
		name: 'toolPollinationsText',
		icon: 'file:pollinations.svg',
		group: ['transform'],
		version: 1,
		description: 'Generate text using Pollinations.ai',
		defaults: {
			name: 'Pollinations Text',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Tools'],
			},
		},
		inputs: [],
		outputs: [NodeConnectionTypes.AiTool],
		outputNames: ['Tool'],
		usableAsTool: true,
		credentials: [
			{
				name: 'pollinationsApi',
				required: false,
			},
		],
		properties: [
			{
				displayName: 'Info',
				name: 'notice',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						'@version': [1],
					},
				},
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				options: [
					{ name: 'Claude', value: 'claude' },
					{ name: 'DeepSeek Chat', value: 'deepseek-chat' },
					{ name: 'Gemini', value: 'gemini' },
					{ name: 'Llama', value: 'llama' },
					{ name: 'OpenAI', value: 'openai' },
					{ name: 'Qwen', value: 'qwen' },
				],
				default: 'openai',
				description: 'Default AI model to use for text generation',
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		return {
			response: await getTool(this, itemIndex),
		};
	}
}
