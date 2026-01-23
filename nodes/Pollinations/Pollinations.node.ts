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
import { audioTranscriptionOperation, executeAudioTranscription } from './operations/audioTranscription';
import { imageAnalysisOperation, executeImageAnalysis } from './operations/imageAnalysis';
import { videoAnalysisOperation, executeVideoAnalysis } from './operations/videoAnalysis';
import { imageToImageOperation, executeImageToImage } from './operations/imageToImage';

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
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'pollinationsApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Audio',
						value: 'audio',
						description: 'Audio generation and transcription',
					},
					{
						name: 'Image',
						value: 'image',
						description: 'Image generation, analysis, and editing',
					},
					{
						name: 'Text',
						value: 'text',
						description: 'Text generation with AI language models',
					},
					{
						name: 'Video',
						value: 'video',
						description: 'Video generation and analysis',
					},
				],
				default: 'image',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['audio'],
					},
				},
				options: [
					{
						name: 'Audio Generation',
						value: 'audioGeneration',
						description: 'Generate audio/speech from text',
						action: 'Generate audio',
					},
					{
						name: 'Audio Transcription',
						value: 'audioTranscription',
						description: 'Transcribe audio to text',
						action: 'Transcribe audio',
					},
				],
				default: 'audioGeneration',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['image'],
					},
				},
				options: [
					{
						name: 'Image Generation',
						value: 'imageGeneration',
						description: 'Generate images from text prompts',
						action: 'Generate an image',
					},
					{
						name: 'Image Analysis',
						value: 'imageAnalysis',
						description: 'Analyze images with AI vision',
						action: 'Analyze image',
					},
					{
						name: 'Image to Image',
						value: 'imageToImage',
						description: 'Edit or transform images with AI',
						action: 'Transform image',
					},
				],
				default: 'imageGeneration',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['text'],
					},
				},
				options: [
					{
						name: 'Text Generation',
						value: 'textGeneration',
						description: 'Generate text using AI language models',
						action: 'Generate text',
					},
				],
				default: 'textGeneration',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['video'],
					},
				},
				options: [
					{
						name: 'Video Generation',
						value: 'videoGeneration',
						description: 'Generate videos from text or images',
						action: 'Generate a video',
					},
					{
						name: 'Video Analysis',
						value: 'videoAnalysis',
						description: 'Analyze videos with AI',
						action: 'Analyze video',
					},
				],
				default: 'videoGeneration',
			},
			...imageGenerationOperation,
			...videoGenerationOperation,
			...textGenerationOperation,
			...audioGenerationOperation,
			...audioTranscriptionOperation,
			...imageAnalysisOperation,
			...videoAnalysisOperation,
			...imageToImageOperation,
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
		async getVisionModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
			try {
				const models = (await this.helpers.httpRequest({
					method: 'GET',
					url: 'https://gen.pollinations.ai/text/models',
				})) as Array<{ name: string; input_modalities: string[] }>;

				return models
					.filter((m) => m.input_modalities?.includes('image'))
					.map((m) => ({
						name: m.name.charAt(0).toUpperCase() + m.name.slice(1).replace(/-/g, ' '),
						value: m.name,
					}))
					.sort((a, b) => a.name.localeCompare(b.name));
			} catch {
				return [];
			}
		},
		async getImageToImageModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
			try {
				const models = (await this.helpers.httpRequest({
					method: 'GET',
					url: 'https://gen.pollinations.ai/image/models',
				})) as Array<{ name: string; input_modalities: string[]; output_modalities: string[] }>;

				return models
					.filter((m) => m.input_modalities?.includes('image') && m.output_modalities?.includes('image'))
					.map((m) => ({
						name: m.name.charAt(0).toUpperCase() + m.name.slice(1),
						value: m.name,
					}))
					.sort((a, b) => a.name.localeCompare(b.name));
			} catch {
				return [];
			}
		},
		async getVideoAnalysisModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
			try {
				const models = (await this.helpers.httpRequest({
					method: 'GET',
					url: 'https://gen.pollinations.ai/text/models',
				})) as Array<{ name: string; input_modalities: string[] }>;

				return models
					.filter((m) => m.input_modalities?.includes('video'))
					.map((m) => ({
						name: m.name.charAt(0).toUpperCase() + m.name.slice(1).replace(/-/g, ' '),
						value: m.name,
					}))
					.sort((a, b) => a.name.localeCompare(b.name));
			} catch {
				return [];
			}
		},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

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
					case 'audioTranscription':
						result = await executeAudioTranscription.call(this, itemIndex);
						break;
					case 'imageAnalysis':
						result = await executeImageAnalysis.call(this, itemIndex);
						break;
					case 'videoAnalysis':
						result = await executeVideoAnalysis.call(this, itemIndex);
						break;
					case 'imageToImage':
						result = await executeImageToImage.call(this, itemIndex);
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
}

