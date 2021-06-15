export function get_sync_ajax(url: string | URL) {
	let ajax = new XMLHttpRequest();
	ajax.open('GET', <string>url, false);
	ajax.send();

	return ajax.responseText;
}

export function safe_html(html: string): string {
	return html.replace('<', '&lt;')
		.replace('>', '&gt;');
}

export function element_exists(selector: string): boolean {
	return document.querySelector(selector) !== null
}
