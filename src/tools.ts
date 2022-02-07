import { FC } from 'fc-premium-core'

export function parse_ignored_users_html(html_str: string) {

	const doc = FC.Utils.parseHTML(html_str);

	const li_list = doc.querySelectorAll<HTMLAnchorElement>('.userlist.floatcontainer li > a')
	const iu_list = {};

	li_list.forEach(element => {
		const url = new URL(element.href);

		const uid = parseInt(url.searchParams.get('u'));
		const uname = element.innerText
			.trim().toLowerCase();

		iu_list[uid] = uname;
	});

	return iu_list;
}

export function safe_html(html_str: string): string {
	return html_str.replace('<', '&lt;')
		.replace('>', '&gt;');
}

export function element_exists(selector: string): boolean {
	return document.querySelector(selector) !== null
}
