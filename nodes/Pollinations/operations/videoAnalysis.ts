import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export const videoAnalysisOperation: INodeProperties[] = [
	{
		displayName: 'Binary Property',
		name: 'binaryProperty',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['video'],
				operation: ['videoAnalysis'],
			},
		},
		default: 'data',
		description: 'Name of the binary property containing the video file',
	},
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['video'],
				operation: ['videoAnalysis'],
			},
		},
		default: 'Describe this video in detail',
		description: 'What would you like to know about the video?',
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
				resource: ['video'],
				operation: ['videoAnalysis'],
			},
		},
		typeOptions: {
			loadOptionsMethod: 'getVideoAnalysisModels',
		},
		default: '',
		description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
	},
];

export async function executeVideoAnalysis(
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
	let videoBase64: string;
	if (typeof binaryData.data === 'string' && binaryData.data.startsWith('data:')) {
		videoBase64 = binaryData.data.split(',')[1];
	} else if (typeof binaryData.data === 'string') {
		videoBase64 = binaryData.data;
	} else {
		videoBase64 = Buffer.from(binaryData.data as Buffer).toString('base64');
	}

	const mimeType = binaryData.mimeType || 'video/mp4';

	// Build request body with input_video format
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
						type: 'input_video',
						input_video: {
							data: videoBase64,
							format: mimeType.split('/')[1] || 'mp4',
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
				videoMimeType: mimeType,
			},
			pairedItem: { item: itemIndex },
		};
	} catch (error) {
		throw new NodeOperationError(
			this.getNode(),
			`Failed to analyze video: ${error.message}`,
			{ itemIndex },
		);
	}
}
