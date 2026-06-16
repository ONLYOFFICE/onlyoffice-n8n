import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class OnlyofficeDocsApi implements ICredentialType {
	name = 'onlyofficeDocsApi';

	displayName = 'ONLYOFFICE Document Server API';

	// @ts-expect-error Wrong type inference.
	icon = 'file:../nodes/OnlyofficeDocs/onlyofficeDocs.svg';

	documentationUrl =
		'https://api.onlyoffice.com/docs/docs-api/additional-api/conversion-api/';

	properties: INodeProperties[] = [
		{
			displayName: 'Document Server URL',
			name: 'docsServerUrl',
			type: 'string',
			default: '',
			description: 'The base URL of your ONLYOFFICE Document Server',
			placeholder: 'https://docs.example.com',
			required: true,
		},
		{
			displayName: 'JWT Secret',
			name: 'jwtSecret',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description: 'The JWT secret configured on your Document Server',
			required: true,
		},
		{
			displayName: 'JWT Header',
			name: 'jwtHeader',
			type: 'string',
			default: 'Authorization',
			description: 'The HTTP header name used to pass the JWT token (default: Authorization)',
		},
	];
}
