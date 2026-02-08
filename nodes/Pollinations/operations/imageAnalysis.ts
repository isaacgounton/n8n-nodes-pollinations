import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { extractBase64 } from '../utils';

export const imageAnalysisOperation: INodeProperties[] = [
	{
		displayName: 'Binary Property',
		name: 'binaryProperty',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['image'],
				operation: ['imageAnalysis'],
			},
		},
		default: 'data',
		description: 'Name of the binary property containing the image file',
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
	const binaryProperty = this.getNodeParameter('binaryProperty', itemIndex) as string;
	const prompt = this.getNodeParameter('prompt', itemIndex) as string;
	const model = this.getNodeParameter('model', itemIndex) as string;

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
	const credentials = await this.getCredentials('pollinationsApi');
	const headers: Record<string, string> = {
		Authorization: `Bearer ${credentials.apiKey}`,
		'Content-Type': 'application/json',
	};

	// Convert binary data to base64
	const imageBase64 = extractBase64(binaryData.data);

	const mimeType = binaryData.mimeType || 'image/jpeg';

	// Build request body with image_url format for vision
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
