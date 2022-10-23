let canPushState = isSecureContext && location.protocol != 'file:';

const decks: Deck[] = [ new Deck('Starter Deck', [ 6, 34, 159, 13, 45, 137, 22, 52, 141, 28, 55, 103, 40, 56, 92 ], true) ];
let selectedDeck: Deck | null = null;

function delay(ms: number) { return new Promise(resolve => setTimeout(() => resolve(null), ms)); }

// Sections
const sections = new Map<string, HTMLDivElement>();
for (var id of [ 'noJS', 'preGame', 'lobby', 'game', 'deckList', 'deckEdit' ]) {
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
	gamePage.classList.remove('gameEnded');
	switch (game.state) {
		case GameState.WaitingForPlayers:
			showSection('lobby');
			lobbySelectedStageSection.hidden = true;
			lobbyStageSection.hidden = !playerData || game.players[playerData.playerIndex]?.isReady;
			break;
		case GameState.Preparing:
			showSection('lobby');
			if (selectedStageButton)
				lobbySelectedStageSection.removeChild(selectedStageButton.element);
			selectedStageButton = new StageButton(stageDatabase.stages?.find(s => s.name == game.stage)!);
			selectedStageButton.element.id = 'selectedStageButton';
			selectedStageButton.inputElement.disabled = true;
			selectedStageButton.inputElement.hidden = true;
			selectedStageButton.setStartSpaces(game.players.length);
			lobbySelectedStageSection.appendChild(selectedStageButton.element);

			lobbySelectedStageSection.hidden = false;
			initDeckSelection();
			break;
		case GameState.Redraw:
		case GameState.Ongoing:
		case GameState.Ended:
			if (playerData)
				updateHand(playerData.hand);
			board.autoHighlight = false;
			redrawModal.hidden = true;
			showSection('game');

			gameButtonsContainer.hidden = currentGame.me == null || game.state == GameState.Ended;

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
					gamePage.classList.add('gameEnded');
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
		request2.open('GET', `${config.apiBaseUrl}/games/${gameID}/playerData?clientToken=${clientToken}`);
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
					playerListItems.push(el);
					playerList.appendChild(el);
					updatePlayerListItem(i);
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
					lobbyStageSection.hidden = true;
					lobbyDeckSection.hidden = true;
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
						gameButtonsContainer.hidden = true;
						gamePage.classList.add('gameEnded');
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

function processUrl() {
	if (deckModified) {
		if (!confirm('You have unsaved changes to your deck. Are you sure you want to leave?')) {
			setUrl('deckeditor');
			return false;
		}
	}
	stopEditingDeck();
	if (location.pathname.endsWith('/deckeditor') || location.hash == '#deckeditor')
		showDeckList();
	else {
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
	return true;
}

function isInternetExplorer() {
	return !!(window.document as any).documentMode;  // This is a non-standard property implemented only by Internet Explorer.
}

if (isInternetExplorer()) {
	alert("You seem to be using an unsupported browser. Some layout or features of this app may not work correctly.");
}

function clearChildren(el: Element) {
	let el2;
	while (el2 = el.firstChild)
		el.removeChild(el2);
}

cardDatabase.loadAsync().then(initCardDatabase).catch(() => communicationError);
