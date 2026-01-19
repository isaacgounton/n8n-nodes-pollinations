import { DynamicStructuredTool } from '@langchain/core/tools';
import type {
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	SupplyData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { z } from 'zod';

async function getTool(ctx: ISupplyDataFunctions, itemIndex: number) {
	// itemIndex parameter kept for consistency with n8n patterns
	// Get credentials if available
	let apiKey = '';
	try {
		const credentials = await ctx.getCredentials('pollinationsApi');
		if (credentials?.apiKey) {
			apiKey = credentials.apiKey as string;
		}
	} catch {
		// Credentials are optional
	}

	const audioGenerationTool = new DynamicStructuredTool({
		name: 'generate_audio',
		description: 'Generate audio/speech from text using text-to-speech AI. Supports multiple voices (alloy, echo, fable, nova, shimmer, etc.) and various audio formats (mp3, wav, opus, flac).',
		schema: z.object({
			text: z.string().describe('Text to convert to speech'),
			voice: z.string().optional().describe('Voice to use (alloy, echo, fable, onyx, nova, shimmer, ash, ballad, coral, sage, verse, dan, amuch). Default: alloy'),
			format: z.string().optional().describe('Audio output format (mp3, wav, opus, flac, pcm16). Default: mp3'),
		}),
		func: async ({ text, voice, format }) => {
			const headers: Record<string, string> = { 'Content-Type': 'application/json' };
			if (apiKey) {
				headers['Authorization'] = `Bearer ${apiKey}`;
			}

			const requestBody = {
				input: text,
				voice: voice || 'alloy',
				response_format: format || 'mp3',
			};

			try {
				const response = await fetch('https://gen.pollinations.ai/v1/audio/speech', {
					method: 'POST',
					headers,
					body: JSON.stringify(requestBody),
				});

				if (!response.ok) {
					const errorText = await response.text();
				throw new NodeOperationError(ctx.getNode(), `HTTP error! status: ${response.status}, message: ${errorText}`);
			}

				const audioBuffer = await response.arrayBuffer();
				const base64Audio = Buffer.from(audioBuffer).toString('base64');
				const mimeType = format === 'mp3' ? 'audio/mpeg' : `audio/${format || 'mp3'}`;

				return JSON.stringify({
					success: true,
					audio_data: `data:${mimeType};base64,${base64Audio}`,
					voice: voice || 'alloy',
					format: format || 'mp3',
					text,
				});
			} catch (error) {
				return JSON.stringify({
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error',
					text,
				});
			}
		},
	});

	return audioGenerationTool;
}

export class ToolPollinationsAudio implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pollinations Audio Generation',
		name: 'toolPollinationsAudio',
		icon: 'file:pollinations.svg',
		group: ['transform'],
		version: 1,
		description: 'Generate audio/speech using Pollinations.ai',
		defaults: {
			name: 'Pollinations Audio',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Tools'],
			},
		},
		inputs: [],
		outputs: [NodeConnectionTypes.AiTool],
		outputNames: ['Tool'],
		usableAsTool: true,
		credentials: [
			{
				name: 'pollinationsApi',
				required: false,
			},
		],
		properties: [
			{
				displayName: 'Info',
				name: 'notice',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						'@version': [1],
					},
				},
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		return {
			response: await getTool(this, itemIndex),
		};
	}
}
