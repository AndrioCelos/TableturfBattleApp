const preGameForm = document.getElementById('preGameForm') as HTMLFormElement;
const newGameButton = document.getElementById('newGameButton')!;
const joinGameButton = document.getElementById('joinGameButton')!;
const nameBox = document.getElementById('nameBox') as HTMLInputElement;
const gameIDBox = document.getElementById('gameIDBox') as HTMLInputElement;
const maxPlayersBox = document.getElementById('maxPlayersBox') as HTMLSelectElement;
const preGameDeckEditorButton = document.getElementById('preGameDeckEditorButton') as HTMLLinkElement;
const preGameLoadingSection = document.getElementById('preGameLoadingSection')!;
const preGameLoadingLabel = document.getElementById('preGameLoadingLabel')!;

let shownMaxPlayersWarning = false;

function setLoadingMessage(message: string | null) {
	if (message)
		preGameLoadingLabel.innerText = message;
	preGameLoadingSection.hidden = message == null;
	for (const button of preGameForm.getElementsByTagName('button'))
		button.disabled = message != null;
}

maxPlayersBox.addEventListener('change', () => {
	if (!shownMaxPlayersWarning && maxPlayersBox.value != '2') {
		if (confirm('Tableturf Battle is designed for two players and may not be well-balanced for more. Do you want to continue?'))
			shownMaxPlayersWarning = true;
		else
		maxPlayersBox.value = '2';
	}
});

preGameForm.addEventListener('submit', e => {
	e.preventDefault();
	if (e.submitter?.id == 'newGameButton' || (e.submitter?.id == 'preGameImplicitSubmitButton' && !gameIDBox.value)) {
		const name = nameBox.value;
		window.localStorage.setItem('name', name);

		let request = new XMLHttpRequest();
		request.open('POST', `${config.apiBaseUrl}/games/new`);
		request.addEventListener('load', e => {
			if (request.status == 200) {
				let response = JSON.parse(request.responseText);
				if (!clientToken)
					setClientToken(response.clientToken);

				setGameUrl(response.gameID);

				getGameInfo(response.gameID, 0);
			}
		});

		let data = new URLSearchParams();
		data.append('name', name);
		data.append('clientToken', clientToken);
		data.append('maxPlayers', maxPlayersBox.value);
		request.send(data.toString());
		setLoadingMessage('Creating a room...');
	} else {
		const name = nameBox.value;
		window.localStorage.setItem('name', name);
		tryJoinGame(name, gameIDBox.value, false);
	}
});

function tryJoinGame(name: string, idOrUrl: string, fromInitialLoad: boolean) {
	const m = /(?:^|[#/])([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(idOrUrl);
	if (!m) {
		alert("Invalid game ID or link");
		if (fromInitialLoad)
			clearPreGameForm(true);
		else {
			gameIDBox.focus();
			gameIDBox.setSelectionRange(0, gameIDBox.value.length);
		}
		return;
	}
	const gameID = m[1];

	if (!fromInitialLoad)
		setGameUrl(gameID);

	let request = new XMLHttpRequest();
	request.open('POST', `${config.apiBaseUrl}/games/${gameID}/join`);
	request.addEventListener('load', e => {
		if (request.status == 200) {
			let response = JSON.parse(request.responseText);
			if (!clientToken)
				setClientToken(response.clientToken);
			getGameInfo(gameID, response.playerIndex);
		} else {
			if (request.status == 404)
				alert('The game was not found.');
			else if (request.status == 410)
				alert('The game has already started.');
			else
				alert('Unable to join the room.');
			clearUrlFromGame();
			setLoadingMessage(null);
			if (fromInitialLoad)
				clearPreGameForm(true);
			else {
				gameIDBox.focus();
				gameIDBox.setSelectionRange(0, gameIDBox.value.length);
			}
		}
	});
	request.addEventListener('error', () => {
		communicationError();
	});
	let data = new URLSearchParams();
	data.append('name', name);
	data.append('clientToken', clientToken);
	request.send(data.toString());
	setLoadingMessage('Joining the game...');
}

function getGameInfo(gameID: string, myPlayerIndex: number | null) {
	board.playerIndex = myPlayerIndex;
	initLobbyPage(window.location.toString());

	myPlayerIndex = setupWebSocket(gameID, myPlayerIndex);
}

function backPreGameForm(updateUrl: boolean) {
	document.getElementById('preGameDefaultSection')!.hidden = false;
	document.getElementById('preGameJoinSection')!.hidden = true;

	if (updateUrl) {
		clearUrlFromGame();
	}
}
function clearPreGameForm(updateUrl: boolean) {
	backPreGameForm(updateUrl);
	currentGame = null;
	gameIDBox.value = '';
}

document.getElementById('preGameBackButton')!.addEventListener('click', e => {
	e.preventDefault();
	backPreGameForm(true);
})

function presetGameID(url: string) {
	document.getElementById('preGameDefaultSection')!.hidden = true;
	document.getElementById('preGameJoinSection')!.hidden = false;
	(document.getElementById('gameIDBox') as HTMLInputElement).value = url;
	if (playerName)
		tryJoinGame(playerName, url, true);
	else
		showPage('preGame');
}

preGameDeckEditorButton.addEventListener('click', e => {
	e.preventDefault();
	showDeckList();
	setUrl('deckeditor');
});

const playerName = localStorage.getItem('name');
(document.getElementById('nameBox') as HTMLInputElement).value = playerName || '';

let settingUrl = false;
window.addEventListener('popstate', e => {
	if (!settingUrl)
		processUrl();
});
processUrl();

if (!canPushState)
	preGameDeckEditorButton.href = '#deckeditor';
