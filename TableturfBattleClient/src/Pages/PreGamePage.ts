const newGameButton = document.getElementById('newGameButton')!;
const joinGameButton = document.getElementById('joinGameButton')!;
const nameBox = document.getElementById('nameBox') as HTMLInputElement;
const gameIDBox = document.getElementById('gameIDBox') as HTMLInputElement;
const maxPlayersBox = document.getElementById('maxPlayersBox') as HTMLSelectElement;

let shownMaxPlayersWarning = false;

maxPlayersBox.addEventListener('change', () => {
	if (!shownMaxPlayersWarning && maxPlayersBox.value != '2') {
		if (confirm('Tableturf Battle is designed for two players and may not be well-balanced for more. Do you want to continue?'))
			shownMaxPlayersWarning = true;
		else
		maxPlayersBox.value = '2';
	}
});

(document.getElementById('preGameForm') as HTMLFormElement).addEventListener('submit', e => {
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
	} else {
		const name = nameBox.value;
		window.localStorage.setItem('name', name);
		tryJoinGame(name, gameIDBox.value, false);
	}
});

function setGameUrl(gameID: string | null) {
	if (canPushState) {
		try {
			history.pushState(null, '', `game/${gameID}`);
		} catch {
			canPushState = false;
			location.hash = `#game/${gameID}`;
		}
	} else
		location.hash = `#game/${gameID}`;
}

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
			if (fromInitialLoad)
				clearPreGameForm(true);
			else {
				gameIDBox.focus();
				gameIDBox.setSelectionRange(0, gameIDBox.value.length);
			}
		}
	});
	let data = new URLSearchParams();
	data.append('name', name);
	data.append('clientToken', clientToken);
	request.send(data.toString());
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
		if (canPushState) {
			try {
				history.pushState(null, '', '../..');
			} catch {
				canPushState = false;
			}
		}
		if (location.hash)
			location.hash = '';
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
}

const playerName = localStorage.getItem('name');
(document.getElementById('nameBox') as HTMLInputElement).value = playerName || '';

function processUrl() {
	const m = /^(.*)\/game\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.exec(location.toString());
	if (m)
		presetGameID(m[2]);
	else if (location.hash) {
		canPushState = false;
		presetGameID(location.hash);
	} else {
		clearPreGameForm(false);
		showSection('preGame');
	}
}

window.addEventListener('popstate', () => {
	processUrl();
});
processUrl();
