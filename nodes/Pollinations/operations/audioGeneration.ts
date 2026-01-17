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
				operation: ['audioGeneration'],
			},
		},
		options: [
			{ name: 'Alloy', value: 'alloy' },
			{ name: 'Echo', value: 'echo' },
			{ name: 'Fable', value: 'fable' },
			{ name: 'Onyx', value: 'onyx' },
			{ name: 'Nova', value: 'nova' },
			{ name: 'Shimmer', value: 'shimmer' },
			{ name: 'Coral', value: 'coral' },
			{ name: 'Verse', value: 'verse' },
			{ name: 'Ballad', value: 'ballad' },
			{ name: 'Ash', value: 'ash' },
			{ name: 'Sage', value: 'sage' },
			{ name: 'Amuch', value: 'amuch' },
			{ name: 'Dan', value: 'dan' },
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
				operation: ['audioGeneration'],
			},
		},
		options: [
			{ name: 'WAV', value: 'wav' },
			{ name: 'MP3', value: 'mp3' },
			{ name: 'FLAC', value: 'flac' },
			{ name: 'Opus', value: 'opus' },
			{ name: 'PCM16', value: 'pcm16' },
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
	let headers: Record<string, string> = { 'Content-Type': 'application/json' };
	try {
		const credentials = await this.getCredentials('pollinationsApi');
		if (credentials?.apiKey) {
			headers['Authorization'] = `Bearer ${credentials.apiKey}`;
		}
	} catch (error) {
		// Credentials are optional, continue without them
	}

	const body = {
		model: 'openai-audio',
		messages: [
			{
				role: 'user',
				content: text,
			},
		],
		modalities: ['text', 'audio'],
		audio: {
			voice,
			format,
		},
	};

	try {
		const response = await this.helpers.httpRequest({
			method: 'POST',
			url: 'https://gen.pollinations.ai/v1/chat/completions',
			headers,
			body,
		});

		// Extract audio data from response
		const audioData = response.choices?.[0]?.message?.audio?.data;
		if (!audioData) {
			throw new Error('No audio data in response');
		}

		// Convert base64 audio to binary
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
				transcript: response.choices?.[0]?.message?.audio?.transcript || text,
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
