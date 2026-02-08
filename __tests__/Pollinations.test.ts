import { Pollinations } from '../nodes/Pollinations/Pollinations.node';
import { PollinationsChatModel } from '../nodes/PollinationsChatModel/PollinationsChatModel.node';
import { PollinationsApi } from '../credentials/PollinationsApi.credentials';
import { extractBase64, sanitizePromptForUrl } from '../nodes/Pollinations/utils';

describe('Pollinations Node', () => {
	const node = new Pollinations();
	const description = node.description;

	it('should have correct node definition', () => {
		expect(description.name).toBe('pollinations');
		expect(description.displayName).toBe('Pollinations');
		expect(description.group).toEqual(['transform']);
		expect(description.version).toBe(1);
		expect(description.usableAsTool).toBe(true);
	});

	it('should require pollinationsApi credentials', () => {
		expect(description.credentials).toEqual([
			{ name: 'pollinationsApi', required: true },
		]);
	});

	it('should define all four resource types', () => {
		const resourceProperty = description.properties.find(
			(p) => p.name === 'resource',
		);
		expect(resourceProperty).toBeDefined();
		const options = (resourceProperty as { options: Array<{ value: string }> }).options;
		const values = options.map((o) => o.value);
		expect(values).toEqual(expect.arrayContaining(['audio', 'image', 'text', 'video']));
		expect(values).toHaveLength(4);
	});

	it('should define all eight operations across resources', () => {
		const operationProperties = description.properties.filter(
			(p) => p.name === 'operation',
		);

		const allOperationValues = operationProperties.flatMap((prop) => {
			const opts = (prop as { options: Array<{ value: string }> }).options;
			return opts.map((o) => o.value);
		});

		expect(allOperationValues).toEqual(expect.arrayContaining([
			'imageGeneration',
			'imageAnalysis',
			'imageToImage',
			'videoGeneration',
			'videoAnalysis',
			'textGeneration',
			'audioGeneration',
			'audioTranscription',
		]));
		expect(allOperationValues).toHaveLength(8);
	});

	it('should have loadOptions methods for all dynamic model selectors', () => {
		expect(node.methods.loadOptions).toBeDefined();
		const methodNames = Object.keys(node.methods.loadOptions);
		expect(methodNames).toEqual(expect.arrayContaining([
			'getImageModels',
			'getVideoModels',
			'getTextModels',
			'getVisionModels',
			'getImageToImageModels',
			'getVideoAnalysisModels',
			'getTranscriptionModels',
		]));
	});

	it('should have an execute method', () => {
		expect(node.execute).toBeDefined();
		expect(typeof node.execute).toBe('function');
	});
});

describe('PollinationsChatModel Node', () => {
	const node = new PollinationsChatModel();
	const description = node.description;

	it('should have correct node definition', () => {
		expect(description.name).toBe('pollinationsChatModel');
		expect(description.displayName).toBe('Pollinations Chat Model');
		expect(description.version).toBe(1);
		expect(description.usableAsTool).toBe(true);
	});

	it('should output AiLanguageModel connection type', () => {
		expect(description.outputs).toEqual(['ai_languageModel']);
	});

	it('should require pollinationsApi credentials', () => {
		expect(description.credentials).toEqual([
			{ name: 'pollinationsApi', required: true },
		]);
	});

	it('should have model and options properties', () => {
		const propNames = description.properties.map((p) => p.name);
		expect(propNames).toContain('model');
		expect(propNames).toContain('options');
	});

	it('should have getModels loadOptions method', () => {
		expect(node.methods.loadOptions.getModels).toBeDefined();
	});

	it('should have supplyData method', () => {
		expect(node.supplyData).toBeDefined();
		expect(typeof node.supplyData).toBe('function');
	});
});

describe('PollinationsApi Credentials', () => {
	const cred = new PollinationsApi();

	it('should have correct credential definition', () => {
		expect(cred.name).toBe('pollinationsApi');
		expect(cred.displayName).toBe('Pollinations API');
	});

	it('should authenticate via Bearer token header', () => {
		expect(cred.authenticate).toEqual({
			type: 'generic',
			properties: {
				headers: {
					Authorization: 'Bearer {{$credentials.apiKey}}',
				},
			},
		});
	});

	it('should test credentials against authenticated endpoint', () => {
		expect(cred.test.request).toEqual({
			baseURL: 'https://gen.pollinations.ai',
			url: '/account/balance',
			method: 'GET',
		});
	});
});

describe('Utils', () => {
	describe('extractBase64', () => {
		it('should extract base64 from data URL', () => {
			const result = extractBase64('data:image/png;base64,abc123');
			expect(result).toBe('abc123');
		});

		it('should return plain base64 string as-is', () => {
			const result = extractBase64('abc123');
			expect(result).toBe('abc123');
		});

		it('should convert Buffer to base64', () => {
			const buffer = Buffer.from('hello');
			const result = extractBase64(buffer);
			expect(result).toBe(buffer.toString('base64'));
		});

		it('should handle empty data URL', () => {
			const result = extractBase64('data:image/jpeg;base64,');
			expect(result).toBe('');
		});
	});

	describe('sanitizePromptForUrl', () => {
		it('should replace percent signs', () => {
			expect(sanitizePromptForUrl('50% off')).toBe('50percent off');
		});

		it('should handle multiple percent signs', () => {
			expect(sanitizePromptForUrl('100% pure, 50% off')).toBe('100percent pure, 50percent off');
		});

		it('should return unchanged string without percent signs', () => {
			expect(sanitizePromptForUrl('a cat on a roof')).toBe('a cat on a roof');
		});

		it('should handle empty string', () => {
			expect(sanitizePromptForUrl('')).toBe('');
		});
	});
});
