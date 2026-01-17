import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export const imageGenerationOperation: INodeProperties[] = [
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				operation: ['imageGeneration'],
			},
		},
		description: 'Text description of the image to generate',
	},
	{
		displayName: 'Model',
		name: 'model',
		type: 'options',
		displayOptions: {
			show: {
				operation: ['imageGeneration'],
			},
		},
		options: [
			{
				name: 'Flux (Default)',
				value: 'flux',
				description: 'High-quality image generation',
			},
			{
				name: 'GPT Image',
				value: 'gptimage',
				description: 'GPT-powered image generation',
			},
			{
				name: 'Kontext',
				value: 'kontext',
				description: 'Supports image-to-image transformation',
			},
			{
				name: 'Nanobanana',
				value: 'nanobanana',
				description: 'Lightweight model',
			},
			{
				name: 'Nanobanana Pro',
				value: 'nanobanana-pro',
				description: 'Enhanced lightweight model',
			},
			{
				name: 'Seedream',
				value: 'seedream',
				description: 'Creative image generation',
			},
			{
				name: 'Turbo',
				value: 'turbo',
				description: 'Fast image generation',
			},
		],
		default: 'flux',
		description: 'AI model to use for image generation',
	},
	{
		displayName: 'Width',
		name: 'width',
		type: 'number',
		displayOptions: {
			show: {
				operation: ['imageGeneration'],
			},
		},
		default: 1024,
		description: 'Image width in pixels (16-2048)',
		typeOptions: {
			minValue: 16,
			maxValue: 2048,
		},
	},
	{
		displayName: 'Height',
		name: 'height',
		type: 'number',
		displayOptions: {
			show: {
				operation: ['imageGeneration'],
			},
		},
		default: 1024,
		description: 'Image height in pixels (16-2048)',
		typeOptions: {
			minValue: 16,
			maxValue: 2048,
		},
	},
	{
		displayName: 'Additional Options',
		name: 'additionalOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				operation: ['imageGeneration'],
			},
		},
		options: [
			{
				displayName: 'Enhance Prompt',
				name: 'enhance',
				type: 'boolean',
				default: false,
				description: 'Whether to use AI to improve the prompt',
			},
			{
				displayName: 'Image Count',
				name: 'count',
				type: 'number',
				default: 1,
				description: 'Number of images to generate (1-4, premium models only)',
				typeOptions: {
					minValue: 1,
					maxValue: 4,
				},
			},
			{
				displayName: 'Input Image URL',
				name: 'imageUrl',
				type: 'string',
				default: '',
				description: 'URL of input image for image-to-image transformation (kontext model)',
			},
			{
				displayName: 'No Logo',
				name: 'nologo',
				type: 'boolean',
				default: false,
				description: 'Whether to remove the Pollinations logo from the image',
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
			{
				displayName: 'Transparent Background',
				name: 'transparent',
				type: 'boolean',
				default: false,
				description: 'Whether to generate image with transparent background',
			},
		],
	},
];

export async function executeImageGeneration(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const prompt = this.getNodeParameter('prompt', itemIndex) as string;
	const model = this.getNodeParameter('model', itemIndex) as string;
	const width = this.getNodeParameter('width', itemIndex) as number;
	const height = this.getNodeParameter('height', itemIndex) as number;
	const additionalOptions = this.getNodeParameter('additionalOptions', itemIndex, {}) as {
		seed?: number;
		nologo?: boolean;
		private?: boolean;
		safe?: boolean;
		enhance?: boolean;
		transparent?: boolean;
		count?: number;
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
	if (additionalOptions.nologo) queryParams.nologo = 'true';
	if (additionalOptions.private) queryParams.private = 'true';
	if (additionalOptions.safe) queryParams.safe = 'true';
	if (additionalOptions.enhance) queryParams.enhance = 'true';
	if (additionalOptions.transparent) queryParams.transparent = 'true';
	if (additionalOptions.count && additionalOptions.count > 1) {
		queryParams.count = additionalOptions.count.toString();
	}
	if (additionalOptions.imageUrl) {
		queryParams.image = additionalOptions.imageUrl;
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
		const mimeType = contentType?.split(';')[0] || 'image/jpeg';
		const fileExtension = mimeType.split('/')[1] || 'jpg';

		const binaryData = await this.helpers.prepareBinaryData(
			Buffer.from(response.body as ArrayBuffer),
			`image_${itemIndex}.${fileExtension}`,
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
			`Failed to generate image: ${error.message}`,
			{ itemIndex },
		);
	}
}
