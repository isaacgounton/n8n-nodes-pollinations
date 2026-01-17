import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class PollinationsApi implements ICredentialType {
	name = 'pollinationsApi';

	displayName = 'Pollinations API';

	icon = 'file:../nodes/Pollinations/pollinations.svg' as Icon;

	documentationUrl = 'https://pollinations.ai';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'Your Pollinations Secret Key (sk_). Get one at https://enter.pollinations.ai. Use Secret Keys for server-side n8n workflows, not Publishable Keys (pk_).',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://gen.pollinations.ai',
			url: '/account/balance',
			method: 'GET',
		},
	};
}
