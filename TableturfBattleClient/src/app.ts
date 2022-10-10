function delay(ms: number) { return new Promise(resolve => setTimeout(() => resolve(null), ms)); }

// Sections
const sections = new Map<string, HTMLDivElement>();
for (var id of [ 'noJS', 'preGame', 'lobby', 'deck', 'game' ]) {
	let el = document.getElementById(`${id}Section`) as HTMLDivElement;
	if (!el) throw new EvalError(`Element not found: ${id}Section`);
	sections.set(id, el);
}

function showSection(key: string) {
	for (const [key2, el] of sections) {
		el.hidden = key2 != key;
	}
}

function setClientToken(token: string) {
	window.localStorage.setItem('clientToken', token);
	clientToken = token;
}

function onGameStateChange(game: any, playerData: any) {
	if (currentGame == null)
		throw new Error('currentGame is null');
	clearPlayContainers();
	if (game.board) {
		board.resize(game.board);
		board.refresh();
	}
	loadPlayers(game.players);
	redrawModal.hidden = true;
	document.getElementById('gameSection')!.classList.remove('gameEnded');
	switch (game.state) {
		case GameState.WaitingForPlayers:
			showSection('lobby');
			document.getElementById('lobbyStageSection')!.hidden = !playerData || game.players[playerData.playerIndex]?.isReady;
			break;
		case GameState.Preparing:
			showSection('deck');
			break;
		case GameState.Redraw:
		case GameState.Ongoing:
		case GameState.Ended:
			if (playerData)
				updateHand(playerData.hand);
			board.autoHighlight = false;
			redrawModal.hidden = true;
			showSection('game');

			switch (game.state) {
				case GameState.Redraw:
					redrawModal.hidden = false;
					turnNumberLabel.setTurnNumber(null);
					canPlay = false;
					break;
				case GameState.Ongoing:
					turnNumberLabel.setTurnNumber(game.turnNumber);
					board.autoHighlight = true;
					canPlay = currentGame.me != null && !currentGame.players[currentGame.me.playerIndex].isReady;
					setupControlsForPlay();
					break;
				case GameState.Ended:
					document.getElementById('gameSection')!.classList.add('gameEnded');
					turnNumberLabel.setTurnNumber(null);
					canPlay = false;
					showResult();
					break;
			}
			break;
	}
}

function communicationError() {
	document.getElementById('errorModal')!.hidden = false;
}

function setupWebSocket(gameID: string, myPlayerIndex: number | null) {
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
					maxPlayers: response.game.maxPlayers,
					webSocket: webSocket
				};

				for (const li of playerListItems)
					playerList.removeChild(li);
				playerListItems.splice(0);
				for (let i = 0; i < currentGame.maxPlayers; i++) {
					var el = document.createElement('li');
					el.innerText = i < currentGame.players.length ? currentGame.players[i].name : 'Waiting...';
					playerListItems.push(el);
					playerList.appendChild(el);
				}

				for (let i = 0; i < playerBars.length; i++) {
					playerBars[i].visible = i < currentGame.maxPlayers;
				}

				for (const button of stageButtons)
					button.setStartSpaces(currentGame.maxPlayers);

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
		if (currentGame == null)
			return;
		let s = e.data as string;
		console.log(`>> ${s}`);
		if (s) {
			let payload = JSON.parse(s);
			if (payload.event == 'join') {
				if (payload.data.playerIndex == currentGame.players.length) {
					currentGame.players.push(payload.data.player);
					playerListItems[payload.data.playerIndex].innerText = payload.data.player.name;
					updatePlayerListItem(payload.data.playerIndex);
				}
				else
					communicationError();
			} else if (payload.event == 'playerReady') {
				currentGame.players[payload.data.playerIndex].isReady = true;
				updatePlayerListItem(payload.data.playerIndex);

				if (payload.data.playerIndex == currentGame.me?.playerIndex) {
					document.getElementById('lobbyStageSection')!.hidden = true;
				}

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
		communicationError();
	});
	return myPlayerIndex;
}

showSection('preGame');

function isInternetExplorer() {
	return !!(window.document as any).documentMode;  // This is a non-standard property implemented only by Internet Explorer.
}

if (isInternetExplorer()) {
	alert("You seem to be using an unsupported browser. Some layout or features of this app may not work correctly.");
}
