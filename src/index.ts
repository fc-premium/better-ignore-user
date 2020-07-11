import { Core, FC } from 'fc-premium-core'
import $ from '@fc-lib/jquery'

import ModuleInfo from "@assets/info.json";
import ModuleConfig from "@assets/config.json";


const BetterIgnoreUser = new Core.Module(ModuleInfo);

const PATH = location.pathname;
const URL_SEARCH = location.search;

const DEFAULT_FILENAME = 'ignoredusers.export';

function getAjax(url) {
	let ajax = new XMLHttpRequest();
	ajax.open('GET', url, false);
	ajax.send();

	return ajax.responseText;
}


function parseIgnoredListHtml(html) {

	html = FC.Utils.parseHTML(html);

	let li_list = $(html)
		.find('.userlist.floatcontainer')
		.find<HTMLAnchorElement>('li > a');

	let iu_list = {};

	li_list.each((i, el) => {
		let uid = parseInt(el.href.split('=').slice(-1)[0]);
		let uname = el.innerText
			.trim().toLowerCase();

		iu_list[uid] = uname;
	});

	return iu_list;
}

function getIgnoredUsersIdList() {

	let iu_list = BetterIgnoreUser.storage.get('ignored-users-list');
	const do_update = BetterIgnoreUser.storage.get('update-needed') || BetterIgnoreUser.config.get('force-update');

	if (do_update || Object.keys(iu_list).length === 0) {
		BetterIgnoreUser.debug.log('Updating iu list');
		let response = getAjax(FC.Urls.ignoreList);

		iu_list = parseIgnoredListHtml(response);

		BetterIgnoreUser.storage.set('ignored-users-list', iu_list);
		BetterIgnoreUser.storage.set('update-needed', false);
	}

	return iu_list;
}

function safehtml(html) {
	return html.replace('<', '&lt;')
		.replace('>', '&gt;');
}

const elementExists = selector =>
	$(selector).length !== 0;

function exportUserList() {

	// Get checked users
	let inputs = $<HTMLInputElement>('#ignorelist input[type="checkbox"]').toArray()
		.filter((input: HTMLInputElement) =>
			input.checked
		);

	// exit if no users selected
	if (inputs.length === 0)
		return false;

	let ignoredUsers = {};

	inputs.forEach(input => {
		let user_id = input.value;
		let username = input.parentElement
			.innerText.trim();
		username = encodeURIComponent(username);

		ignoredUsers[user_id] = username;
	});

	let b64json = btoa(JSON.stringify(ignoredUsers));

	let filename = prompt('Nombre del archivo:', DEFAULT_FILENAME);


	// Exit if no filename introduced
	if (filename === null || filename === '')
		return false;

	let blob = new Blob([b64json], {
		type: "text/plain;charset=utf-8"
	});

	let blobLink = URL.createObjectURL(blob);

	let downloadLink = $('<a>')
		.attr('target', '_blank')
		.attr('download', filename)
		.attr('href', blobLink);

	downloadLink.hide();

	$('html > head').append(downloadLink);

	downloadLink[0].click();
	downloadLink.remove();

	window.addEventListener('unload', function() {
		URL.revokeObjectURL(blobLink);
	});
}

function updateUserList(uid, uname) {
	let ul = $('#ignorelist');

	if (ul.length === 0) {
		$('<ul class="userlist floatcontainer" id="ignorelist">')
			.insertBefore($('#ignorelist_change_form .submitrow.smallfont'));
		ul = $('#ignorelist');
	}

	// Create and sort checkboxes if not exists
	if (!elementExists(`#user${uid}`)) {
		let li_list = $<HTMLLIElement>('#ignorelist li').toArray();

		let li = <HTMLLIElement>(() => {
			let li = $(`<li id="user${uid}">`);

			let checkbox = $('<input type="checkbox" />')
				.attr('name', `listbits[ignore][${uid}]`)
				.attr('id', `usercheck_${uid}`)
				.attr('value', uid)
				.attr('checked', 'checked');

			let anchor = $(`<a href="member.php?u=${uid}">${uname}</a>`);

			let hidden = $('<input type="hidden" />')
				.attr('name', `listbits[ignore_original][${uid}]`)
				.attr('value', uid);

			li.append(checkbox);
			li.append(anchor);
			li.append(hidden);

			return li[0];
		})();

		// li_list = li_list.toArray();
		li_list.push(li);

		li_list.sort((a, b) => {
			let a_uname = $(a).find('a').text();
			let b_uname = $(b).find('a').text();

			return a_uname.localeCompare(b_uname);
		});

		ul.empty();
		li_list.forEach(el => ul.append(el));
	}
}

function importUserList() {

	let fileinput = $<HTMLInputElement>('<input type="file">');

	fileinput.on('change', function() {
		let file = this.files[0];

		let reader = new FileReader();

		reader.onload = function() {
			let json = FC.Utils.jsonSafeParse(atob(<string>reader.result));

			if (json === undefined)
				return alert('ERR_MALFORMED_CONTENT');


			let validUsers = [];

			Object.keys(json).forEach(key => {
				if (elementExists(`#user${key}`))
					return;

				validUsers.push([key, decodeURIComponent(json[key])]);
			});

			if (validUsers.length === 0)
				return;

			validUsers.sort((a, b) =>
				a[1].localeCompare(b[1])
			);

			let progress = $('#importProgress');
			progress.text(`0 / ${validUsers.length}`);
			progress.show();

			let completedRequests = 0;

			validUsers.forEach(([uid, uname]) => {
				const formData = new FormData($<HTMLFormElement>('#ignorelist_add_form')[0]);
				formData.set('username', uname);

				const formDataList: Array<[string, string]> = Array.from(<[string, string][]><unknown>formData);
				let dataString = '';

				formDataList.forEach(([key, value]) => {
					dataString += `${key}=${escape(value)}&`;
				});

				dataString = dataString.slice(0, -1);

				let form = $('#ignorelist_change_form');
				form.show();

				let ajax = new XMLHttpRequest();

				ajax.open('POST', 'profile.php?do=updatelist&userlist=ignore', true);
				ajax.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

				ajax.onreadystatechange = function() {
					if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {

						progress.text(`(${uname}) ${++completedRequests} / ${validUsers.length}`);
						updateUserList(uid, uname);

						if (completedRequests === validUsers.length) {

							$<HTMLInputElement>('#ignorelist_checkall').change(function() {
								let state = this.checked;
								let checkboxes = $<HTMLInputElement>('input[type="checkbox"]')
									.toArray();
								checkboxes.forEach(el => {
									el.checked = state;
								});
							});

							setTimeout(() => progress.hide(), 1000);
						}
					}
				};

				ajax.send(dataString);
			});

		};

		reader.readAsText(file);
		this.remove();
	});

	fileinput[0].click();
}

function insertCss() {
	// BetterIgnoreUser.styles.set('input.button.tm', {
	// 	'margin-left': '5px'
	// })
	// 	.set('#importProgress', {
	// 		'float': 'right'
	// 	});
}

function insertButtons() {

	const submit = $('.userlist_form_controls input[type="submit"]');
	const exportButton = $('<input type="button" class="button tm" value="Exportar"> ');
	const importButton = $('<input type="button" class="button tm" value="Importar"> ');
	const progress = $('<span id="importProgress"></span>');

	exportButton.on('click', exportUserList);
	importButton.on('click', importUserList);

	progress.insertAfter(submit);
	importButton.insertAfter(submit);
	exportButton.insertAfter(submit);

	progress.hide();
}

function setThreadVisibilityFromRoot(show = false) {

	BetterIgnoreUser.debug.log('setThreadVisibilityFromRoot');

	const USER_ID_LIST = Object.entries(getIgnoredUsersIdList())
		.map(a => parseInt(a[0]));

	const authors = $<HTMLAnchorElement>('.cajasnews a[href*="/foro/member"]');

	authors.each((i, author) => {
		const uid = parseInt(author.href.split('=').slice(-1)[0]);

		if (USER_ID_LIST.includes(uid)) {
			const parent = $(author).parent().parent();

			if (show)
				parent.show();
			else
				parent.hide();
		}
	});
}

function setThreadVisibilityFromForumdisplay(show = false) {

	BetterIgnoreUser.debug.log('setThreadVisibilityFromForumdisplay');

	const USER_ID_LIST = Object.entries(getIgnoredUsersIdList())
		.map(a => parseInt(a[0]));


	const authors = $('[id*=threadbits_forum] span[onclick]');

	authors.each((i, author) => {
		let uid_str = $(author).attr('onclick').split('=', 2)[1];
		const uid: number = parseInt(uid_str.split("'")[0]);

		if (USER_ID_LIST.includes(uid)) {
			const parent = $(author).parent().parent().parent();

			if (show)
				parent.show();
			else
				parent.hide();
		}
	});
}

// refactorize this
function setPostVisibility(show = false) {

	BetterIgnoreUser.debug.log('setPostVisibility');

	const iu_list = Object.entries(getIgnoredUsersIdList());

	const USER_ID_LIST = iu_list.map(a => parseInt(a[0]));
	const USERNAME_LIST = iu_list.map(a => a[1]);

	const quoteAuthors = $(FC.Utils.isMobileVersion ?
		'div > strong:has(+a[href*="showthread.php?p="] > img)' :
		'td.alt2 > div > b:has(+a[href*="showthread.php?p="] > img)'
	);


	const postAuthors = $<HTMLAnchorElement>(FC.Utils.isMobileVersion ?
		'.ui-link:not(.fpostuseravatarlink)' :
		'div[align="center"] div.smallfont + a'
	);

	BetterIgnoreUser.debug.log('do hide', postAuthors, quoteAuthors, USERNAME_LIST, USER_ID_LIST);

	// Hide ignored users posts
	postAuthors.each((i, authorLink) => {
		const user_id = parseInt(authorLink.href.split('=')[1]);

		if (USER_ID_LIST.includes(user_id)) {

			const element = $(authorLink).closest(FC.Utils.isMobileVersion ?
				'ul' : 'div[align="center"]');

			BetterIgnoreUser.debug.log(`Ignored user post detected from ${authorLink.innerText} with id: ${user_id}`);


			if (show)
				element.show();
			else
				element.hide();
		}
	});

	// Delete ignored users quotes
	quoteAuthors.each((i, author) => {

		// get rid of possible xss
		let uname = author.innerText;
		const lowerUname = uname.trim().toLowerCase();

		// get rid of possible xss

		if (USERNAME_LIST.includes(lowerUname)) {
			BetterIgnoreUser.debug.log(`Ignored user quote detected from ${uname}`);

			const element = $(author).closest(FC.Utils.isMobileVersion ?
				'ul' : 'div[align="center"]');

			if (show)
				element.show();
			else
				element.hide();
		}
	});

	// Just replace text
	quoteAuthors.each((i, author) => {

		// get rid of possible xss
		let uname = author.innerText;
		const lowerUname = uname.trim().toLowerCase();

		// get rid of possible xss

		if (USERNAME_LIST.includes(lowerUname)) {
			let td = author.parentElement.parentElement;
			let text = td.lastElementChild;

			uname = safehtml(uname);

			text.innerHTML = '<br>Este mensaje está oculto porque ' +
				`<b>${uname}</b> está en tu ` +
				`<a href="${FC.Urls.ignoreList}" target="_blank">` +
				'lista de ignorados</a>';
		}
	});

}

BetterIgnoreUser.onload = function() {

	const storageKeyMissing: boolean = !(BetterIgnoreUser.storage.has('ignored-users-list')
		&& BetterIgnoreUser.storage.has('update-needed'));

	if (storageKeyMissing === true) {
		BetterIgnoreUser.storage.set('ignored-users-list', []);
		BetterIgnoreUser.storage.set('update-needed', true);
	};

	if (PATH === FC.Urls.ignoreList.pathname && URL_SEARCH === FC.Urls.ignoreList.search) {
		BetterIgnoreUser.storage.set('update-needed', true);
		BetterIgnoreUser.debug.log('Hitted ignored list url, update on next module load');

		window.addEventListener('load', function() {
			insertCss();
			insertButtons();
		});

	} else {
		switch (PATH) {
			case FC.Urls.absolutePath.pathname:
				setThreadVisibilityFromRoot();
				break;

			case FC.Urls.forumDisplay.pathname:
				setThreadVisibilityFromForumdisplay();
				break;

			case FC.Urls.showThread.pathname:
				setPostVisibility(!BetterIgnoreUser.config.get('hide-posts'))
				break;
			default:
				break;
		}
	}
}

BetterIgnoreUser.onunload = function() {
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
}

export {
	BetterIgnoreUser as module,
	ModuleConfig as config,
	ModuleInfo as info,
	// ModuleStyles as css
};
