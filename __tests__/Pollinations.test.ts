import { Pollinations } from '../nodes/Pollinations/Pollinations.node';

describe('Pollinations Node', () => {
	it('should have correct node definition', () => {
		const node = new Pollinations();
		const definition = node.description;

		expect(definition).toBeDefined();
		expect(definition.name).toBe('pollinations');
		expect(definition.displayName).toBe('Pollinations');
		expect(definition.group).toEqual(['transform']);
		expect(definition.version).toBe(1);
	});

	it('should have operations property', () => {
		const node = new Pollinations();
		expect(node.description.properties).toBeDefined();
	});
});