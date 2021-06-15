import { Core, FC } from 'fc-premium-core'

import { get_sync_ajax, safe_html, element_exists } from './tools'

import ModuleInfo from "@assets/info.json";
import ModuleConfig from "@assets/config.json";
import ModuleStyles from '@assets/main.css'

const BetterIgnoreUser = new Core.Module(ModuleInfo);

const PATH = location.pathname;
const URL_SEARCH = location.search;

const DEFAULT_FILENAME = 'ignoredusers.export';


function parse_ignored_users_html(html: string) {

	const doc = FC.Utils.parseHTML(html);

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

function get_ignored_users_list() {

	const do_update = BetterIgnoreUser.storage.get('update-needed') || BetterIgnoreUser.config.get('force-update');
	let iu_list = BetterIgnoreUser.storage.get('ignored-users-list');

	if (do_update || Object.keys(iu_list).length === 0) {
		BetterIgnoreUser.debug.log('Updating iu list');

		const response = get_sync_ajax(FC.Urls.ignoreList);
		iu_list = parse_ignored_users_html(response);

		BetterIgnoreUser.storage.set('ignored-users-list', iu_list);
		BetterIgnoreUser.storage.set('update-needed', false);
	}

	return iu_list;
}

function export_user_list() {

	const checked_inputs = Array.from(
		document.querySelectorAll<HTMLInputElement>('#ignorelist input[type="checkbox"]')
	)
		.filter((input) => input.checked);


	if (checked_inputs.length === 0)
		return false;

	const ignored_users = {};

	checked_inputs.forEach(input => {
		const user_id = input.value;
		let username = input.parentElement
			.innerText.trim();

		username = encodeURIComponent(username);

		ignored_users[user_id] = username;
	});

	const encoded_json = btoa(JSON.stringify(ignored_users));

	const filename = prompt('Nombre del archivo:', DEFAULT_FILENAME);


	if (filename === null || filename === '')
		return false;

	const blob = new Blob([encoded_json], {
		type: "text/plain;charset=utf-8"
	});

	const blob_link = URL.createObjectURL(blob);


	const download_link = document.createElement('a');

	download_link.setAttribute('target', '_blank')
	download_link.setAttribute('download', filename)
	download_link.setAttribute('href', blob_link)
	download_link.style.display = 'none';

	document.head.append(download_link)

	download_link.click();
	download_link.remove();

	window.addEventListener('unload', function () {
		URL.revokeObjectURL(blob_link);
	});
}

function update_user_list(uid: string, uname: string) {
	let ul = document.getElementById('ignorelist');

	if (ul === null) {
		ul = document.createElement('ul');
		ul.setAttribute('class', 'userlist floatcontainer');
		ul.setAttribute('id', 'ignorelist');

		const submit_row = document.querySelector('#ignorelist_change_form .submitrow.smallfont');

		submit_row.before(ul);

		// $('<ul class="userlist floatcontainer" id="ignorelist">')
		// 	.insertBefore($('#ignorelist_change_form .submitrow.smallfont'));
	}

	// Create and sort checkboxes if not exists
	if (!element_exists(`#user${uid}`)) {
		const li_list = Array.from(document.querySelectorAll<HTMLLIElement>('#ignorelist li'));

		const li = <HTMLLIElement>(() => {

			const li = document.createElement('li');
			li.setAttribute('id', `user${uid}`)

			const checkbox = document.createElement('input');
			checkbox.setAttribute('type', 'checkbox');

			checkbox.setAttribute('name', `listbits[ignore][${uid}]`);
			checkbox.setAttribute('id', `usercheck_${uid}`);
			checkbox.setAttribute('value', uid);
			checkbox.setAttribute('checked', 'checked');


			const anchor = document.createElement('a');
			anchor.setAttribute('href', `member.php?u=${uid}`);
			anchor.innerText = uname;


			const hidden_input = document.createElement('input');
			hidden_input.setAttribute('type', 'hidden');
			hidden_input.setAttribute('name', `listbits[ignore_original][${uid}]`)
			hidden_input.setAttribute('value', uid);

			li.append(checkbox);
			li.append(anchor);
			li.append(hidden_input);

			return li;
		})();

		li_list.push(li);

		li_list.sort((a, b) => {
			const a_uname = a.innerText.trim();
			const b_uname = b.innerText.trim();

			return a_uname.localeCompare(b_uname);
		});

		while (ul.firstChild !== null)
			ul.removeChild(ul.firstChild);

		li_list.forEach(el => ul.append(el));
	}
}

function import_user_list() {

	const file_input = document.createElement('input');
	file_input.setAttribute('type', 'file');

	file_input.addEventListener('change', function () {

		const file = file_input.files[0];
		const reader = new FileReader();

		reader.addEventListener('onload', function () {
			const json = FC.Utils.jsonSafeParse(atob(<string>reader.result));

			if (json === undefined)
				return alert('ERR_MALFORMED_CONTENT');

			const valid_users = [];

			Object.entries(json).forEach(([id, username]: [string, string]) => {
				if (element_exists(`#user${id}`))
					return;

				valid_users.push([id, decodeURIComponent(username)]);
			});

			if (valid_users.length === 0)
				return;

			valid_users.sort((a, b) =>
				a[1].localeCompare(b[1])
			);

			const progress = document.getElementById('importProgress');
			progress.innerText = `0 / ${valid_users.length}`;
			progress.style.display = '';

			let completedRequests = 0;

			valid_users.forEach(([user_id, username]) => {
				const formData = new FormData(<HTMLFormElement>document.getElementById('ignorelist_add_form'));
				formData.set('username', username);

				const formDataList: Array<[string, string]> = Array.from(<[string, string][]><unknown>formData);
				let dataString = '';

				formDataList.forEach(([key, value]) => {
					dataString += `${key}=${escape(value)}&`;
				});

				dataString = dataString.slice(0, -1);

				// const form = document.getElementById('ignorelist_change_form');
				// form.show();

				const ajax = new XMLHttpRequest();

				ajax.open('POST', 'profile.php?do=updatelist&userlist=ignore', true);
				ajax.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

				ajax.onreadystatechange = function () {
					if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {

						completedRequests += 1;

						progress.innerText = `(${username}) ${completedRequests} / ${valid_users.length}`;
						update_user_list(user_id, username);


						if (completedRequests === valid_users.length) {

							const checkall_input = <HTMLInputElement>document.getElementById('ignorelist_checkall');

							checkall_input.addEventListener('change', function () {
								let state = this.checked;
								let checkboxes = $<HTMLInputElement>('input[type="checkbox"]')
									.toArray();
								checkboxes.forEach(el => {
									el.checked = state;
								});

							});

							setTimeout(() => progress.style.display = 'none', 1000);
						}
					}
				};

				ajax.send(dataString);
			});

		});

		reader.readAsText(file);
		this.remove();
	});

	file_input.click();
}

function insert_buttons() {

	const submit = document.querySelector('.userlist_form_controls input[type="submit"]');

	// const exportButton = $('<input type="button" class="button tm" value="Exportar"> ');
	const export_button = document.createElement('input');
	export_button.setAttribute('type', 'button');
	export_button.setAttribute('class', 'button tm');
	export_button.setAttribute('value', 'Exportar');

	const import_button = document.createElement('input');
	import_button.setAttribute('type', 'button');
	import_button.setAttribute('class', 'button tm');
	import_button.setAttribute('value', 'Importar');

	const progress = document.createElement('span');
	progress.setAttribute('id', 'importProgress');


	export_button.addEventListener('click', export_user_list);
	import_button.addEventListener('click', import_user_list);


	submit.after(progress);
	submit.after(import_button);
	submit.after(export_button);

	progress.style.display = 'none';
}

function setThreadVisibilityFromRoot(show = false) {

	BetterIgnoreUser.debug.log('setThreadVisibilityFromRoot');

	const USER_ID_LIST = Object.entries(get_ignored_users_list())
		.map(a => parseInt(a[0]));

	const authors = document.querySelectorAll<HTMLAnchorElement>('.cajasnews a[href*="/foro/member"]');

	authors.forEach(author => {
		const author_url = new URL(author.href);
		const uid = parseInt(author_url.searchParams.get('u'));

		if (USER_ID_LIST.includes(uid)) {
			const parent = <HTMLElement>author.parentNode.parentNode;

			if (show)
				parent.style.display = '';
			else
				parent.style.display = 'none';
		}
	});
}

function setThreadVisibilityFromForumdisplay(show = false) {

	BetterIgnoreUser.debug.log('setThreadVisibilityFromForumdisplay');

	const USER_ID_LIST = new Set(Object.keys(get_ignored_users_list()));

	const authors = document.querySelectorAll('[id*=threadbits_forum] span[onclick]');

	authors.forEach(author => {
		const user_id = author.getAttribute('onclick')
			.split('=', 2)[1]
			.split("'")[0];

		if (USER_ID_LIST.has(user_id)) {
			const parent = <HTMLElement>author.parentNode
				.parentNode.parentNode;

			if (show)
				parent.style.display = '';
			else
				parent.style.display = 'none';
		}
	});
}

// refactorize this
function setPostVisibility(show = false, hide_ignored_posts = false) {

	BetterIgnoreUser.debug.log('setPostVisibility');

	const QUOTE_AUTHORS_SELECTOR = FC.Utils.isMobileVersion ?
		'div > strong + a[href*="showthread.php?p="]' :
		'td.alt2 > div > b + a[href*="showthread.php?p="]';

	const POST_AUTHORS_SELECTOR = FC.Utils.isMobileVersion ?
		'a.ui-link:not(.fpostuseravatarlink)' :
		'div[id^=postmenu] a.bigusername';

	const POST_ELEMENTS_SELECTOR = FC.Utils.isMobileVersion ?
		'div#posts > ul' :
		'#posts > div[align="center"]';

	const iu_list = get_ignored_users_list();

	const USER_ID_SET = new Set(Object.keys(iu_list));
	const USERNAME_SET = new Set(Object.values<string>(iu_list));


	if (hide_ignored_posts) {

		const post_authors = Array.from(document.querySelectorAll<HTMLAnchorElement>(POST_AUTHORS_SELECTOR));
		const post_elements = Array.from(document.querySelectorAll<HTMLElement>(POST_ELEMENTS_SELECTOR));

		post_authors.forEach((author_link, i) => {
			const author_url = new URL(author_link.href);
			const user_id = author_url.searchParams.get('u');

			if (USER_ID_SET.has(user_id)) {

				BetterIgnoreUser.debug.log(`Ignored user post detected from ${author_link.innerText} with id: ${user_id}`);

				const element = post_elements[i];

				if (show)
					element.style.display = '';
				else
					element.style.display = 'none';
			}
		});
	}

	const quote_authors = Array.from(document.querySelectorAll(QUOTE_AUTHORS_SELECTOR))
		.map(element =>
			<HTMLElement>element.previousElementSibling
		);

	quote_authors.forEach(author => {

		const username = author.innerText;
		const lower_usernname = username.trim().toLowerCase();

		if (USERNAME_SET.has(lower_usernname)) {

			const td = author.parentElement.parentElement;
			const text = td.lastElementChild;

			const safe_username = safe_html(username);

			text.innerHTML = '<br>Este mensaje está oculto porque ' +
				`<b>${safe_username}</b> está en tu ` +
				`<a href="${FC.Urls.ignoreList}" target="_blank">` +
				'lista de ignorados</a>';
		}
	});
}

BetterIgnoreUser.addEventListener('load', function () {

	const storage_key_missing = !(
		BetterIgnoreUser.storage.has('ignored-users-list') &&
		BetterIgnoreUser.storage.has('update-needed')
	);

	if (storage_key_missing === true) {
		BetterIgnoreUser.storage.set('ignored-users-list', []);
		BetterIgnoreUser.storage.set('update-needed', true);
	};

	if (PATH === FC.Urls.ignoreList.pathname && URL_SEARCH === FC.Urls.ignoreList.search) {
		BetterIgnoreUser.storage.set('update-needed', true);
		BetterIgnoreUser.debug.log('Hitted ignored list url, update on next module load!!');

		insert_buttons();

	} else {
		const hide_posts = BetterIgnoreUser.config.get('hide-posts');
		switch (PATH) {
			case FC.Urls.absolutePath.pathname:
				setThreadVisibilityFromRoot(false);
				break;

			case FC.Urls.forumDisplay.pathname:
				setThreadVisibilityFromForumdisplay(false);
				break;

			case FC.Urls.showThread.pathname:
				setPostVisibility(false, hide_posts)
				break;
			default:
				break;
		}
	}
})

BetterIgnoreUser.addEventListener('unload', function () {
	switch (PATH) {
		case FC.Urls.absolutePath.pathname:
			setThreadVisibilityFromRoot(true);
			break;

		case FC.Urls.forumDisplay.pathname:
			setThreadVisibilityFromForumdisplay(true);
			break;

		case FC.Urls.showThread.pathname:
			setPostVisibility(true)
			break;
		default:
			break;
	}
})

export {
	BetterIgnoreUser as module,
	ModuleConfig as config,
	ModuleInfo as info,
	ModuleStyles as css

};
