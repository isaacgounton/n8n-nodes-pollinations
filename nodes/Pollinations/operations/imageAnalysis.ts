import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export const imageAnalysisOperation: INodeProperties[] = [
	{
		displayName: 'Image Input',
		name: 'imageInput',
		type: 'resourceMapper',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['imageAnalysis'],
			},
		},
		default: {
			mode: 'list',
			value: null,
		},
		required: true,
		description: 'Image file to analyze',
		typeOptions: {
			resourceMapper: {
				resourceMapperMethod: 'getImageInput',
				mode: 'map',
			},
		},
	},
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['imageAnalysis'],
			},
		},
		default: 'Describe this image in detail',
		description: 'What would you like to know about the image?',
		typeOptions: {
			rows: 3,
		},
	},
	{
		displayName: 'Model Name or ID',
		name: 'model',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['imageAnalysis'],
			},
		},
		typeOptions: {
			loadOptionsMethod: 'getVisionModels',
		},
		default: '',
		description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
	},
];

export async function executeImageAnalysis(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const imageInput = this.getNodeParameter('imageInput', itemIndex) as { data: string; mimeType: string };
	const prompt = this.getNodeParameter('prompt', itemIndex) as string;
	const model = this.getNodeParameter('model', itemIndex) as string;

	// Get credentials
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
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
	if (typeof imageInput.data === 'string' && imageInput.data.startsWith('data:')) {
		imageBase64 = imageInput.data.split(',')[1];
	} else if (typeof imageInput.data === 'string') {
		imageBase64 = imageInput.data;
	} else {
		imageBase64 = Buffer.from(imageInput.data as Buffer).toString('base64');
	}

	// Determine MIME type
	const mimeType = imageInput.mimeType || 'image/jpeg';

	// Build request body with image_url format
	const body = {
		model,
		messages: [
			{
				role: 'user',
				content: [
					{
						type: 'text',
						text: prompt,
					},
					{
						type: 'image_url',
						image_url: {
							url: `data:${mimeType};base64,${imageBase64}`,
						},
					},
				],
			},
		],
	};

	try {
		const response = await this.helpers.httpRequest({
			method: 'POST',
			url: 'https://gen.pollinations.ai/v1/chat/completions',
			headers,
			body,
			json: true,
		});

		const analysis = response.choices?.[0]?.message?.content;
		if (!analysis) {
			throw new Error('No analysis in response');
		}

		return {
			json: {
				analysis,
				model,
				prompt,
				imageMimeType: mimeType,
			},
			pairedItem: { item: itemIndex },
		};
	} catch (error) {
		throw new NodeOperationError(
			this.getNode(),
			`Failed to analyze image: ${error.message}`,
			{ itemIndex },
		);
	}
}
