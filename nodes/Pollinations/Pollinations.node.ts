import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { imageGenerationOperation, executeImageGeneration } from './operations/imageGeneration';
import { videoGenerationOperation, executeVideoGeneration } from './operations/videoGeneration';
import { textGenerationOperation, executeTextGeneration } from './operations/textGeneration';
import { audioGenerationOperation, executeAudioGeneration } from './operations/audioGeneration';

// Type definitions for AI tool calls
interface ToolCall {
	name: string;
	arguments: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GetNodeParameterFunction = (key: string, itemIndex?: number) => any;

interface ImageGenerationArgs {
	prompt: string;
	model?: string;
	width?: number;
	height?: number;
	negative_prompt?: string;
	seed?: number;
	count?: number;
	enhance?: boolean;
	safe?: boolean;
}

interface VideoGenerationArgs {
	prompt: string;
	model?: string;
	duration?: number;
	width?: number;
	height?: number;
	aspectRatio?: string;
	negative_prompt?: string;
	seed?: number;
	audio?: boolean;
	safe?: boolean;
}

interface TextGenerationArgs {
	prompt: string;
	model?: string;
	maxTokens?: number;
	temperature?: number;
	top_p?: number;
	seed?: number;
	jsonMode?: boolean;
	reasoning_effort?: string;
}

interface AudioGenerationArgs {
	text: string;
	voice?: string;
	format?: string;
}

export class Pollinations implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pollinations',
		name: 'pollinations',
		icon: 'file:pollinations.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Generate images, videos, text, and audio using Pollinations.ai',
		defaults: {
			name: 'Pollinations',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'pollinationsApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Image Generation',
						value: 'imageGeneration',
						description: 'Generate images from text prompts',
						action: 'Generate an image',
					},
					{
						name: 'Video Generation',
						value: 'videoGeneration',
						description: 'Generate videos from text or images',
						action: 'Generate a video',
					},
					{
						name: 'Text Generation',
						value: 'textGeneration',
						description: 'Generate text using AI language models',
						action: 'Generate text',
					},
					{
						name: 'Audio Generation',
						value: 'audioGeneration',
						description: 'Generate audio/speech from text',
						action: 'Generate audio',
					},
				],
				default: 'imageGeneration',
			},
			...imageGenerationOperation,
			...videoGenerationOperation,
			...textGenerationOperation,
			...audioGenerationOperation,
		],
	};

	methods = {
		loadOptions: {
			async getImageModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const models = (await this.helpers.httpRequest({
						method: 'GET',
						url: 'https://gen.pollinations.ai/image/models',
					})) as Array<{ name: string; output_modalities: string[] }>;

					return models
						.filter((m) => m.output_modalities?.includes('image'))
						.map((m) => ({
							name: m.name.charAt(0).toUpperCase() + m.name.slice(1),
							value: m.name,
						}))
						.sort((a, b) => a.name.localeCompare(b.name));
				} catch {
					return [];
				}
			},
			async getVideoModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const models = (await this.helpers.httpRequest({
						method: 'GET',
						url: 'https://gen.pollinations.ai/image/models',
					})) as Array<{ name: string; output_modalities: string[] }>;

					return models
						.filter((m) => m.output_modalities?.includes('video'))
						.map((m) => ({
							name: m.name.charAt(0).toUpperCase() + m.name.slice(1),
							value: m.name,
						}))
						.sort((a, b) => a.name.localeCompare(b.name));
				} catch {
					return [];
				}
			},
			async getTextModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
			try {
				const response = (await this.helpers.httpRequest({
					method: 'GET',
					url: 'https://gen.pollinations.ai/v1/models',
				})) as { data: Array<{ id: string }> };

				if (!response?.data || !Array.isArray(response.data)) {
					return [];
				}

				return response.data
					.map((m) => ({
						name: m.id.charAt(0).toUpperCase() + m.id.slice(1).replace(/-/g, ' '),
						value: m.id,
					}))
					.sort((a, b) => a.name.localeCompare(b.name));
			} catch {
				return [];
			}
		},
		},
		getAvailableTools: {
			async getAvailableTools(this: ILoadOptionsFunctions) {
				return [
					{
						name: 'generate_image',
						description: 'Generate images using AI models like Flux, Turbo, and more. Provide a text prompt describing the image you want to create.',
						schema: {
							type: 'object',
							properties: {
								prompt: {
									type: 'string',
									description: 'Text description of the image to generate',
								},
								model: {
									type: 'string',
									description: 'AI model to use (optional, defaults to flux). Many models available including flux, turbo, gpt-image, kontext, search, sdxl-turbo, and more.',
								},
								width: {
									type: 'number',
									description: 'Image width in pixels (optional, 16-2048)',
								},
								height: {
									type: 'number',
									description: 'Image height in pixels (optional, 16-2048)',
								},
								negative_prompt: {
									type: 'string',
									description: 'What to avoid in the generated image (optional)',
								},
								seed: {
									type: 'number',
									description: 'Random seed for reproducible results (optional, -1 for random)',
								},
								count: {
									type: 'number',
									description: 'Number of images to generate (optional, 1-4, premium models only)',
									minimum: 1,
									maximum: 4,
								},
								enhance: {
									type: 'boolean',
									description: 'Whether to use AI to improve the prompt (optional)',
								},
								safe: {
									type: 'boolean',
									description: 'Whether to enable strict NSFW content filtering (optional)',
								},
							},
							required: ['prompt'],
						},
					},
					{
						name: 'generate_video',
						description: 'Generate videos from text prompts or images. Create short video clips using AI models.',
						schema: {
							type: 'object',
							properties: {
								prompt: {
									type: 'string',
									description: 'Text description of the video to generate',
								},
								model: {
									type: 'string',
									description: 'AI model to use for video generation (optional, defaults to veo). Available models include veo, seedance, and more.',
								},
								duration: {
									type: 'number',
									description: 'Video duration in seconds (optional, veo: 4/6/8, seedance: 2-10)',
								},
								width: {
									type: 'number',
									description: 'Video width in pixels (optional, 256-2048)',
								},
								height: {
									type: 'number',
									description: 'Video height in pixels (optional, 256-2048)',
								},
								aspectRatio: {
									type: 'string',
									description: 'Video aspect ratio (optional, "16:9" or "9:16")',
									enum: ['16:9', '9:16'],
								},
								negative_prompt: {
									type: 'string',
									description: 'What to avoid in the generated video (optional)',
								},
								seed: {
									type: 'number',
									description: 'Random seed for reproducible results (optional, -1 for random)',
								},
								audio: {
									type: 'boolean',
									description: 'Whether to enable audio generation for video (optional, veo only)',
								},
								safe: {
									type: 'boolean',
									description: 'Whether to enable strict NSFW content filtering (optional)',
								},
							},
							required: ['prompt'],
						},
					},
					{
						name: 'generate_text',
						description: 'Generate text using various AI language models including OpenAI, Claude, Gemini, and more.',
						schema: {
							type: 'object',
							properties: {
								prompt: {
									type: 'string',
									description: 'Text prompt for generation (for simple text) OR messages array for chat completion',
								},
								model: {
									type: 'string',
									description: 'AI model to use for text generation (optional, defaults to openai). Supports many models including GPT, Claude, Gemini, Mistral, and more.',
								},
								maxTokens: {
									type: 'number',
									description: 'Maximum number of tokens to generate (optional)',
								},
								temperature: {
									type: 'number',
									description: 'Controls randomness (optional, 0-2)',
									minimum: 0,
									maximum: 2,
								},
								top_p: {
									type: 'number',
									description: 'Nucleus sampling parameter (optional, 0-1)',
									minimum: 0,
									maximum: 1,
								},
								seed: {
									type: 'number',
									description: 'Random seed for reproducible results (optional, -1 for random)',
								},
								jsonMode: {
									type: 'boolean',
									description: 'Whether to enable JSON mode for structured output (optional)',
								},
								reasoning_effort: {
									type: 'string',
									description: 'Reasoning effort for o1/o3/deepseek-r1 models (optional)',
									enum: ['high', 'medium', 'low', 'minimal', 'none'],
								},
							},
							required: ['prompt'],
						},
					},
					{
						name: 'generate_audio',
						description: 'Convert text to speech using AI. Generate audio narration with different voices and formats.',
						schema: {
							type: 'object',
							properties: {
								text: {
									type: 'string',
									description: 'Text to convert to speech',
								},
								voice: {
									type: 'string',
									description: 'Voice to use for the audio (optional, defaults to alloy). Available voices include alloy, echo, fable, onyx, nova, shimmer, and many more.',
								},
								format: {
									type: 'string',
									description: 'Audio format (optional, defaults to mp3)',
									enum: ['mp3', 'wav', 'flac', 'aac'],
								},
							},
							required: ['text'],
						},
					},
				];
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		// Check if this is a tool call from an AI agent
		try {
			const toolCall = this.getNodeParameter('toolCall', 0, null) as ToolCall | null;
			if (toolCall) {
				return Pollinations.executeTool.call(this, toolCall);
			}
		} catch {
			// Not a tool call, continue with normal execution
		}

		const operation = this.getNodeParameter('operation', 0) as string;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				let result: INodeExecutionData;

				switch (operation) {
					case 'imageGeneration':
						result = await executeImageGeneration.call(this, itemIndex);
						break;
					case 'videoGeneration':
						result = await executeVideoGeneration.call(this, itemIndex);
						break;
					case 'textGeneration':
						result = await executeTextGeneration.call(this, itemIndex);
						break;
					case 'audioGeneration':
						result = await executeAudioGeneration.call(this, itemIndex);
						break;
					default:
						throw new NodeOperationError(
							this.getNode(),
							`Unknown operation: ${operation}`,
							{ itemIndex },
						);
				}

				returnData.push(result);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: this.getInputData(itemIndex)[0].json,
						error,
						pairedItem: { item: itemIndex },
					});
				} else {
					throw error;
				}
			}
		}

		return [returnData];
	}

	static async executeTool(this: IExecuteFunctions, toolCall: ToolCall): Promise<INodeExecutionData[][]> {
		const { name, arguments: args } = toolCall;

		try {
			let result: INodeExecutionData;

			switch (name) {
				case 'generate_image': {
					const imageArgs = args as unknown as ImageGenerationArgs;
					const originalGetNodeParameter = this.getNodeParameter;
					this.getNodeParameter = ((key: string) => {
						switch (key) {
							case 'operation': return 'imageGeneration';
							case 'prompt': return imageArgs.prompt;
							case 'model': return imageArgs.model || 'flux';
							case 'width': return imageArgs.width || 1024;
							case 'height': return imageArgs.height || 1024;
							case 'additionalOptions': return {
								seed: imageArgs.seed ?? -1,
								nologo: false,
								private: false,
								safe: imageArgs.safe ?? false,
								enhance: imageArgs.enhance ?? false,
								transparent: false,
								count: imageArgs.count || 1,
								imageUrl: undefined,
								negative_prompt: imageArgs.negative_prompt || 'worst quality, blurry',
								quality: 'medium',
							};
							default: return originalGetNodeParameter.call(this, key, 0);
						}
					}) as GetNodeParameterFunction;
					result = await executeImageGeneration.call(this, 0);
					this.getNodeParameter = originalGetNodeParameter;
					break;
				}

				case 'generate_video': {
					const videoArgs = args as unknown as VideoGenerationArgs;
					const originalGetNodeParameter = this.getNodeParameter;
					this.getNodeParameter = ((key: string) => {
						switch (key) {
							case 'operation': return 'videoGeneration';
							case 'prompt': return videoArgs.prompt;
							case 'videoModel': return videoArgs.model || 'veo';
							case 'width': return videoArgs.width || 1024;
							case 'height': return videoArgs.height || 576;
							case 'videoAdditionalOptions': return {
								aspectRatio: videoArgs.aspectRatio || '16:9',
								duration: videoArgs.duration || 4,
								audio: videoArgs.audio ?? false,
								imageUrl: undefined,
								negative_prompt: videoArgs.negative_prompt || 'worst quality, blurry',
								private: false,
								safe: videoArgs.safe ?? false,
								seed: videoArgs.seed ?? -1,
							};
							default: return originalGetNodeParameter.call(this, key, 0);
						}
					}) as GetNodeParameterFunction;
					result = await executeVideoGeneration.call(this, 0);
					this.getNodeParameter = originalGetNodeParameter;
					break;
				}

				case 'generate_text': {
					const textArgs = args as unknown as TextGenerationArgs;
					const originalGetNodeParameter = this.getNodeParameter;
					this.getNodeParameter = ((key: string) => {
						switch (key) {
							case 'operation': return 'textGeneration';
							case 'textGenerationType': return 'chat'; // Default to chat completion
							case 'textPrompt': return textArgs.prompt;
							case 'textModel': return textArgs.model || 'openai';
							case 'messages': return { messageValues: [{ role: 'user', content: textArgs.prompt }] };
							case 'textAdditionalOptions': return {
								jsonMode: textArgs.jsonMode ?? false,
								max_tokens: textArgs.maxTokens || 1000,
								reasoning_effort: textArgs.reasoning_effort || 'medium',
								seed: textArgs.seed ?? -1,
								temperature: textArgs.temperature || 1,
								thinking_budget: 0,
								top_p: textArgs.top_p || 1,
							};
							default: return originalGetNodeParameter.call(this, key, 0);
						}
					}) as GetNodeParameterFunction;
					result = await executeTextGeneration.call(this, 0);
					this.getNodeParameter = originalGetNodeParameter;
					break;
				}

				case 'generate_audio': {
					const audioArgs = args as unknown as AudioGenerationArgs;
					const originalGetNodeParameter = this.getNodeParameter;
					this.getNodeParameter = ((key: string) => {
						switch (key) {
							case 'operation': return 'audioGeneration';
							case 'audioText': return audioArgs.text;
							case 'audioVoice': return audioArgs.voice || 'alloy';
							case 'audioFormat': return audioArgs.format || 'mp3';
							default: return originalGetNodeParameter.call(this, key, 0);
						}
					}) as GetNodeParameterFunction;
					result = await executeAudioGeneration.call(this, 0);
					this.getNodeParameter = originalGetNodeParameter;
					break;
				}

				default:
					throw new NodeOperationError(this.getNode(), `Tool ${name} is not supported`);
			}

			return [[result]];
		} catch (error) {
			throw new NodeOperationError(this.getNode(), `Tool execution failed: ${error.message}`);
		}
	}
}
