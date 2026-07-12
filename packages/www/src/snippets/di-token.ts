import { createToken, inject, provide } from '@nisli/core';

const ApiUrl = createToken<string>('ApiUrl');

provide(ApiUrl, () => 'https://api.nisli.dev');

export const url = inject(ApiUrl); // string
