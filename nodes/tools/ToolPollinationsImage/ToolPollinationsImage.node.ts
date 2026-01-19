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
	const model = ctx.getNodeParameter('model', itemIndex, 'flux') as string;

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

	const imageGenerationTool = new DynamicStructuredTool({
		name: 'generate_image',
		description: 'Generate images from text prompts using AI. Supports various models like Flux, DALL-E, Stable Diffusion, and more. Can control dimensions, quality, and safety settings.',
		schema: z.object({
			prompt: z.string().describe('Text description of the image to generate'),
			model: z.string().optional().describe('AI model to use (flux, turbo, flux-realism, flux-anime, flux-3d, flux-pro, dall-e-3, stability, etc.). Default: flux'),
			width: z.number().optional().describe('Image width in pixels (16-2048). Default: 1024'),
			height: z.number().optional().describe('Image height in pixels (16-2048). Default: 1024'),
			seed: z.number().optional().describe('Random seed for reproducible results. Use -1 for random. Default: -1'),
			enhance: z.boolean().optional().describe('Use AI to improve the prompt. Default: false'),
			safe: z.boolean().optional().describe('Enable strict NSFW content filtering. Default: false'),
			negative_prompt: z.string().optional().describe('What to avoid in the generated image. Default: "worst quality, blurry"'),
		}),
		func: async ({ prompt, model: toolModel, width, height, seed, enhance, safe, negative_prompt }) => {
			const headers: Record<string, string> = {};
			if (apiKey) {
				headers['Authorization'] = `Bearer ${apiKey}`;
			}

			// Build query parameters
			const selectedModel = toolModel || model;
			const queryParams: Record<string, string> = {
				model: selectedModel,
				width: (width || 1024).toString(),
				height: (height || 1024).toString(),
			};
			
			if (seed !== undefined && seed !== -1) {
				queryParams.seed = seed.toString();
			}
			if (enhance) queryParams.enhance = 'true';
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
				const imageBuffer = await response.arrayBuffer();
				const base64Image = Buffer.from(imageBuffer).toString('base64');

				return JSON.stringify({
					success: true,
					image_url: url,
					image_data: `data:image/png;base64,${base64Image}`,
					model: selectedModel,
					prompt,
					width: width || 1024,
					height: height || 1024,
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

	return imageGenerationTool;
}

export class ToolPollinationsImage implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pollinations Image Generation',
		name: 'toolPollinationsImage',
		icon: 'file:pollinations.svg',
		group: ['transform'],
		version: 1,
		description: 'Generate images using Pollinations.ai',
		defaults: {
			name: 'Pollinations Image',
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
					{ name: 'DALL-E 3', value: 'dall-e-3' },
					{ name: 'Flux', value: 'flux' },
					{ name: 'Flux 3D', value: 'flux-3d' },
					{ name: 'Flux Anime', value: 'flux-anime' },
					{ name: 'Flux Cablyai', value: 'flux-cablyai' },
					{ name: 'Flux Pro', value: 'flux-pro' },
					{ name: 'Flux Realism', value: 'flux-realism' },
					{ name: 'Stable Diffusion', value: 'stability' },
					{ name: 'Turbo', value: 'turbo' },
				],
				default: 'flux',
				description: 'Default AI model to use for image generation',
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		return {
			response: await getTool(this, itemIndex),
		};
	}
}
