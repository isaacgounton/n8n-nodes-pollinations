import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export const audioTranscriptionOperation: INodeProperties[] = [
	{
		displayName: 'Binary Property',
		name: 'binaryProperty',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['audio'],
				operation: ['audioTranscription'],
			},
		},
		default: 'data',
		description: 'Name of the binary property containing the audio file',
	},
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['audio'],
				operation: ['audioTranscription'],
			},
		},
		default: 'Transcribe this audio',
		description: 'Instructions for the AI (e.g., "Transcribe this audio", "What language is this?", "Summarize this audio")',
		typeOptions: {
			rows: 2,
		},
	},
	{
		displayName: 'Model Name or ID',
		name: 'model',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['audio'],
				operation: ['audioTranscription'],
			},
		},
		typeOptions: {
			loadOptionsMethod: 'getTranscriptionModels',
		},
		default: '',
		description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
	},
];

export async function executeAudioTranscription(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const binaryPropertyName = this.getNodeParameter('binaryProperty', itemIndex) as string;
	const prompt = this.getNodeParameter('prompt', itemIndex) as string;
	const model = this.getNodeParameter('model', itemIndex) as string;

	// Get binary data from input
	const inputData = this.getInputData();
	const binaryData = inputData[itemIndex].binary?.[binaryPropertyName];

	if (!binaryData) {
		throw new NodeOperationError(
			this.getNode(),
			`No binary data found in property '${binaryPropertyName}'`,
			{ itemIndex },
		);
	}

	const audioData = binaryData.data;
	const mimeType = binaryData.mimeType;

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
	let audioBase64: string;
	if (typeof audioData === 'string') {
		if (audioData.startsWith('data:')) {
			// Remove data URL prefix if present
			audioBase64 = audioData.split(',')[1];
		} else {
			audioBase64 = audioData;
		}
	} else {
		// Assume it's a Buffer
		audioBase64 = Buffer.from(audioData as Buffer).toString('base64');
	}

	// Determine audio format from mimeType
	const formatMap: Record<string, string> = {
		'audio/mpeg': 'mp3',
		'audio/mp3': 'mp3',
		'audio/wav': 'wav',
		'audio/wave': 'wav',
		'audio/flac': 'flac',
		'audio/opus': 'opus',
		'audio/pcm': 'pcm16',
	};

	const format = formatMap[mimeType] || 'mp3';

	// Build request body with system prompt to get clean transcription
	const body = {
		model,
		messages: [
			{
				role: 'system',
				content: 'You are a transcriber. Return ONLY the exact text spoken in the audio, without any introduction, commentary, or formatting. Do not include phrases like "Here is the transcription" or quotes around the text.',
			},
			{
				role: 'user',
				content: [
					{
						type: 'text',
						text: prompt || 'Transcribe this audio exactly as spoken.',
					},
					{
						type: 'input_audio',
						input_audio: {
							data: audioBase64,
							format,
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

		let transcription = response.choices?.[0]?.message?.content;
		if (!transcription) {
			throw new Error('No transcription in response');
		}

		// Post-process: remove common conversational prefixes
		const prefixesToRemove = [
			/^Here is the transcription[^:]*:\s*/i,
			/^The transcription is:\s*/i,
			/^Transcription:\s*/i,
			/^Audio transcription:\s*/i,
			/^Text:\s*/i,
			/^["'']|["'']$/g, // Remove surrounding quotes
		];

		for (const prefix of prefixesToRemove) {
			transcription = transcription.replace(prefix, '');
		}

		transcription = transcription.trim();

		return {
			json: {
				transcription,
				model,
				prompt,
				audioFormat: format,
			},
			pairedItem: { item: itemIndex },
		};
	} catch (error) {
		throw new NodeOperationError(
			this.getNode(),
			`Failed to transcribe audio: ${error.message}`,
			{ itemIndex },
		);
	}
}
