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

function tryJoinGame(name: string, idOrUrl: string, fromInitialLoad: boolean) {
	const gameID = idOrUrl.substring(idOrUrl.lastIndexOf('#') + 1);
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(gameID)) {
		alert("Invalid game ID or link");
		if (fromInitialLoad)
			clearPreGameForm();
		else {
			gameIDBox.focus();
			gameIDBox.setSelectionRange(0, gameIDBox.value.length);
		}
		return;
	}

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
				clearPreGameForm();
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
	window.location.hash = `#${gameID}`;
	initLobbyPage(window.location.toString());

	myPlayerIndex = setupWebSocket(gameID, myPlayerIndex);
}

function backPreGameForm() {
	document.getElementById('preGameDefaultSection')!.hidden = false;
	document.getElementById('preGameJoinSection')!.hidden = true;
	window.location.hash = '';
}
function clearPreGameForm() {
	backPreGameForm();
	currentGame = null;
	gameIDBox.value = '';
}

document.getElementById('preGameBackButton')!.addEventListener('click', e => {
	e.preventDefault();
	backPreGameForm();
})

const playerName = window.localStorage.getItem('name');
(document.getElementById('nameBox') as HTMLInputElement).value = playerName || '';
if (window.location.hash != '')	{
	document.getElementById('preGameDefaultSection')!.hidden = true;
	document.getElementById('preGameJoinSection')!.hidden = false;
	(document.getElementById('gameIDBox') as HTMLInputElement).value = window.location.hash;
	if (playerName)
		tryJoinGame(playerName, window.location.hash, true);
}
