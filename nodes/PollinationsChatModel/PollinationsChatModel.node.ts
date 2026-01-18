import type {
	ISupplyDataFunctions,
	INodeType,
	INodeTypeDescription,
	SupplyData,
	ILoadOptionsFunctions,
	INodePropertyOptions,
} from 'n8n-workflow';
import { ApplicationError, NodeConnectionTypes } from 'n8n-workflow';

// Simple AIMessage implementation for compatibility
class AIMessage {
	content: string;
	tool_calls?: unknown[];
	additional_kwargs: Record<string, unknown> = {};

	constructor(content: string, tool_calls?: unknown[]) {
		this.content = content;
		this.tool_calls = tool_calls || [];
		if (tool_calls && tool_calls.length > 0) {
			this.additional_kwargs.tool_calls = tool_calls;
		}
	}

	_getType(): string {
		return 'ai';
	}
}

// ChatResult and ChatGeneration interfaces for LangChain compatibility
interface ChatGeneration {
	message: AIMessage;
	text: string;
	generationInfo?: Record<string, unknown>;
}

interface ChatResult {
	generations: ChatGeneration[];
	llmOutput?: Record<string, unknown>;
}

// LangChain-compatible Runnable chat model for Pollinations
class PollinationsChatModelInstance {
	modelName: string;
	temperature: number;
	maxTokens?: number;
	topP?: number;
	baseURL: string;
	apiKey: string;

	// LangChain Runnable interface properties
	lc_namespace = ['langchain', 'chat_models', 'pollinations'];
	lc_serializable = true;
	lc_runnable = true;

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

	_llmType(): string {
		return 'pollinations';
	}

	getName(): string {
		return 'PollinationsChatModel';
	}

	// Convert LangChain messages to simple format
	private convertMessages(messages: unknown[]): Array<{ role: string; content: string }> {
		return messages.map(message => {
			const msg = message as Record<string, unknown>;

			// Handle LangChain message objects
			if ('_getType' in msg && typeof msg._getType === 'function') {
				const msgType = msg._getType();
				if (msgType === 'human') {
					return { role: 'user', content: String(msg.content || '') };
				} else if (msgType === 'ai') {
					return { role: 'assistant', content: String(msg.content || '') };
				} else if (msgType === 'system') {
					return { role: 'system', content: String(msg.content || '') };
				}
			}

			// Handle plain objects with role/content
			if (typeof msg === 'object' && msg !== null && 'role' in msg && 'content' in msg) {
				return {
					role: String(msg.role || 'user'),
					content: String(msg.content || '')
				};
			}

			// Handle objects with different field names
			if (typeof msg === 'object' && msg !== null) {
				const content = msg.content || msg.text || msg.message || msg.prompt;
				const role = msg.role || msg.type || 'user';
				if (content) {
					return {
						role: String(role),
						content: String(content)
					};
				}
			}

			// Fallback: treat as user message
			return { role: 'user', content: String(message) };
		});
	}

	// Runnable interface methods
	async invoke(input: unknown): Promise<AIMessage> {
		let messages: Array<{ role: string; content: string }>;

		if (Array.isArray(input)) {
			messages = this.convertMessages(input);
		} else if (typeof input === 'string') {
			messages = [{ role: 'user', content: input }];
		} else if (input && typeof input === 'object') {
			// Handle single message object or other object formats
			const inputObj = input as Record<string, unknown>;
			if ('content' in inputObj) {
				// Single message object
				messages = this.convertMessages([input]);
			} else if ('messages' in inputObj && Array.isArray(inputObj.messages)) {
				// Object with messages array
				messages = this.convertMessages(inputObj.messages);
			} else if ('input' in inputObj) {
				// Object with input field
				messages = [{ role: 'user', content: String(inputObj.input) }];
			} else {
				// Try to extract text from object
				const textContent = inputObj.text || inputObj.message || inputObj.prompt || String(input);
				messages = [{ role: 'user', content: String(textContent) }];
			}
		} else {
			// Fallback: convert to string
			messages = [{ role: 'user', content: String(input) }];
		}

		const result = await this._callAPI(messages);
		return new AIMessage(result.content, result.tool_calls);
	}

	// LangChain BaseChatModel _generate method for compatibility
	async _generate(messages: unknown[]): Promise<ChatResult> {
		const convertedMessages = this.convertMessages(messages);
		const result = await this._callAPI(convertedMessages);
		const aiMessage = new AIMessage(result.content, result.tool_calls);

		const generation: ChatGeneration = {
			message: aiMessage,
			text: result.content,
			generationInfo: {
				finish_reason: 'stop',
				...(result.tool_calls && result.tool_calls.length > 0 && { tool_calls: result.tool_calls }),
			},
		};

		return {
			generations: [generation],
			llmOutput: {
				tokenUsage: {
					promptTokens: 0,
					completionTokens: 0,
					totalTokens: 0,
				},
			},
		};
	}

	async batch(inputs: unknown[]): Promise<AIMessage[]> {
		return Promise.all(inputs.map(input => this.invoke(input)));
	}

	pipe(nextRunnable: unknown): unknown {
		const pipeFunction = async (input: unknown) => {
			const output = await this.invoke(input);
			if (typeof nextRunnable === 'function') {
				return await nextRunnable(output);
			}
			if (nextRunnable && typeof nextRunnable === 'object' && 'invoke' in nextRunnable) {
				return await (nextRunnable as { invoke: (input: unknown) => Promise<unknown> }).invoke(output);
			}
			return output;
		};
		return pipeFunction;
	}

	withConfig(config: Record<string, unknown>): this {
		const newInstance = new PollinationsChatModelInstance({
			modelName: this.modelName,
			temperature: config.temperature as number ?? this.temperature,
			maxTokens: config.maxTokens as number ?? this.maxTokens,
			topP: config.topP as number ?? this.topP,
			apiKey: this.apiKey,
		});
		return newInstance as this;
	}

	// Tool calling support
	bindTools(tools: unknown[]): this {
		// Store tools on the current instance instead of creating a new one
		(this as PollinationsChatModelInstance & { boundTools?: unknown[] }).boundTools = tools;
		return this;
	}

	// Internal API call method
	private async _callAPI(messages: Array<{ role: string; content: string }>): Promise<{ content: string; tool_calls?: unknown[] }> {
		const body: Record<string, unknown> = {
			model: this.modelName,
			messages,
			temperature: this.temperature,
			...(this.maxTokens && { max_tokens: this.maxTokens }),
			...(this.topP !== undefined && { top_p: this.topP }),
		};

		// Add tools if available
		const boundTools = (this as PollinationsChatModelInstance & { boundTools?: unknown[] }).boundTools;
		if (boundTools && Array.isArray(boundTools) && boundTools.length > 0) {
			body.tools = boundTools;
			// Enable tool calling when tools are available
			body.tool_choice = 'auto';
			body.parallel_tool_calls = true;
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
			tool_calls: message?.tool_calls || [],
		};
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
					const response = await this.helpers.httpRequest({
						method: 'GET',
						url: 'https://gen.pollinations.ai/v1/models',
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
