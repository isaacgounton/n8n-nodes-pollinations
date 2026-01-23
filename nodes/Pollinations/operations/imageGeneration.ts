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
				resource: ['image'],
				operation: ['imageGeneration'],
			},
		},
		description: 'Text description of the image to generate',
	},
	{
		displayName: 'Model Name or ID',
		name: 'model',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['imageGeneration'],
			},
		},
		typeOptions: {
			loadOptionsMethod: 'getImageModels',
		},
		default: '',
		description: 'AI model to use for image generation. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Width',
		name: 'width',
		type: 'number',
		displayOptions: {
			show: {
				resource: ['image'],
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
				resource: ['image'],
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
				resource: ['image'],
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
				description: 'URL of input image(s) for image-to-image/edit. Comma/pipe separated for multiple.',
			},
			{
				displayName: 'Negative Prompt',
				name: 'negative_prompt',
				type: 'string',
				default: 'worst quality, blurry',
				description: 'What to avoid in the generated image',
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
				displayName: 'Quality',
				name: 'quality',
				type: 'options',
				options: [
					{ name: 'Low', value: 'low' },
					{ name: 'Medium', value: 'medium' },
					{ name: 'High', value: 'high' },
					{ name: 'HD', value: 'hd' },
				],
				default: 'medium',
				description: 'Image quality level (gptimage only)',
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
				description: 'Whether to generate image with transparent background (gptimage only)',
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
		negative_prompt?: string;
		quality?: string;
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
	if (additionalOptions.negative_prompt) {
		queryParams.negative_prompt = additionalOptions.negative_prompt;
	}
	if (additionalOptions.quality) {
		queryParams.quality = additionalOptions.quality;
	}

	// Get credentials if available
	const headers: Record<string, string> = {};
	const credentials = await this.getCredentials('pollinationsApi');
	if (credentials?.apiKey) {
		headers['Authorization'] = `Bearer ${credentials.apiKey}`;
	} else {
		throw new NodeOperationError(
			this.getNode(),
			'Pollinations API key is required. Please add your credentials.',
			{ itemIndex },
		);
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
		// Try to parse API error response
		let errorMessage = error.message;
		let errorDetails = '';
		
		if (error.response?.body) {
			try {
				const errorBody = typeof error.response.body === 'string' 
					? JSON.parse(error.response.body)
					: error.response.body;
				
				if (errorBody.error?.message) {
					errorMessage = errorBody.error.message;
				}
				if (errorBody.error?.code) {
					errorDetails = ` (${errorBody.error.code})`;
				}
			} catch {
				// If can't parse, show the raw response
				if (typeof error.response.body === 'string') {
					errorDetails = ` - Response: ${error.response.body.substring(0, 200)}`;
				}
			}
		}
		
		// Add status code if available
		if (error.response?.statusCode) {
			errorDetails += ` [HTTP ${error.response.statusCode}]`;
		}
		
		throw new NodeOperationError(
			this.getNode(),
			`Failed to generate image: ${errorMessage}${errorDetails}`,
			{ itemIndex },
		);
	}
}
