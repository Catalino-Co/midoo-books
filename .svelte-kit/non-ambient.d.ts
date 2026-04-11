
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/" | "/books" | "/books/new" | "/books/[bookId]" | "/books/[bookId]/assets" | "/books/[bookId]/content" | "/books/[bookId]/export" | "/books/[bookId]/layout" | "/books/[bookId]/overview" | "/books/[bookId]/preview" | "/books/[bookId]/styles" | "/book" | "/book/[slug]" | "/library";
		RouteParams(): {
			"/books/[bookId]": { bookId: string };
			"/books/[bookId]/assets": { bookId: string };
			"/books/[bookId]/content": { bookId: string };
			"/books/[bookId]/export": { bookId: string };
			"/books/[bookId]/layout": { bookId: string };
			"/books/[bookId]/overview": { bookId: string };
			"/books/[bookId]/preview": { bookId: string };
			"/books/[bookId]/styles": { bookId: string };
			"/book/[slug]": { slug: string }
		};
		LayoutParams(): {
			"/": { bookId?: string; slug?: string };
			"/books": { bookId?: string };
			"/books/new": Record<string, never>;
			"/books/[bookId]": { bookId: string };
			"/books/[bookId]/assets": { bookId: string };
			"/books/[bookId]/content": { bookId: string };
			"/books/[bookId]/export": { bookId: string };
			"/books/[bookId]/layout": { bookId: string };
			"/books/[bookId]/overview": { bookId: string };
			"/books/[bookId]/preview": { bookId: string };
			"/books/[bookId]/styles": { bookId: string };
			"/book": { slug?: string };
			"/book/[slug]": { slug: string };
			"/library": Record<string, never>
		};
		Pathname(): "/" | "/books/new" | `/books/${string}/assets` & {} | `/books/${string}/content` & {} | `/books/${string}/export` & {} | `/books/${string}/layout` & {} | `/books/${string}/overview` & {} | `/books/${string}/preview` & {} | `/books/${string}/styles` & {} | `/book/${string}` & {} | `/book/${string}/` & {} | "/library";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/book-styles.css" | "/images/cover-bg.jpg" | "/images/portada.jpg" | string & {};
	}
}