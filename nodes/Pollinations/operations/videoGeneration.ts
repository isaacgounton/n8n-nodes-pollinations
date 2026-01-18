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
		typeOptions: {
			loadOptionsMethod: 'getVideoModels',
		},
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
				displayName: 'Aspect Ratio',
				name: 'aspectRatio',
				type: 'options',
				options: [
					{ name: '16:9', value: '16:9' },
					{ name: '9:16', value: '9:16' },
				],
				default: '16:9',
				description: 'Video aspect ratio (veo, seedance)',
			},
			{
				displayName: 'Duration (Seconds)',
				name: 'duration',
				type: 'number',
				default: 4,
				description: 'Video duration in seconds (veo: 4, 6, 8; seedance: 2-10)',
				typeOptions: {
					minValue: 1,
					maxValue: 10,
				},
			},
			{
				displayName: 'Enable Audio',
				name: 'audio',
				type: 'boolean',
				default: false,
				description: 'Whether to enable audio generation for video (veo only)',
			},
			{
				displayName: 'Input Image URL',
				name: 'imageUrl',
				type: 'string',
				default: '',
				description: 'URL of input image(s). For veo: image[0]=first frame, image[1]=last frame (interpolation).',
			},
			{
				displayName: 'Negative Prompt',
				name: 'negative_prompt',
				type: 'string',
				default: 'worst quality, blurry',
				description: 'What to avoid in the generated video',
			},
			{
				displayName: 'Private',
				name: 'private',
				type: 'boolean',
				default: false,
				description: 'Whether to keep the generation private',
			},
			{
				displayName: 'Safe Mode',
				name: 'safe',
				type: 'boolean',
				default: false,
				description: 'Whether to enable strict NSFW content filtering',
			},
			{
				displayName: 'Seed',
				name: 'seed',
				type: 'number',
				default: -1,
				description: 'Random seed for reproducible results (-1 for random)',
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
		duration?: number;
		aspectRatio?: string;
		audio?: boolean;
		negative_prompt?: string;
		safe?: boolean;
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
	if (additionalOptions.duration) {
		queryParams.duration = additionalOptions.duration.toString();
	}
	if (additionalOptions.aspectRatio) {
		queryParams.aspectRatio = additionalOptions.aspectRatio;
	}
	if (additionalOptions.audio) {
		queryParams.audio = 'true';
	}
	if (additionalOptions.negative_prompt) {
		queryParams.negative_prompt = additionalOptions.negative_prompt;
	}
	if (additionalOptions.safe) {
		queryParams.safe = 'true';
	}

	// Get credentials if available
	const headers: Record<string, string> = {};
	try {
		const credentials = await this.getCredentials('pollinationsApi');
		if (credentials?.apiKey) {
			headers['Authorization'] = `Bearer ${credentials.apiKey}`;
		}
	} catch {
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
