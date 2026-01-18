import type {
	ISupplyDataFunctions,
	INodeType,
	INodeTypeDescription,
	SupplyData,
	ILoadOptionsFunctions,
	INodePropertyOptions,
} from 'n8n-workflow';
import { ApplicationError, NodeConnectionTypes } from 'n8n-workflow';

// Tool interface for OpenAI-compatible function calling
interface Tool {
	type: string;
	function: {
		name: string;
		description?: string;
		parameters?: Record<string, unknown>;
	};
}

// Minimal langchain-compatible chat model wrapper for Pollinations
class PollinationsChatModelInstance {
	modelName: string;
	temperature: number;
	maxTokens?: number;
	topP?: number;
	baseURL: string;
	apiKey: string;
	lc_namespace = ['langchain', 'chat_models', 'pollinations'];
	supportsToolCalling = true;
	boundTools: Tool[] = [];

	constructor(fields: {
		modelName: string;
		temperature?: number;
		maxTokens?: number;
		topP?: number;
		apiKey: string;
	}) {
		this.modelName = fields.modelName;
		this.temperature = fields.temperature ?? 1;
		this.maxTokens = fields.maxTokens;
		this.topP = fields.topP;
		this.baseURL = 'https://gen.pollinations.ai';
		this.apiKey = fields.apiKey;
	}
	
	// Langchain tool calling interface
	bindTools(tools: Tool[]): this {
		this.boundTools = tools;
		return this;
	}

	_llmType(): string {
		return 'pollinations';
	}
	
	// Runnable interface methods
	async batch(inputs: Array<Array<{ role: string; content: string }>>): Promise<Array<{ content: string; tool_calls?: unknown[] }>> {
		return Promise.all(inputs.map(messages => this.invoke(messages)));
	}
	
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	pipe(_nextRunnable: unknown): unknown {
		return _nextRunnable;
	}
	
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	withConfig(_config: unknown): this {
		return this;
	}

	async invoke(
		messages: Array<{ role: string; content: string }>,
		options?: { tools?: Tool[] },
	): Promise<{ content: string; tool_calls?: unknown[] }> {
		const body: Record<string, unknown> = {
			model: this.modelName,
			messages,
			temperature: this.temperature,
			...(this.maxTokens && { max_tokens: this.maxTokens }),
			...(this.topP !== undefined && { top_p: this.topP }),
		};

		// Use bound tools or options tools
		const tools = options?.tools || this.boundTools;
		if (tools && tools.length > 0) {
			body.tools = tools;
		}

		const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new ApplicationError(`Pollinations API error: ${response.status} - ${errorText}`);
		}

		const data = (await response.json()) as {
			choices?: Array<{ message?: { content?: string; tool_calls?: unknown[] } }>;
		};
		
		const message = data.choices?.[0]?.message;
		return {
			content: message?.content || '',
			...(message?.tool_calls && { tool_calls: message.tool_calls }),
		};
	}

	async _generate(
		messages: Array<Array<{ role: string; content: string }>>,
	): Promise<{
		generations: Array<Array<{ text: string; message: { content: string } }>>;
	}> {
		const generations = await Promise.all(
			messages.map(async (messageSet) => {
				const result = await this.invoke(messageSet);
				return [{ text: result.content, message: result }];
			}),
		);
		return { generations };
	}

	async call(input: string): Promise<string> {
		const result = await this.invoke([{ role: 'user', content: input }]);
		return result.content;
	}
}

export class PollinationsChatModel implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pollinations Chat Model',
		name: 'pollinationsChatModel',
		icon: 'file:../Pollinations/pollinations.svg',
		group: ['transform'],
		version: 1,
		description: 'Use Pollinations.ai language models with AI Agents',
		defaults: {
			name: 'Pollinations Chat Model',
		},
		usableAsTool: true,
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://pollinations.ai',
					},
				],
			},
		},
		inputs: [],
		outputs: [NodeConnectionTypes.AiLanguageModel],
		outputNames: ['Model'],
		credentials: [
			{
				name: 'pollinationsApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Model Name or ID',
				name: 'model',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getModels',
				},
				default: '',
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
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
						displayName: 'Max Tokens',
						name: 'maxTokens',
						type: 'number',
						default: 1000,
						description: 'Maximum number of tokens to generate',
					},
					{
						displayName: 'Top P',
						name: 'topP',
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
		],
	};

	methods = {
		loadOptions: {
			async getModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const credentials = await this.getCredentials('pollinationsApi');
					
					if (!credentials?.apiKey) {
						throw new ApplicationError('API key is required');
					}

					const response = await this.helpers.httpRequest({
						method: 'GET',
						url: 'https://gen.pollinations.ai/v1/models',
						headers: {
							Authorization: `Bearer ${credentials.apiKey}`,
						},
					});

					const data = response as { data?: Array<{ id: string }> };

					if (!data?.data || !Array.isArray(data.data)) {
						throw new ApplicationError('Invalid response from Pollinations API');
					}

					const models = data.data
						.map((m) => ({
							name: m.id.charAt(0).toUpperCase() + m.id.slice(1).replace(/-/g, ' '),
							value: m.id,
						}))
						.sort((a, b) => a.name.localeCompare(b.name));

					return models.length > 0 ? models : [
						{ name: 'OpenAI', value: 'openai' },
						{ name: 'Claude', value: 'claude' },
						{ name: 'Gemini', value: 'gemini' },
						{ name: 'Mistral', value: 'mistral' },
						{ name: 'DeepSeek', value: 'deepseek' },
					];
				} catch {
					// Return fallback models if API call fails
					return [
						{ name: 'OpenAI', value: 'openai' },
						{ name: 'Claude', value: 'claude' },
						{ name: 'Gemini', value: 'gemini' },
						{ name: 'Mistral', value: 'mistral' },
						{ name: 'DeepSeek', value: 'deepseek' },
						{ name: 'Grok', value: 'grok' },
						{ name: 'Qwen Coder', value: 'qwen-coder' },
						{ name: 'Perplexity Fast', value: 'perplexity-fast' },
					];
				}
			},
		},
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const credentials = await this.getCredentials('pollinationsApi');
		const model = this.getNodeParameter('model', itemIndex) as string;
		const options = this.getNodeParameter('options', itemIndex, {}) as {
			temperature?: number;
			maxTokens?: number;
			topP?: number;
		};

		const chatModel = new PollinationsChatModelInstance({
			modelName: model,
			temperature: options.temperature,
			maxTokens: options.maxTokens,
			topP: options.topP,
			apiKey: credentials.apiKey as string,
		});

		return {
			response: chatModel,
		};
	}
}
