const preGameForm = document.getElementById('preGameForm') as HTMLFormElement;
const newGameButton = document.getElementById('newGameButton')!;
const newGameSetupButton = document.getElementById('newGameSetupButton')!;
const joinGameButton = document.getElementById('joinGameButton')!;
const nameBox = document.getElementById('nameBox') as HTMLInputElement;
const gameIDBox = document.getElementById('gameIDBox') as HTMLInputElement;
const preGameDeckEditorButton = document.getElementById('preGameDeckEditorButton') as HTMLLinkElement;
const preGameLoadingSection = document.getElementById('preGameLoadingSection')!;
const preGameLoadingLabel = document.getElementById('preGameLoadingLabel')!;
const preGameReplayButton = document.getElementById('preGameReplayButton') as HTMLLinkElement;
const preGameHelpButton = document.getElementById('preGameHelpButton') as HTMLLinkElement;
const helpDialog = document.getElementById('helpDialog') as HTMLDialogElement;

const gameSetupDialog = document.getElementById('gameSetupDialog') as HTMLDialogElement;
const gameSetupForm = document.getElementById('gameSetupForm') as HTMLFormElement;
const maxPlayersBox = document.getElementById('maxPlayersBox') as HTMLSelectElement;
const turnTimeLimitBox = document.getElementById('turnTimeLimitBox') as HTMLInputElement;
const goalWinCountBox = document.getElementById('goalWinCountBox') as HTMLSelectElement;

let shownMaxPlayersWarning = false;

function setLoadingMessage(message: string | null) {
	if (message)
		preGameLoadingLabel.innerText = message;
	preGameLoadingSection.hidden = message == null;
	for (const input of preGameForm.elements) {
		if (input instanceof HTMLButtonElement || input instanceof HTMLInputElement || input instanceof HTMLSelectElement)
			input.disabled = message != null;
	}
}

maxPlayersBox.addEventListener('change', () => {
	if (!shownMaxPlayersWarning && maxPlayersBox.value != '2') {
		if (confirm('Tableturf Battle is designed for two players and may not be well-balanced for more. Do you want to continue?'))
			shownMaxPlayersWarning = true;
		else
		maxPlayersBox.value = '2';
	}
});

newGameSetupButton.addEventListener('click', _ => {
	gameSetupDialog.showModal();
});

preGameForm.addEventListener('submit', e => {
	e.preventDefault();

	const name = nameBox.value;
	window.localStorage.setItem('name', name);

	if (e.submitter?.id == 'newGameButton' || (e.submitter?.id == 'preGameImplicitSubmitButton' && !gameIDBox.value)) {
		createRoom(false);
	} else if (e.submitter?.id?.startsWith('spectate')) {
		spectate(false);
	} else {
		tryJoinGame(name, gameIDBox.value, false);
	}
});

gameSetupForm.addEventListener('submit', e => {
	if (e.submitter?.id != 'gameSetupSubmitButton')
		return;
	const name = nameBox.value;
	window.localStorage.setItem('name', name);
	createRoom(true);
});

function uiParseGameID(s: string, fromInitialLoad: boolean) {
	const gameID = parseGameID(s);
	if (!gameID) {
		alert("Invalid game ID or link");
		if (fromInitialLoad)
			clearPreGameForm(true);
		else {
			gameIDBox.focus();
			gameIDBox.setSelectionRange(0, gameIDBox.value.length);
		}
	}
	return gameID;
}

function createRoom(useOptionsForm: boolean) {
	const name = nameBox.value;
	let request = new XMLHttpRequest();
	request.open('POST', `${config.apiBaseUrl}/games/new`);
	request.addEventListener('load', () => {
		if (request.status == 200) {
			let response = JSON.parse(request.responseText);
			if (!clientToken)
				setClientToken(response.clientToken);

			setGameUrl(response.gameID);

			getGameInfo(response.gameID, 0);
		} else if (request.status == 503)
			communicationError('The server is temporarily locked for an update. Please try again soon.', true, () => setLoadingMessage(null));
		else
			communicationError('Unable to create the room.', true, () => setLoadingMessage(null));
	});
	request.addEventListener('error', () => {
		communicationError('Unable to create the room.', true, () => setLoadingMessage(null));
	});

	let data = new URLSearchParams();
	data.append('name', name);
	data.append('clientToken', clientToken);
	if (useOptionsForm) {
		data.append('maxPlayers', maxPlayersBox.value);
		if (turnTimeLimitBox.value)
			data.append('turnTimeLimit', turnTimeLimitBox.value);
		if (goalWinCountBox.value)
			data.append('goalWinCount', goalWinCountBox.value);
	}
	request.send(data.toString());
	setLoadingMessage('Creating a room...');
}

function spectate(fromInitialLoad: boolean) {
	const gameID = uiParseGameID(gameIDBox.value, fromInitialLoad);
	if (!gameID) return;
	setGameUrl(gameID);
	getGameInfo(gameID, null);
}

function tryJoinGame(name: string, idOrUrl: string, fromInitialLoad: boolean) {
	const gameID = uiParseGameID(idOrUrl, fromInitialLoad);
	if (!gameID) return;

	setGameUrl(gameID);

	let request = new XMLHttpRequest();
	request.open('POST', `${config.apiBaseUrl}/games/${gameID}/join`);
	request.addEventListener('load', () => {
		if (request.status == 200) {
			let response = JSON.parse(request.responseText);
			if (!clientToken)
				setClientToken(response.clientToken);
			getGameInfo(gameID, response.playerIndex);
		} else {
			if (request.status == 404)
				joinGameError('The room was not found.', fromInitialLoad);
			else if (request.status == 409)
				joinGameError('The game is full.', fromInitialLoad);
			else if (request.status == 410)
				joinGameError('The game has already started.', fromInitialLoad);
			else
				joinGameError('Unable to join the room.', fromInitialLoad);
		}
	});
	request.addEventListener('error', () => {
		joinGameError('Unable to join the room.', fromInitialLoad);
	});
	request.send(new URLSearchParams({ name, clientToken }).toString());
	setLoadingMessage('Joining the game...');
}

function joinGameError(message: string, fromInitialLoad: boolean) {
	communicationError(message, true, () => {
		clearUrlFromGame();
		setLoadingMessage(null);
		if (fromInitialLoad)
			clearPreGameForm(true);
		else {
			gameIDBox.focus();
			gameIDBox.setSelectionRange(0, gameIDBox.value.length);
		}
	});
}

function getGameInfo(gameID: string, myPlayerIndex: number | null) {
	board.playerIndex = myPlayerIndex;
	initLobbyPage(window.location.toString());

	showDeckButtons.splice(0);
	clearShowDeck();
	setupWebSocket(gameID);
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

preGameDeckEditorButton.addEventListener('touchstart', deckListEnableTouchMode);

preGameDeckEditorButton.addEventListener('click', e => {
	e.preventDefault();
	showDeckList();
	setUrl('deckeditor');
});

preGameHelpButton.addEventListener('click', e => {
	e.preventDefault();
	helpDialog.showModal();
	setUrl('help');
});

helpDialog.addEventListener('close', () => {
	if (canPushState) {
		try {
			history.pushState(null, '', '.');
		} catch {
			canPushState = false;
		}
	}
	if (location.hash)
		location.hash = '';
});

preGameReplayButton.addEventListener('click', e => {
	e.preventDefault();

	const s = prompt('Enter a replay link or code.');
	if (!s) return;
	const m = /(?:^|replay\/)([A-Za-z0-9+/=\-_]+)$/i.exec(s);
	if (!m) {
		alert('Not a valid replay code');
		return;
	}

	new ReplayLoader(m[1]).loadReplay();
});

let playerName = localStorage.getItem('name');
(document.getElementById('nameBox') as HTMLInputElement).value = playerName || '';

let settingUrl = false;
window.addEventListener('popstate', () => {
	if (!settingUrl)
		processUrl();
});

if (!canPushState)
	preGameDeckEditorButton.href = '#deckeditor';
setLoadingMessage('Loading game data...');
