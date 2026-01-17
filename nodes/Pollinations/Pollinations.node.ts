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
				required: false,
				displayOptions: {
					show: {
						'@version': [1],
					},
				},
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
			},
			async getVideoModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
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
			},
			async getTextModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const response = (await this.helpers.httpRequest({
					method: 'GET',
					url: 'https://gen.pollinations.ai/v1/models',
				})) as { data: Array<{ id: string }> };

				return response.data
					.map((m) => ({
						name: m.id.charAt(0).toUpperCase() + m.id.slice(1).replace(/-/g, ' '),
						value: m.id,
					}))
					.sort((a, b) => a.name.localeCompare(b.name));
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
