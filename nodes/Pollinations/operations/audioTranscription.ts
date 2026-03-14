import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { extractBase64, buildMultipartBody } from '../utils';

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
	{
		displayName: 'Additional Options',
		name: 'transcriptionOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['audio'],
				operation: ['audioTranscription'],
			},
		},
		options: [
			{
				displayName: 'Language',
				name: 'language',
				type: 'string',
				default: '',
				description: 'Language of the audio in ISO-639-1 format (e.g., "en", "fr", "de")',
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				default: '',
				description: 'Optional text to guide the transcription style or provide context',
				typeOptions: {
					rows: 2,
				},
			},
			{
				displayName: 'Temperature',
				name: 'temperature',
				type: 'number',
				default: 0,
				description: 'Sampling temperature between 0 and 1 (lower is more deterministic)',
				typeOptions: {
					minValue: 0,
					maxValue: 1,
					numberPrecision: 1,
				},
			},
		],
	},
];

export async function executeAudioTranscription(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const binaryPropertyName = this.getNodeParameter('binaryProperty', itemIndex) as string;
	const model = this.getNodeParameter('model', itemIndex) as string;
	const options = this.getNodeParameter('transcriptionOptions', itemIndex, {}) as {
		language?: string;
		prompt?: string;
		temperature?: number;
	};

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
	const mimeType = binaryData.mimeType || 'audio/mpeg';

	// Get credentials
	const credentials = await this.getCredentials('pollinationsApi');

	// Convert binary data to base64 then to Buffer for multipart upload
	const audioBase64 = extractBase64(audioData);
	const audioBuffer = Buffer.from(audioBase64, 'base64');

	// Determine file extension from mimeType
	const extMap: Record<string, string> = {
		'audio/mpeg': 'mp3',
		'audio/mp3': 'mp3',
		'audio/wav': 'wav',
		'audio/wave': 'wav',
		'audio/flac': 'flac',
		'audio/opus': 'opus',
		'audio/webm': 'webm',
		'audio/mp4': 'mp4',
		'audio/x-m4a': 'm4a',
		'audio/m4a': 'm4a',
		'video/mp4': 'mp4',
	};
	const ext = extMap[mimeType] || 'mp3';

	// Build multipart/form-data body
	const fields: Record<string, string> = {};
	if (model) fields.model = model;
	if (options.language) fields.language = options.language;
	if (options.prompt) fields.prompt = options.prompt;
	if (options.temperature !== undefined) fields.temperature = options.temperature.toString();

	const { body: multipartBody, contentType } = buildMultipartBody(
		fields,
		{ fieldName: 'file', buffer: audioBuffer, fileName: `audio.${ext}`, mimeType },
	);

	try {
		const response = await this.helpers.httpRequest({
			method: 'POST',
			url: 'https://gen.pollinations.ai/v1/audio/transcriptions',
			headers: {
				Authorization: `Bearer ${credentials.apiKey}`,
				'Content-Type': contentType,
			},
			body: multipartBody,
		});

		const transcription = typeof response === 'string' ? response : (response.text || '');

		return {
			json: {
				transcription,
				model,
				language: response.language || options.language || '',
				duration: response.duration || null,
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
