const newGameButton = document.getElementById('newGameButton')!;
const joinGameButton = document.getElementById('joinGameButton')!;

newGameButton.addEventListener('click', e => {
	const name = (document.getElementById('nameBox') as HTMLInputElement).value;
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
	request.send(data.toString());
});

joinGameButton.addEventListener('click', e => {
	const name = (document.getElementById('nameBox') as HTMLInputElement).value;
	window.localStorage.setItem('name', name);
	tryJoinGame(name, (document.getElementById('gameIDBox') as HTMLInputElement).value);
});

function tryJoinGame(name: string, idOrUrl: string) {
	const gameID = idOrUrl.substring(idOrUrl.lastIndexOf('#') + 1);
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(gameID)) {
		alert("Invalid game ID or link");
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
		} else if (request.status == 404) {
			alert("The game was not found.");
			window.location.hash = '#';
		} else if (request.status == 410) {
			alert("The game has already started.");
			window.location.hash = '#';
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

	const webSocket = new WebSocket(`${config.apiBaseUrl.replace(/(http)(s)?\:\/\//, 'ws$2://')}/websocket?gameID=${gameID}&clientToken=${clientToken}`);
	webSocket.addEventListener('open', e => {
		const request2 = new XMLHttpRequest();
		request2.open('GET', `${config.apiBaseUrl}/games/${gameID}/playerData/${clientToken}`);
		request2.addEventListener('load', e => {
			if (request2.status == 200) {
				const response = JSON.parse(request2.responseText);
				const playerData = response.playerData as PlayerData | null;

				currentGame = {
					id: gameID,
					me: playerData != null ? { playerIndex: playerData.playerIndex, hand: playerData.hand?.map(Card.fromJson) || null, deck: playerData.deck?.map(Card.fromJson) || null, cardsUsed: playerData.cardsUsed, move: playerData.move } : null,
					players: response.game.players,
					webSocket: webSocket
				};

				for (const li of playerListItems)
					playerList.removeChild(li);
				playerListItems.splice(0);
				for (let i = 0; i < 2; i++) {
					var el = document.createElement('li');
					el.innerText = i < currentGame.players.length ? currentGame.players[i].name : 'Waiting...';
					playerListItems.push(el);
					playerList.appendChild(el);
				}

				onGameStateChange(response.game, playerData);

				for (let i = 0; i < response.game.players.length; i++) {
					if (response.game.players[i].isReady)
						showReady(i);
				}

				if (playerData) {
					myPlayerIndex = playerData.playerIndex;
					if (playerData.move) {
						canPlay = false;
						board.autoHighlight = false;
						if (!playerData.move.isPass) {
							const move = playerData.move as PlayMove;
							board.cardPlaying = Card.fromJson(move.card);
							board.highlightX = move.x;
							board.highlightY = move.y;
							board.cardRotation = move.rotation;
							board.specialAttack = move.isSpecialAttack;
							board.refreshHighlight();
						}
					}
				}
			}
		});
		request2.send();
	});
	webSocket.addEventListener('message', e => {
		if (currentGame == null) return;
		let s = e.data as string;
		console.log(`>> ${s}`);
		if (s) {
			let payload = JSON.parse(s);
			if (payload.event == 'join') {
				currentGame.players.push(payload.data.player);
				playerListItems[payload.data.playerIndex].innerText = payload.data.player.name;
				updatePlayerListItem(payload.data.playerIndex);
			} else if (payload.event == 'playerReady') {
				currentGame.players[payload.data.playerIndex].isReady = true;
				updatePlayerListItem(payload.data.playerIndex);

				if (playContainers[payload.data.playerIndex].getElementsByTagName('div').length == 0) {
					showReady(payload.data.playerIndex);
				}
			} else if (payload.event == 'stateChange') {
				clearReady();
				onGameStateChange(payload.data, payload.playerData);
			} else if (payload.event == 'turn' || payload.event == 'gameEnd') {
				clearReady();
				board.autoHighlight = false;
				showSection('game');

				(async () => {
					let anySpecialAttacks = false;
					// Show the cards that were played.
					clearPlayContainers();
					for (let i = 0; i < currentGame.players.length; i++) {
						const player = currentGame.players[i];
						player.specialPoints = payload.data.game.players[i].specialPoints;
						player.totalSpecialPoints = payload.data.game.players[i].totalSpecialPoints;
						player.passes = payload.data.game.players[i].passes;

						const move = payload.data.moves[i];
						const button = new CardButton('checkbox', move.card);
						if (move.isSpecialAttack) {
							anySpecialAttacks = true;
							button.element.classList.add('specialAttack');
						} else if (move.isPass) {
							const el = document.createElement('div');
							el.className = 'passLabel';
							el.innerText = 'Pass';
							button.element.appendChild(el);
						}
						button.inputElement.hidden = true;
						playContainers[i].append(button.element);
					}

					await playInkAnimations(payload.data, anySpecialAttacks);
					updateHand(payload.playerData.hand);
					turnNumberLabel.setTurnNumber(payload.data.game.turnNumber);
					clearPlayContainers();
					if (payload.event == 'gameEnd') {
						document.getElementById('gameSection')!.classList.add('gameEnded');
						showResult();
					} else {
						canPlay = myPlayerIndex != null;
						board.autoHighlight = canPlay;
						setupControlsForPlay();
					}
				})();
			}
		}
	});
	webSocket.addEventListener('close', e => {
		document.getElementById('errorModal')!.hidden = false;
	});
}

{
	const name = window.localStorage.getItem('name');
	(document.getElementById('nameBox') as HTMLInputElement).value = name || '';
	if (window.location.hash != '')	{
		(document.getElementById('gameIDBox') as HTMLInputElement).value = window.location.hash;
		if (name != null)
			tryJoinGame(name, window.location.hash)
	}
}
