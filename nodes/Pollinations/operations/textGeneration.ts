import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export const textGenerationOperation: INodeProperties[] = [
	{
		displayName: 'Generation Type',
		name: 'textGenerationType',
		type: 'options',
		displayOptions: {
			show: {
				operation: ['textGeneration'],
			},
		},
		options: [
			{
				name: 'Simple Text',
				value: 'simple',
				description: 'Quick text generation from a prompt',
			},
			{
				name: 'Chat Completion',
				value: 'chat',
				description: 'OpenAI-compatible chat completions with advanced features',
			},
		],
		default: 'simple',
		description: 'Type of text generation to use',
	},
	// Simple text generation
	{
		displayName: 'Prompt',
		name: 'textPrompt',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				operation: ['textGeneration'],
				textGenerationType: ['simple'],
			},
		},
		description: 'Text prompt for generation',
	},
	// Chat completion
	{
		displayName: 'Model',
		name: 'textModel',
		type: 'options',
		displayOptions: {
			show: {
				operation: ['textGeneration'],
				textGenerationType: ['chat'],
			},
		},
		typeOptions: {
			loadOptionsMethod: 'getTextModels',
		},
		default: 'openai',
		description: 'AI model to use for text generation',
	},
	{
		displayName: 'Messages',
		name: 'messages',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		default: { messageValues: [{ role: 'user', content: '' }] },
		displayOptions: {
			show: {
				operation: ['textGeneration'],
				textGenerationType: ['chat'],
			},
		},
		options: [
			{
				name: 'messageValues',
				displayName: 'Message',
				values: [
					{
						displayName: 'Role',
						name: 'role',
						type: 'options',
						options: [
							{ name: 'System', value: 'system' },
							{ name: 'User', value: 'user' },
							{ name: 'Assistant', value: 'assistant' },
						],
						default: 'user',
					},
					{
						displayName: 'Content',
						name: 'content',
						type: 'string',
						default: '',
						typeOptions: {
							rows: 4,
						},
					},
				],
			},
		],
		description: 'Messages for the chat completion',
	},
	{
		displayName: 'Additional Options',
		name: 'textAdditionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				operation: ['textGeneration'],
				textGenerationType: ['chat'],
			},
		},
		options: [
			{
				displayName: 'JSON Mode',
				name: 'jsonMode',
				type: 'boolean',
				default: false,
				description: 'Whether to enable JSON mode (response_format: json_object)',
			},
			{
				displayName: 'Max Tokens',
				name: 'max_tokens',
				type: 'number',
				default: 1000,
				description: 'Maximum number of tokens to generate',
			},
			{
				displayName: 'Reasoning Effort',
				name: 'reasoning_effort',
				type: 'options',
				options: [
					{ name: 'High', value: 'high' },
					{ name: 'Low', value: 'low' },
					{ name: 'Medium', value: 'medium' },
					{ name: 'Minimal', value: 'minimal' },
					{ name: 'None', value: 'none' },
				],
				default: 'medium',
				description: 'Reasoning effort for o1/o3/deepseek-r1 models',
			},
			{
				displayName: 'Seed',
				name: 'seed',
				type: 'number',
				default: -1,
				description: 'Random seed for reproducible results (-1 for random)',
			},
			{
				displayName: 'Temperature',
				name: 'temperature',
				type: 'number',
				default: 1,
				description: 'Controls randomness (0-2)',
				typeOptions: {
					minValue: 0,
					maxValue: 2,
					numberPrecision: 1,
				},
			},
			{
				displayName: 'Thinking Budget Tokens',
				name: 'thinking_budget',
				type: 'number',
				default: 0,
				description: 'Token budget for reasoning (thinking) models (0 to disable)',
			},
			{
				displayName: 'Top P',
				name: 'top_p',
				type: 'number',
				default: 1,
				description: 'Nucleus sampling parameter (0-1)',
				typeOptions: {
					minValue: 0,
					maxValue: 1,
					numberPrecision: 2,
				},
			},
		],
	},
];

export async function executeTextGeneration(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const generationType = this.getNodeParameter('textGenerationType', itemIndex) as string;

	// Get credentials if available
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	try {
		const credentials = await this.getCredentials('pollinationsApi');
		if (credentials?.apiKey) {
			headers['Authorization'] = `Bearer ${credentials.apiKey}`;
		}
	} catch {
		// Credentials are optional, continue without them
	}

	if (generationType === 'simple') {
		const prompt = this.getNodeParameter('textPrompt', itemIndex) as string;
		const url = `https://gen.pollinations.ai/text/${encodeURIComponent(prompt)}`;

		try {
			const response = await this.helpers.httpRequest({
				method: 'GET',
				url,
				headers,
			});

			return {
				json: {
					prompt,
					text: response as string,
				},
				pairedItem: { item: itemIndex },
			};
		} catch (error) {
			throw new NodeOperationError(
				this.getNode(),
				`Failed to generate text: ${error.message}`,
				{ itemIndex },
			);
		}
	} else {
		// Chat completion
		const model = this.getNodeParameter('textModel', itemIndex) as string;
		const messagesData = this.getNodeParameter('messages', itemIndex) as {
			messageValues: Array<{ role: string; content: string; image_url?: string }>;
		};
		const additionalOptions = this.getNodeParameter('textAdditionalOptions', itemIndex, {}) as {
			temperature?: number;
			max_tokens?: number;
			top_p?: number;
			seed?: number;
			jsonMode?: boolean;
			reasoning_effort?: string;
			thinking_budget?: number;
		};

		const messages = messagesData.messageValues.map((msg) => {
			if (msg.image_url) {
				return {
					role: msg.role,
					content: [
						{ type: 'text', text: msg.content },
						{ type: 'image_url', image_url: { url: msg.image_url } },
					],
				};
			}
			return {
				role: msg.role,
				content: msg.content,
			};
		});

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const body: Record<string, any> = {
			model,
			messages,
		};

		if (additionalOptions.temperature !== undefined) body.temperature = additionalOptions.temperature;
		if (additionalOptions.max_tokens) body.max_tokens = additionalOptions.max_tokens;
		if (additionalOptions.top_p !== undefined) body.top_p = additionalOptions.top_p;
		if (additionalOptions.seed !== undefined && additionalOptions.seed !== -1) {
			body.seed = additionalOptions.seed;
		}
		if (additionalOptions.jsonMode) {
			body.response_format = { type: 'json_object' };
		}
		if (additionalOptions.reasoning_effort) {
			body.reasoning_effort = additionalOptions.reasoning_effort;
		}
		if (additionalOptions.thinking_budget) {
			body.thinking = {
				type: 'enabled',
				budget_tokens: additionalOptions.thinking_budget,
			};
		}

		try {
			const response = await this.helpers.httpRequest({
				method: 'POST',
				url: 'https://gen.pollinations.ai/v1/chat/completions',
				headers,
				body,
			});

			return {
				json: {
					model,
					messages,
					response: response,
					text: response.choices?.[0]?.message?.content || '',
				},
				pairedItem: { item: itemIndex },
			};
		} catch (error) {
			throw new NodeOperationError(
				this.getNode(),
				`Failed to generate chat completion: ${error.message}`,
				{ itemIndex },
			);
		}
	}
}
