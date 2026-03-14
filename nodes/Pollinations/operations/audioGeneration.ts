import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { sanitizePromptForUrl } from '../utils';

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
		displayName: 'Model Name or ID',
		name: 'audioModel',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['audio'],
				operation: ['audioGeneration'],
			},
		},
		typeOptions: {
			loadOptionsMethod: 'getAudioModels',
		},
		default: '',
		description: 'AI model to use for speech. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Voice Name or ID',
		name: 'voice',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['audio'],
				operation: ['audioGeneration'],
			},
		},
		typeOptions: {
			loadOptionsMethod: 'getVoices',
		},
		default: '',
		description: 'Voice to use for TTS. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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
			{ name: 'AAC', value: 'aac' },
			{ name: 'FLAC', value: 'flac' },
			{ name: 'MP3', value: 'mp3' },
			{ name: 'Opus', value: 'opus' },
			{ name: 'PCM', value: 'pcm' },
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
	const model = this.getNodeParameter('audioModel', itemIndex, '') as string;
	const voice = this.getNodeParameter('voice', itemIndex) as string;
	const format = this.getNodeParameter('audioFormat', itemIndex) as string;

	// Get credentials
	const credentials = await this.getCredentials('pollinationsApi');
	const headers: Record<string, string> = {
		Authorization: `Bearer ${credentials.apiKey}`,
	};

	// Build query parameters for the dedicated /audio/{text} endpoint
	const queryParams: Record<string, string> = {
		voice,
		response_format: format,
	};

	if (model) queryParams.model = model;

	const sanitizedText = sanitizePromptForUrl(text);
	const queryString = new URLSearchParams(queryParams).toString();
	const url = `https://gen.pollinations.ai/audio/${encodeURIComponent(sanitizedText)}?${queryString}`;

	try {
		const response = await this.helpers.httpRequest({
			method: 'GET',
			url,
			headers,
			encoding: 'arraybuffer',
			returnFullResponse: true,
		});

		const contentType = response.headers['content-type'] as string;
		const mimeType = contentType?.split(';')[0] || `audio/${format}`;

		// Map format to correct MIME type for fallback
		const mimeTypeMap: Record<string, string> = {
			mp3: 'audio/mpeg',
			wav: 'audio/wav',
			flac: 'audio/flac',
			opus: 'audio/opus',
			pcm: 'audio/pcm',
			aac: 'audio/aac',
		};
		const finalMimeType = mimeType !== `audio/${format}` ? mimeType : (mimeTypeMap[format] || `audio/${format}`);

		const binaryData = await this.helpers.prepareBinaryData(
			Buffer.from(response.body as ArrayBuffer),
			`audio_${itemIndex}.${format}`,
			finalMimeType,
		);

		return {
			json: {
				text,
				model,
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
