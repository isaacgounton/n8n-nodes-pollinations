import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export const imageToImageOperation: INodeProperties[] = [
	{
		displayName: 'Binary Property',
		name: 'binaryProperty',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['imageToImage'],
			},
		},
		default: 'data',
		description: 'Name of the binary property containing the source image',
	},
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['imageToImage'],
			},
		},
		default: '',
		required: true,
		description: 'Instructions for how to edit the image',
		typeOptions: {
			rows: 4,
		},
	},
	{
		displayName: 'Model Name or ID',
		name: 'model',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['imageToImage'],
			},
		},
		typeOptions: {
			loadOptionsMethod: 'getImageToImageModels',
		},
		default: '',
		description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
	},
	{
		displayName: 'Negative Prompt',
		name: 'negative_prompt',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['imageToImage'],
			},
		},
		default: 'worst quality, blurry',
		description: 'What to avoid in the generated image',
		typeOptions: {
			rows: 2,
		},
	},
	{
		displayName: 'Seed',
		name: 'seed',
		type: 'number',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['imageToImage'],
			},
		},
		default: -1,
		description: 'Random seed for reproducible results (-1 for random)',
	},
];

export async function executeImageToImage(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const binaryProperty = this.getNodeParameter('binaryProperty', itemIndex) as string;
	const prompt = this.getNodeParameter('prompt', itemIndex) as string;
	const model = this.getNodeParameter('model', itemIndex) as string;
	const negative_prompt = this.getNodeParameter('negative_prompt', itemIndex) as string;
	const seed = this.getNodeParameter('seed', itemIndex) as number;

	// Get binary data from input
	const inputData = this.getInputData();
	const binaryData = inputData[itemIndex].binary?.[binaryProperty];

	if (!binaryData) {
		throw new NodeOperationError(
			this.getNode(),
			`No binary data found in property "${binaryProperty}"`,
			{ itemIndex },
		);
	}

	// Get credentials
	const headers: Record<string, string> = {};
	try {
		const credentials = await this.getCredentials('pollinationsApi');
		if (credentials?.apiKey) {
			headers['Authorization'] = `Bearer ${credentials.apiKey}`;
		}
	} catch {
		throw new NodeOperationError(
			this.getNode(),
			'Pollinations API key is required. Please add your credentials.',
			{ itemIndex },
		);
	}

	// Convert binary data to base64
	let imageBase64: string;
	if (typeof binaryData.data === 'string' && binaryData.data.startsWith('data:')) {
		imageBase64 = binaryData.data.split(',')[1];
	} else if (typeof binaryData.data === 'string') {
		imageBase64 = binaryData.data;
	} else {
		imageBase64 = Buffer.from(binaryData.data as Buffer).toString('base64');
	}

	const mimeType = binaryData.mimeType || 'image/jpeg';
	const imageUrl = `data:${mimeType};base64,${imageBase64}`;

	// Build query parameters
	const queryParams = new URLSearchParams({
		model,
		prompt,
		image: imageUrl,
	});

	if (negative_prompt) queryParams.set('negative_prompt', negative_prompt);
	if (seed !== undefined && seed !== -1) queryParams.set('seed', seed.toString());

	const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?${queryParams.toString()}`;

	try {
		const response = await this.helpers.httpRequest({
			method: 'GET',
			url,
			headers,
			encoding: 'arraybuffer',
			returnFullResponse: true,
		});

		const contentType = response.headers['content-type'] as string;
		const outputMimeType = contentType?.split(';')[0] || 'image/jpeg';
		const fileExtension = outputMimeType.split('/')[1] || 'jpg';

		const imageBuffer = Buffer.from(response.body as ArrayBuffer);

		const binaryDataOutput = await this.helpers.prepareBinaryData(
			imageBuffer,
			`image_edit_${itemIndex}.${fileExtension}`,
			outputMimeType,
		);

		return {
			json: {
				prompt,
				model,
				negative_prompt,
				seed,
				inputImageMimeType: mimeType,
			},
			binary: {
				data: binaryDataOutput,
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
