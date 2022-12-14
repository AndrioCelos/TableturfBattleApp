const preGameForm = document.getElementById('preGameForm') as HTMLFormElement;
const newGameButton = document.getElementById('newGameButton')!;
const joinGameButton = document.getElementById('joinGameButton')!;
const nameBox = document.getElementById('nameBox') as HTMLInputElement;
const gameIDBox = document.getElementById('gameIDBox') as HTMLInputElement;
const maxPlayersBox = document.getElementById('maxPlayersBox') as HTMLSelectElement;
const preGameDeckEditorButton = document.getElementById('preGameDeckEditorButton') as HTMLLinkElement;
const preGameLoadingSection = document.getElementById('preGameLoadingSection')!;
const preGameLoadingLabel = document.getElementById('preGameLoadingLabel')!;
const preGameReplayButton = document.getElementById('preGameReplayButton') as HTMLLinkElement;

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

preGameForm.addEventListener('submit', e => {
	e.preventDefault();
	if (e.submitter?.id == 'newGameButton' || (e.submitter?.id == 'preGameImplicitSubmitButton' && !gameIDBox.value)) {
		const name = nameBox.value;
		window.localStorage.setItem('name', name);

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
	let data = new URLSearchParams();
	data.append('name', name);
	data.append('clientToken', clientToken);
	request.send(data.toString());
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

preGameDeckEditorButton.addEventListener('click', e => {
	e.preventDefault();
	showDeckList();
	setUrl('deckeditor');
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

	loadReplay(m[1]);
});

function loadReplay(base64: string) {
	if (stageDatabase.stages == null)
		throw new Error('Game data not loaded');

	base64 = base64.replaceAll('-', '+');
	base64 = base64.replaceAll('_', '/');
	const bytes = Base64.base64DecToArr(base64);
	const dataView = new DataView(bytes.buffer);
	if (dataView.getUint8(0) != 1) {
		alert('Unknown replay data version');
		return;
	}
	const n = dataView.getUint8(1);
	const stage = stageDatabase.stages[n & 0x1F];
	const numPlayers = n >> 5;

	let pos = 2;
	const players = [ ];
	currentReplay = { turns: [ ], placements: [ ], drawOrder: [ ], initialDrawOrder: [ ] };
	for (let i = 0; i < numPlayers; i++) {
		const len = dataView.getUint8(pos + 34);
		const player: Player = {
			name: new TextDecoder().decode(new DataView(bytes.buffer, pos + 35, len)),
			specialPoints: 0,
			isReady: false,
			colour: { r: dataView.getUint8(pos + 0), g: dataView.getUint8(pos + 1), b: dataView.getUint8(pos + 2) },
			specialColour: { r: dataView.getUint8(pos + 3), g: dataView.getUint8(pos + 4), b: dataView.getUint8(pos + 5) },
			specialAccentColour: { r: dataView.getUint8(pos + 6), g: dataView.getUint8(pos + 7), b: dataView.getUint8(pos + 8) },
			totalSpecialPoints: 0,
			passes: 0
		};
		players.push(player);

		const initialDrawOrder = [ ];
		const drawOrder = [ ];
		for (let j = 0; j < 2; j++) {
			initialDrawOrder.push(dataView.getUint8(pos + 24 + j) & 0xF);
			initialDrawOrder.push(dataView.getUint8(pos + 24 + j) >> 4 & 0xF);
		}
		for (let j = 0; j < 8; j++) {
			drawOrder.push(dataView.getUint8(pos + 26 + j) & 0xF);
			if (j == 7)
				player.uiBaseColourIsSpecialColour = (dataView.getUint8(pos + 26 + j) & 0x80) != 0;
			else
				drawOrder.push(dataView.getUint8(pos + 26 + j) >> 4 & 0xF);
		}
		currentReplay.initialDrawOrder.push(initialDrawOrder);
		currentReplay.drawOrder.push(drawOrder);

		pos += 35 + len;
	}

	for (let i = 0; i < 12; i++) {
		const turn = [ ]
		for (let j = 0; j < numPlayers; j++) {
			const cardNumber = dataView.getUint8(pos);
			const b = dataView.getUint8(pos + 1);
			const x = dataView.getInt8(pos + 2);
			const y = dataView.getInt8(pos + 3);
			if (b & 0x80)
				turn.push({ card: cardDatabase.get(cardNumber), isPass: true });
			else {
				const move: PlayMove = { card: cardDatabase.get(cardNumber), isPass: false, x, y, rotation: b & 0x03, isSpecialAttack: (b & 0x40) != 0 };
				turn.push(move);
			}
			pos += 4;
		}
		currentReplay.turns.push(turn);
	}

	currentGame = {
		id: 'replay',
		me: null,
		players: players,
		maxPlayers: numPlayers,
		turnNumber: 1,
		webSocket: null
	};

	board.resize(stage.copyGrid());
	const startSpaces = stage.getStartSpaces(numPlayers);
	for (let i = 0; i < numPlayers; i++)
		board.grid[startSpaces[i].x][startSpaces[i].y] = Space.SpecialInactive1 | i;
	board.refresh();

	loadPlayers(players);
	setUrl(`replay/${encodeToUrlSafeBase64(bytes)}`)
	initReplay();
}

let playerName = localStorage.getItem('name');
(document.getElementById('nameBox') as HTMLInputElement).value = playerName || '';

let settingUrl = false;
window.addEventListener('popstate', e => {
	if (!settingUrl)
		processUrl();
});

setLoadingMessage('Loading game data...');
