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
import { musicGenerationOperation, executeMusicGeneration } from './operations/musicGeneration';
import { imageAnalysisOperation, executeImageAnalysis } from './operations/imageAnalysis';
import { videoAnalysisOperation, executeVideoAnalysis } from './operations/videoAnalysis';
import { imageToImageOperation, executeImageToImage } from './operations/imageToImage';
import {
	mediaUploadOperation,
	mediaRetrieveOperation,
	mediaDeleteOperation,
	executeMediaUpload,
	executeMediaRetrieve,
	executeMediaDelete,
} from './operations/mediaStorage';

export class Pollinations implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pollinations',
		name: 'pollinations',
		icon: 'file:pollinations.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Generate images, videos, text, audio, and music using Pollinations.ai',
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
						description: 'Audio generation, music, and transcription',
					},
					{
						name: 'Image',
						value: 'image',
						description: 'Image generation, analysis, and editing',
					},
					{
						name: 'Storage',
						value: 'storage',
						description: 'Upload, retrieve, and delete media files',
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
						description: 'Generate speech from text (TTS)',
						action: 'Generate audio',
					},
					{
						name: 'Audio Transcription',
						value: 'audioTranscription',
						description: 'Transcribe audio to text (STT)',
						action: 'Transcribe audio',
					},
					{
						name: 'Music Generation',
						value: 'musicGeneration',
						description: 'Generate music and instrumental audio',
						action: 'Generate music',
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
						resource: ['storage'],
					},
				},
				options: [
					{
						name: 'Delete',
						value: 'mediaDelete',
						description: 'Delete a media file by hash (owner only)',
						action: 'Delete media',
					},
					{
						name: 'Retrieve',
						value: 'mediaRetrieve',
						description: 'Retrieve a media file by hash',
						action: 'Retrieve media',
					},
					{
						name: 'Upload',
						value: 'mediaUpload',
						description: 'Upload a file to Pollinations media storage (max 10MB)',
						action: 'Upload media',
					},
				],
				default: 'mediaUpload',
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
			...musicGenerationOperation,
			...imageAnalysisOperation,
			...videoAnalysisOperation,
			...imageToImageOperation,
			...mediaUploadOperation,
			...mediaRetrieveOperation,
			...mediaDeleteOperation,
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
			async getTranscriptionModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const models = (await this.helpers.httpRequest({
						method: 'GET',
						url: 'https://gen.pollinations.ai/audio/models',
					})) as Array<{ name: string; aliases?: string[]; input_modalities?: string[]; output_modalities?: string[] }>;

					// STT models: input audio, output text — include aliases as separate options
					const options: INodePropertyOptions[] = [];
					for (const m of models) {
						if (!m.input_modalities?.includes('audio') || !m.output_modalities?.includes('text')) continue;
						options.push({
							name: m.name.charAt(0).toUpperCase() + m.name.slice(1).replace(/-/g, ' '),
							value: m.name,
						});
						if (m.aliases) {
							for (const alias of m.aliases) {
								options.push({
									name: alias.charAt(0).toUpperCase() + alias.slice(1).replace(/[-_]/g, ' '),
									value: alias,
								});
							}
						}
					}
					return options.sort((a, b) => a.name.localeCompare(b.name));
				} catch {
					return [];
				}
			},
			async getVoices(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const models = (await this.helpers.httpRequest({
						method: 'GET',
						url: 'https://gen.pollinations.ai/audio/models',
					})) as Array<{ name: string; voices?: string[] }>;

					// Collect all unique voices from all models that have them
					const voiceSet = new Set<string>();
					for (const m of models) {
						if (m.voices) {
							for (const v of m.voices) {
								voiceSet.add(v);
							}
						}
					}

					return Array.from(voiceSet)
						.map((v) => ({
							name: v.charAt(0).toUpperCase() + v.slice(1),
							value: v,
						}))
						.sort((a, b) => a.name.localeCompare(b.name));
				} catch {
					return [];
				}
			},
			async getAudioModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const models = (await this.helpers.httpRequest({
						method: 'GET',
						url: 'https://gen.pollinations.ai/audio/models',
					})) as Array<{ name: string; aliases?: string[]; description?: string; input_modalities?: string[]; output_modalities?: string[]; voices?: string[] }>;

					// TTS models: input text, output audio, exclude music models — include aliases
					const options: INodePropertyOptions[] = [];
					for (const m of models) {
						if (!m.input_modalities?.includes('text') || !m.output_modalities?.includes('audio')) continue;
						const isMusic = m.aliases?.some((a) => a.toLowerCase().includes('music')) || false;
						if (isMusic) continue;
						options.push({
							name: m.name.charAt(0).toUpperCase() + m.name.slice(1).replace(/-/g, ' '),
							value: m.name,
						});
						if (m.aliases) {
							for (const alias of m.aliases) {
								if (alias.toLowerCase().includes('music')) continue;
								options.push({
									name: alias.charAt(0).toUpperCase() + alias.slice(1).replace(/[-_]/g, ' '),
									value: alias,
								});
							}
						}
					}
					return options.sort((a, b) => a.name.localeCompare(b.name));
				} catch {
					return [];
				}
			},
			async getMusicModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const models = (await this.helpers.httpRequest({
						method: 'GET',
						url: 'https://gen.pollinations.ai/audio/models',
					})) as Array<{ name: string; aliases?: string[]; input_modalities?: string[]; output_modalities?: string[]; voices?: string[] }>;

					// Music models: input text, output audio, have "music" in aliases — include aliases
					const musicOptions: INodePropertyOptions[] = [];
					for (const m of models) {
						if (!m.input_modalities?.includes('text') || !m.output_modalities?.includes('audio')) continue;
						const isMusic = m.aliases?.some((a) => a.toLowerCase().includes('music')) || false;
						if (!isMusic) continue;
						musicOptions.push({
							name: m.name.charAt(0).toUpperCase() + m.name.slice(1).replace(/-/g, ' '),
							value: m.name,
						});
						if (m.aliases) {
							for (const alias of m.aliases) {
								musicOptions.push({
									name: alias.charAt(0).toUpperCase() + alias.slice(1).replace(/[-_]/g, ' '),
									value: alias,
								});
							}
						}
					}
					return musicOptions.sort((a, b) => a.name.localeCompare(b.name));
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
					case 'musicGeneration':
						result = await executeMusicGeneration.call(this, itemIndex);
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
					case 'mediaUpload':
						result = await executeMediaUpload.call(this, itemIndex);
						break;
					case 'mediaRetrieve':
						result = await executeMediaRetrieve.call(this, itemIndex);
						break;
					case 'mediaDelete':
						result = await executeMediaDelete.call(this, itemIndex);
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
						json: items[itemIndex].json,
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
