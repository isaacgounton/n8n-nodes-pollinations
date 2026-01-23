import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export const audioGenerationOperation: INodeProperties[] = [
	{
		displayName: 'Text',
		name: 'audioText',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['audio'],
				operation: ['audioGeneration'],
			},
		},
		description: 'Text to convert to speech',
		typeOptions: {
			rows: 4,
		},
	},
	{
		displayName: 'Voice',
		name: 'voice',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['audio'],
				operation: ['audioGeneration'],
			},
		},
		options: [
			{ name: 'Alloy', value: 'alloy' },
			{ name: 'Amuch', value: 'amuch' },
			{ name: 'Ash', value: 'ash' },
			{ name: 'Ballad', value: 'ballad' },
			{ name: 'Coral', value: 'coral' },
			{ name: 'Dan', value: 'dan' },
			{ name: 'Echo', value: 'echo' },
			{ name: 'Fable', value: 'fable' },
			{ name: 'Nova', value: 'nova' },
			{ name: 'Onyx', value: 'onyx' },
			{ name: 'Sage', value: 'sage' },
			{ name: 'Shimmer', value: 'shimmer' },
			{ name: 'Verse', value: 'verse' },
		],
		default: 'alloy',
		description: 'Voice to use for text-to-speech',
	},
	{
		displayName: 'Audio Format',
		name: 'audioFormat',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['audio'],
				operation: ['audioGeneration'],
			},
		},
		options: [
			{ name: 'FLAC', value: 'flac' },
			{ name: 'MP3', value: 'mp3' },
			{ name: 'Opus', value: 'opus' },
			{ name: 'PCM16', value: 'pcm16' },
			{ name: 'WAV', value: 'wav' },
		],
		default: 'mp3',
		description: 'Audio output format',
	},
];

export async function executeAudioGeneration(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const text = this.getNodeParameter('audioText', itemIndex) as string;
	const voice = this.getNodeParameter('voice', itemIndex) as string;
	const format = this.getNodeParameter('audioFormat', itemIndex) as string;

	// Get credentials if available
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	try {
		const credentials = await this.getCredentials('pollinationsApi');
		if (credentials?.apiKey) {
			headers['Authorization'] = `Bearer ${credentials.apiKey}`;
		}
	} catch {
		// Credentials are optional, continue without them
	}

	// Build request body for TTS using chat completions
	// Note: openai-audio is a chat model, not pure TTS. Using "Say:" prefix to make it read text verbatim.
	const body = {
		model: 'openai-audio',
		messages: [
			{
				role: 'system',
				content: 'You are a text reader. Read the user text exactly without responding, adding conversation, or changing anything.',
			},
			{
				role: 'user',
				content: `Say: ${text}`,
			},
		],
		modalities: ['text', 'audio'],
		audio: {
			voice,
			format,
		},
	};

	try {
		// Use chat completions endpoint with system prompt for direct TTS
		const response = await this.helpers.httpRequest({
			method: 'POST',
			url: 'https://gen.pollinations.ai/v1/chat/completions',
			headers,
			body,
			json: true,
		});

		// Extract audio data from response
		const audioData = response.choices?.[0]?.message?.audio?.data;
		if (!audioData) {
			throw new Error('No audio data in response');
		}

		const audioBuffer = Buffer.from(audioData, 'base64');

		const binaryData = await this.helpers.prepareBinaryData(
			audioBuffer,
			`audio_${itemIndex}.${format}`,
			`audio/${format}`,
		);

		return {
			json: {
				text,
				voice,
				format,
			},
			binary: {
				data: binaryData,
			},
			pairedItem: { item: itemIndex },
		};
	} catch (error) {
		throw new NodeOperationError(
			this.getNode(),
			`Failed to generate audio: ${error.message}`,
			{ itemIndex },
		);
	}
}
