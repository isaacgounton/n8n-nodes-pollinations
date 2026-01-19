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
	const model = ctx.getNodeParameter('model', itemIndex, 'veo') as string;

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

	const videoGenerationTool = new DynamicStructuredTool({
		name: 'generate_video',
		description: 'Generate videos from text prompts using AI. Supports models like Veo and SeeDance. Can control dimensions, duration, aspect ratio, and enable audio generation.',
		schema: z.object({
			prompt: z.string().describe('Text description of the video to generate'),
			model: z.string().optional().describe('AI model to use (veo, seedance). Default: veo'),
			width: z.number().optional().describe('Video width in pixels (256-2048). Default: 1024'),
			height: z.number().optional().describe('Video height in pixels (256-2048). Default: 576'),
			duration: z.number().optional().describe('Video duration in seconds. Veo: 4, 6, or 8. SeeDance: 2-10. Default: 4'),
			aspectRatio: z.string().optional().describe('Video aspect ratio (16:9 or 9:16). Default: 16:9'),
			audio: z.boolean().optional().describe('Enable audio generation (veo only). Default: false'),
			seed: z.number().optional().describe('Random seed for reproducible results. Use -1 for random. Default: -1'),
			safe: z.boolean().optional().describe('Enable strict NSFW content filtering. Default: false'),
			negative_prompt: z.string().optional().describe('What to avoid in the generated video. Default: "worst quality, blurry"'),
		}),
		func: async ({ prompt, model: toolModel, width, height, duration, aspectRatio, audio, seed, safe, negative_prompt }) => {
			const headers: Record<string, string> = {};
			if (apiKey) {
				headers['Authorization'] = `Bearer ${apiKey}`;
			}

			// Build query parameters - videos use the same /image endpoint as images
			const selectedModel = toolModel || model;
			const queryParams: Record<string, string> = {
				model: selectedModel,
				width: (width || 1024).toString(),
				height: (height || 576).toString(),
			};
			
			if (duration) queryParams.duration = duration.toString();
			if (aspectRatio) queryParams.aspectRatio = aspectRatio;
			if (audio) queryParams.audio = 'true';
			if (seed !== undefined && seed !== -1) {
				queryParams.seed = seed.toString();
			}
			if (safe) queryParams.safe = 'true';
			if (negative_prompt) {
				queryParams.negative_prompt = negative_prompt;
			}

			const queryString = new URLSearchParams(queryParams).toString();
			const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?${queryString}`;

			try {
				const response = await fetch(url, {
					method: 'GET',
					headers,
					redirect: 'follow',
				});

				if (!response.ok) {
					throw new NodeOperationError(ctx.getNode(), `HTTP error! status: ${response.status}`);
				}

				const videoBuffer = await response.arrayBuffer();
				const base64Video = Buffer.from(videoBuffer).toString('base64');

				return JSON.stringify({
					success: true,
					video_url: url,
					video_data: `data:video/mp4;base64,${base64Video}`,
					model: selectedModel,
					prompt,
					width: width || 1024,
					height: height || 576,
					duration: duration || 4,
				});
			} catch (error) {
				return JSON.stringify({
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error',
					prompt,
				});
			}
		},
	});

	return videoGenerationTool;
}

export class ToolPollinationsVideo implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pollinations Video Generation',
		name: 'toolPollinationsVideo',
		icon: 'file:pollinations.svg',
		group: ['transform'],
		version: 1,
		description: 'Generate videos using Pollinations.ai',
		defaults: {
			name: 'Pollinations Video',
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
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				options: [
					{ name: 'Veo', value: 'veo' },
					{ name: 'SeeDance', value: 'seedance' },
				],
				default: 'veo',
				description: 'Default AI model to use for video generation',
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		return {
			response: await getTool(this, itemIndex),
		};
	}
}
