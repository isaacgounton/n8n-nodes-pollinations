import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { sanitizePromptForUrl } from '../utils';

export const musicGenerationOperation: INodeProperties[] = [
	{
		displayName: 'Prompt',
		name: 'musicPrompt',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['audio'],
				operation: ['musicGeneration'],
			},
		},
		description: 'Description of the music to generate (e.g., "upbeat jazz piano")',
		typeOptions: {
			rows: 3,
		},
	},
	{
		displayName: 'Model Name or ID',
		name: 'musicModel',
		type: 'options',
		displayOptions: {
			show: {
				resource: ['audio'],
				operation: ['musicGeneration'],
			},
		},
		typeOptions: {
			loadOptionsMethod: 'getMusicModels',
		},
		default: '',
		description: 'AI model to use for music generation. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Additional Options',
		name: 'musicOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['audio'],
				operation: ['musicGeneration'],
			},
		},
		options: [
			{
				displayName: 'Duration (Seconds)',
				name: 'duration',
				type: 'number',
				default: 30,
				description: 'Duration of the generated music in seconds',
				typeOptions: {
					minValue: 1,
					maxValue: 300,
				},
			},
			{
				displayName: 'Audio Format',
				name: 'response_format',
				type: 'options',
				options: [
					{ name: 'AAC', value: 'aac' },
					{ name: 'FLAC', value: 'flac' },
					{ name: 'MP3', value: 'mp3' },
					{ name: 'Opus', value: 'opus' },
					{ name: 'WAV', value: 'wav' },
				],
				default: 'mp3',
				description: 'Audio output format',
			},
			{
				displayName: 'Instrumental Only',
				name: 'instrumental',
				type: 'boolean',
				default: true,
				description: 'Whether to generate instrumental-only music (no vocals)',
			},
			{
				displayName: 'Voice',
				name: 'voice',
				type: 'string',
				default: '',
				description: 'Voice to use if generating music with vocals (model-dependent)',
			},
		],
	},
];

export async function executeMusicGeneration(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const prompt = this.getNodeParameter('musicPrompt', itemIndex) as string;
	const model = this.getNodeParameter('musicModel', itemIndex, '') as string;
	const options = this.getNodeParameter('musicOptions', itemIndex, {}) as {
		duration?: number;
		response_format?: string;
		instrumental?: boolean;
		voice?: string;
	};

	const format = options.response_format || 'mp3';

	// Get credentials
	const credentials = await this.getCredentials('pollinationsApi');
	const headers: Record<string, string> = {
		Authorization: `Bearer ${credentials.apiKey}`,
	};

	// Build query parameters for the /audio/{text} endpoint with music params
	const queryParams: Record<string, string> = {
		response_format: format,
	};

	if (model) queryParams.model = model;
	if (options.duration) queryParams.duration = options.duration.toString();
	if (options.instrumental !== false) queryParams.instrumental = 'true';
	if (options.voice) queryParams.voice = options.voice;

	const sanitizedPrompt = sanitizePromptForUrl(prompt);
	const queryString = new URLSearchParams(queryParams).toString();
	const url = `https://gen.pollinations.ai/audio/${encodeURIComponent(sanitizedPrompt)}?${queryString}`;

	try {
		const response = await this.helpers.httpRequest({
			method: 'GET',
			url,
			headers,
			encoding: 'arraybuffer',
			returnFullResponse: true,
			timeout: 300000, // 5 min timeout for music generation
		});

		const contentType = response.headers['content-type'] as string;
		const mimeType = contentType?.split(';')[0] || `audio/${format}`;

		const mimeTypeMap: Record<string, string> = {
			mp3: 'audio/mpeg',
			wav: 'audio/wav',
			flac: 'audio/flac',
			opus: 'audio/opus',
			aac: 'audio/aac',
		};
		const finalMimeType = mimeType !== `audio/${format}` ? mimeType : (mimeTypeMap[format] || `audio/${format}`);

		const binaryData = await this.helpers.prepareBinaryData(
			Buffer.from(response.body as ArrayBuffer),
			`music_${itemIndex}.${format}`,
			finalMimeType,
		);

		return {
			json: {
				prompt,
				model,
				duration: options.duration || 30,
				format,
				instrumental: options.instrumental !== false,
			},
			binary: {
				data: binaryData,
			},
			pairedItem: { item: itemIndex },
		};
	} catch (error) {
		throw new NodeOperationError(
			this.getNode(),
			`Failed to generate music: ${error.message}`,
			{ itemIndex },
		);
	}
}
