export { matchers } from './matchers.js';

export const nodes = [
	() => import('./nodes/0'),
	() => import('./nodes/1'),
	() => import('./nodes/2'),
	() => import('./nodes/3'),
	() => import('./nodes/4'),
	() => import('./nodes/5'),
	() => import('./nodes/6'),
	() => import('./nodes/7'),
	() => import('./nodes/8'),
	() => import('./nodes/9'),
	() => import('./nodes/10'),
	() => import('./nodes/11'),
	() => import('./nodes/12'),
	() => import('./nodes/13')
];

export const server_loads = [];

export const dictionary = {
		"/": [~3],
		"/books/new": [5],
		"/books/[bookId]/assets": [6,[2]],
		"/books/[bookId]/content": [7,[2]],
		"/books/[bookId]/export": [8,[2]],
		"/books/[bookId]/layout": [9,[2]],
		"/books/[bookId]/overview": [10,[2]],
		"/books/[bookId]/preview": [11,[2]],
		"/books/[bookId]/styles": [12,[2]],
		"/book/[slug]": [~4],
		"/library": [13]
	};

export const hooks = {
	handleError: (({ error }) => { console.error(error) }),
	
	reroute: (() => {}),
	transport: {}
};

export const decoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.decode]));
export const encoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.encode]));

export const hash = false;

export const decode = (type, value) => decoders[type](value);

export { default as root } from '../root.js';