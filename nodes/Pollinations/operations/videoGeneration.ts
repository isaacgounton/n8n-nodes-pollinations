import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export const videoGenerationOperation: INodeProperties[] = [
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				operation: ['videoGeneration'],
			},
		},
		description: 'Text description of the video to generate',
	},
	{
		displayName: 'Model',
		name: 'videoModel',
		type: 'options',
		displayOptions: {
			show: {
				operation: ['videoGeneration'],
			},
		},
		options: [
			{
				name: 'Veo',
				value: 'veo',
				description: 'Text-to-video (4-8 seconds)',
			},
			{
				name: 'Seedance',
				value: 'seedance',
				description: 'Text-to-video and image-to-video (2-10 seconds)',
			},
		],
		default: 'veo',
		description: 'AI model to use for video generation',
	},
	{
		displayName: 'Width',
		name: 'width',
		type: 'number',
		displayOptions: {
			show: {
				operation: ['videoGeneration'],
			},
		},
		default: 1024,
		description: 'Video width in pixels',
		typeOptions: {
			minValue: 256,
			maxValue: 2048,
		},
	},
	{
		displayName: 'Height',
		name: 'height',
		type: 'number',
		displayOptions: {
			show: {
				operation: ['videoGeneration'],
			},
		},
		default: 576,
		description: 'Video height in pixels',
		typeOptions: {
			minValue: 256,
			maxValue: 2048,
		},
	},
	{
		displayName: 'Additional Options',
		name: 'videoAdditionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				operation: ['videoGeneration'],
			},
		},
		options: [
			{
				displayName: 'Seed',
				name: 'seed',
				type: 'number',
				default: -1,
				description: 'Random seed for reproducible results (-1 for random)',
			},
			{
				displayName: 'Private',
				name: 'private',
				type: 'boolean',
				default: false,
				description: 'Whether to keep the generation private',
			},
			{
				displayName: 'Input Image URL',
				name: 'imageUrl',
				type: 'string',
				default: '',
				description: 'URL of input image for image-to-video (seedance model)',
			},
		],
	},
];

export async function executeVideoGeneration(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const prompt = this.getNodeParameter('prompt', itemIndex) as string;
	const model = this.getNodeParameter('videoModel', itemIndex) as string;
	const width = this.getNodeParameter('width', itemIndex) as number;
	const height = this.getNodeParameter('height', itemIndex) as number;
	const additionalOptions = this.getNodeParameter('videoAdditionalOptions', itemIndex, {}) as {
		seed?: number;
		private?: boolean;
		imageUrl?: string;
	};

	// Build query parameters
	const queryParams: Record<string, string> = {
		model,
		width: width.toString(),
		height: height.toString(),
	};

	if (additionalOptions.seed !== undefined && additionalOptions.seed !== -1) {
		queryParams.seed = additionalOptions.seed.toString();
	}
	if (additionalOptions.private) queryParams.private = 'true';
	if (additionalOptions.imageUrl) {
		queryParams.image = additionalOptions.imageUrl;
	}

	// Get credentials if available
	let headers: Record<string, string> = {};
	try {
		const credentials = await this.getCredentials('pollinationsApi');
		if (credentials?.apiKey) {
			headers['Authorization'] = `Bearer ${credentials.apiKey}`;
		}
	} catch (error) {
		// Credentials are optional, continue without them
	}

	// Build URL with query parameters
	const queryString = new URLSearchParams(queryParams).toString();
	const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?${queryString}`;

	try {
		const response = await this.helpers.httpRequest({
			method: 'GET',
			url,
			headers,
			encoding: 'arraybuffer',
			returnFullResponse: true,
		});

		const contentType = response.headers['content-type'] as string;
		const mimeType = contentType?.split(';')[0] || 'video/mp4';
		const fileExtension = mimeType.split('/')[1] || 'mp4';

		const binaryData = await this.helpers.prepareBinaryData(
			Buffer.from(response.body as ArrayBuffer),
			`video_${itemIndex}.${fileExtension}`,
			mimeType,
		);

		return {
			json: {
				prompt,
				model,
				width,
				height,
				...additionalOptions,
			},
			binary: {
				data: binaryData,
			},
			pairedItem: { item: itemIndex },
		};
	} catch (error) {
		throw new NodeOperationError(
			this.getNode(),
			`Failed to generate video: ${error.message}`,
			{ itemIndex },
		);
	}
}
