import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { extractBase64 } from '../utils';

export const videoAnalysisOperation: INodeProperties[] = [
	{
		displayName: 'Input Source',
		name: 'inputSource',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['video'],
				operation: ['videoAnalysis'],
			},
		},
		options: [
			{
				name: 'Binary Property',
				value: 'binary',
			},
			{
				name: 'Video URL',
				value: 'url',
			},
		],
		default: 'binary',
		description: 'How to provide the video file',
	},
	{
		displayName: 'Binary Property',
		name: 'binaryProperty',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['video'],
				operation: ['videoAnalysis'],
				inputSource: ['binary'],
			},
		},
		default: 'data',
		description: 'Name of the binary property containing the video file',
	},
	{
		displayName: 'Video URL',
		name: 'videoUrl',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['video'],
				operation: ['videoAnalysis'],
				inputSource: ['url'],
			},
		},
		default: '',
		description: 'URL of the video file to analyze (more reliable than binary upload for large videos)',
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
	const inputSource = this.getNodeParameter('inputSource', itemIndex) as string;
	const prompt = this.getNodeParameter('prompt', itemIndex) as string;
	const model = this.getNodeParameter('model', itemIndex) as string;

	// Get credentials
	const credentials = await this.getCredentials('pollinationsApi');
	const headers: Record<string, string> = {
		Authorization: `Bearer ${credentials.apiKey}`,
		'Content-Type': 'application/json',
	};

	// Build content array based on input source
	const content: Array<{ type: string; text?: string; video_url?: { url: string }; input_video?: { data: string; format: string } }> = [
		{
			type: 'text',
			text: prompt,
		},
	];

	if (inputSource === 'url') {
		// Use video URL (more reliable for large videos)
		const videoUrl = this.getNodeParameter('videoUrl', itemIndex) as string;
		if (!videoUrl) {
			throw new NodeOperationError(
				this.getNode(),
				'Video URL is required when using URL input source',
				{ itemIndex },
			);
		}
		content.push({
			type: 'video_url',
			video_url: {
				url: videoUrl,
			},
		});
	} else {
		// Use binary upload (may have issues with large videos)
		const binaryProperty = this.getNodeParameter('binaryProperty', itemIndex) as string;
		const inputData = this.getInputData();
		const binaryData = inputData[itemIndex].binary?.[binaryProperty];

		if (!binaryData) {
			throw new NodeOperationError(
				this.getNode(),
				`No binary data found in property "${binaryProperty}"`,
				{ itemIndex },
			);
		}

		// Convert binary data to base64
		const videoBase64 = extractBase64(binaryData.data);

		const mimeType = binaryData.mimeType || 'video/mp4';

		content.push({
			type: 'input_video',
			input_video: {
				data: videoBase64,
				format: mimeType.split('/')[1] || 'mp4',
			},
		});
	}

	// Build request body
	const body = {
		model,
		messages: [
			{
				role: 'user',
				content,
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
				inputSource,
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
