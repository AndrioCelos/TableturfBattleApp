declare var baseUrl: string;

const errorDialog = document.getElementById('errorDialog') as HTMLDialogElement;
const errorMessage = document.getElementById('errorMessage')!;
const errorDialogForm = document.getElementById('errorDialogForm') as HTMLFormElement;

let initialised = false;
let initialiseCallback: (() => void) | null = null;
let canPushState = isSecureContext && location.protocol != 'file:';

const decks: Deck[] = [ new Deck('Starter Deck', [ 6, 34, 159, 13, 45, 137, 22, 52, 141, 28, 55, 103, 40, 56, 92 ], true) ];
let selectedDeck: Deck | null = null;
let editingDeck = false;
let deckModified = false;
let shouldConfirmLeavingGame = false;

function delay(ms: number, abortSignal?: AbortSignal) {
	return new Promise((resolve, reject) => {
		if (abortSignal?.aborted) {
			reject(new DOMException('Operation cancelled', 'AbortError'));
			return;
		}
		const timeout = setTimeout(() => resolve(null), ms);
		abortSignal?.addEventListener('abort', _ => {
			clearTimeout(timeout);
			reject(new DOMException('Operation cancelled', 'AbortError'));
		});
	});
}

/**
 * Schedules the specified callback to run when game data is initialised, or runs it synchronously if already initialised.
 * Only one method may be scheduled this way.
 */
function onInitialise(callback: () => void) {
	if (initialised)
		callback();
	else
		initialiseCallback = callback;
}

function initCardDatabase(cards: Card[]) {
	deckEditInitCardDatabase(cards);
}
function initStageDatabase(stages: Stage[]) {
	lobbyInitStageDatabase(stages);
	deckEditInitStageDatabase(stages);
}

// Pages
const pages = new Map<string, HTMLDivElement>();
for (var id of [ 'noJS', 'preGame', 'lobby', 'game', 'deckList', 'deckEdit' ]) {
	let el = document.getElementById(`${id}Page`) as HTMLDivElement;
	if (!el) throw new EvalError(`Element not found: ${id}Page`);
	pages.set(id, el);
}

function showPage(key: string) {
	for (const [key2, el] of pages) {
		el.hidden = key2 != key;
	}
}

function setClientToken(token: string) {
	window.localStorage.setItem('clientToken', token);
	clientToken = token;
}

function setUrl(path: string) {
	settingUrl = true;
	try {
		if (canPushState) {
			try {
				history.pushState(null, '', path);
			} catch {
				canPushState = false;
				location.hash = `#${path}`;
			}
		} else
			location.hash = `#${path}`;
	} finally {
		settingUrl = false;
	}
}
function setGameUrl(gameID: string) { setUrl(`game/${gameID}`); }
function clearUrlFromGame() {
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

function onGameStateChange(game: any, playerData: PlayerData | null) {
	if (currentGame == null)
		throw new Error('currentGame is null');
	clearPlayContainers();
	currentGame.state = game.state;

	if (game.board) {
		board.flip = playerData != null && playerData.playerIndex % 2 != 0;
		if (board.flip) gamePage.classList.add('boardFlipped');
		else gamePage.classList.remove('boardFlipped');
		board.resize(game.board);
		board.startSpaces = game.startSpaces;
		board.refresh();
	}
	loadPlayers(game.players);
	gamePage.dataset.myPlayerIndex = playerData ? playerData.playerIndex.toString() : '';
	gamePage.dataset.uiBaseColourIsSpecialColour = playerData && game.players[playerData.playerIndex].uiBaseColourIsSpecialColour ? 'true' : 'false';

	redrawModal.hidden = true;
	gamePage.classList.remove('gameEnded');
	switch (game.state) {
		case GameState.WaitingForPlayers:
			showPage('lobby');
			clearConfirmLeavingGame();
			lobbySelectedStageSection.hidden = true;
			lobbyStageSection.hidden = !playerData || game.players[playerData.playerIndex]?.isReady;
			break;
		case GameState.Preparing:
			showPage('lobby');
			if (currentGame.me) setConfirmLeavingGame();
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
			board.autoHighlight = false;
			redrawModal.hidden = true;
			if (playerData) {
				updateHandAndDeck(playerData);
				initGame();
			} else
				initSpectator();

			currentGame.turnNumber = game.turnNumber;
			gameButtonsContainer.hidden = currentGame.me == null || game.state == GameState.Ended;

			switch (game.state) {
				case GameState.Redraw:
					if (currentGame.me) setConfirmLeavingGame();
					redrawModal.hidden = currentGame.me == null || currentGame.players[currentGame.me.playerIndex].isReady;
					turnNumberLabel.setTurnNumber(null);
					canPlay = false;
					timeLabel.faded = redrawModal.hidden;
					timeLabel.paused = false;
					break;
				case GameState.Ongoing:
					if (currentGame.me) setConfirmLeavingGame();
					turnNumberLabel.setTurnNumber(game.turnNumber);
					board.autoHighlight = true;
					canPlay = currentGame.me != null && !currentGame.players[currentGame.me.playerIndex].isReady;
					timeLabel.faded = !canPlay;
					timeLabel.paused = false;
					resetPlayControls();
					break;
				case GameState.Ended:
					clearConfirmLeavingGame();
					gamePage.classList.add('gameEnded');
					turnNumberLabel.setTurnNumber(null);
					timeLabel.hide();
					canPlay = false;
					showResult();
					break;
			}
			break;
	}
}

let errorDialogCallback: ((e: Event) => void) | null = null;
function communicationError(message?: string, showButton?: boolean, callback?: (e: Event) => void) {
	clearConfirmLeavingGame();
	preGameLoadingSection.hidden = true;
	errorMessage.innerText = message ?? 'A communication error has occurred.\nPlease reload the page to rejoin.';
	errorDialogCallback = callback ?? null;
	errorDialogForm.hidden = showButton != true;
	errorDialog.showModal();
}
errorDialog.addEventListener('close', e => {
	if (errorDialogCallback) {
		errorDialogCallback(e);
		errorDialogCallback = null;
	}
});

function playerDataReviver(key: string, value: any) {
	return !value ? value
		: key == 'hand' || key == 'deck'
		? (value as (Card | number)[]).map(v => typeof v == 'number' ? cardDatabase.get(v) : Card.fromJson(v))
		: key == 'card'
		? typeof value == 'number' ? cardDatabase.get(value) : Card.fromJson(value)
		: value;
}

function setupWebSocket(gameID: string) {
	const webSocket = new WebSocket(`${config.apiBaseUrl.replace(/(http)(s)?\:\/\//, 'ws$2://')}/websocket?gameID=${gameID}&clientToken=${clientToken}`);
	webSocket.addEventListener('open', _ => {
		enterGameTimeout = setTimeout(() => {
			webSocket.close(1002, 'Timeout waiting for a sync message');
			enterGameTimeout = null;
			communicationError();
		}, 30000);
	});
	webSocket.addEventListener('message', e => {
		let s = e.data as string;
		console.log(`>> ${s}`);
		if (s) {
			let payload = JSON.parse(s, playerDataReviver);
			if (payload.event == 'sync') {
				if (enterGameTimeout != null) {
					clearTimeout(enterGameTimeout);
					enterGameTimeout = null;
				}
				setLoadingMessage(null);
				if (!e.data) {
					webSocket.close();
					alert('The game was not found.');
				} else {
					currentGame = {
						id: gameID,
						state: payload.data.state,
						me: payload.playerData,
						players: payload.data.players,
						maxPlayers: payload.data.maxPlayers,
						turnNumber: payload.data.turnNumber,
						turnTimeLimit: payload.data.turnTimeLimit,
						turnTimeLeft: payload.data.turnTimeLeft,
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

					lobbyTimeLimitBox.value = currentGame.turnTimeLimit?.toString() ?? '';
					lobbyTimeLimitUnit.hidden = currentGame.turnTimeLimit == null;

					for (let i = 0; i < playerBars.length; i++) {
						playerBars[i].visible = i < currentGame.maxPlayers;
					}

					for (const button of stageButtons)
						button.setStartSpaces(currentGame.maxPlayers);

					onGameStateChange(payload.data, payload.playerData);

					for (let i = 0; i < currentGame.players.length; i++) {
						if (currentGame.players[i].isReady)
							showReady(i);
					}

					if (currentGame.me) {
						if (currentGame.me.move) {
							canPlay = false;
							timeLabel.faded = true;
							board.autoHighlight = false;
							if (!currentGame.me.move.isPass) {
								const move = currentGame.me.move as PlayMove;
								board.cardPlaying = move.card;
								board.highlightX = move.x;
								board.highlightY = move.y;
								board.cardRotation = move.rotation;
								board.specialAttack = move.isSpecialAttack;
								board.refreshHighlight();
							}
						}
					}

					timeLabel.paused = false;
					if (currentGame.turnTimeLeft) {
						timeLabel.setTime(currentGame.turnTimeLeft);
						timeLabel.show();
					} else
						timeLabel.hide();
				}
			} else {
				if (currentGame == null) {
					communicationError();
					return;
				}
				switch (payload.event) {
					case 'join':
						if (payload.data.playerIndex == currentGame.players.length) {
							currentGame.players.push(payload.data.player);
							playerListItems[payload.data.playerIndex].innerText = payload.data.player.name;
							updatePlayerListItem(payload.data.playerIndex);
						}
						else
							communicationError();
						break;
					case 'playerReady':
						currentGame.players[payload.data.playerIndex].isReady = true;
						updatePlayerListItem(payload.data.playerIndex);

						if (payload.data.playerIndex == currentGame.me?.playerIndex) {
							lobbyStageSection.hidden = true;
							lobbyDeckSection.hidden = true;
						}

						if (playContainers[payload.data.playerIndex].getElementsByTagName('div').length == 0) {
							showReady(payload.data.playerIndex);
						}
						break;
					case 'stateChange':
						clearReady();
						onGameStateChange(payload.data, payload.playerData);
						if (payload.data.turnTimeLeft) {
							timeLabel.paused = false;
							timeLabel.setTime(payload.data.turnTimeLeft);
							timeLabel.show();
						}
						break;
					case 'turn':
					case 'gameEnd':
						clearReady();
						board.autoHighlight = false;
						showPage('game');
						currentGame.turnNumber = payload.data.game.turnNumber;

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
								el.className = move.isTimeout ? 'passLabel timeout' : 'passLabel';
								el.innerText = 'Pass';
								button.element.appendChild(el);
							}
							button.inputElement.hidden = true;
							playContainers[i].append(button.element);
						}
						timeLabel.paused = true;
						if (payload.data.game.turnTimeLeft)
							timeLabel.setTime(payload.data.game.turnTimeLeft);

						(async () => {
							await playInkAnimations(payload.data, anySpecialAttacks);
							if (payload.playerData) updateHandAndDeck(payload.playerData);
							turnNumberLabel.setTurnNumber(payload.data.game.turnNumber);
							clearPlayContainers();
							if (payload.event == 'gameEnd') {
								currentGame.state = GameState.Ended;
								clearConfirmLeavingGame();
								gameButtonsContainer.hidden = true;
								passButton.enabled = false;
								specialButton.enabled = false;
								gamePage.classList.add('gameEnded');
								timeLabel.hide();
								showResult();
							} else {
								canPlay = currentGame.me != null;
								board.autoHighlight = canPlay;
								resetPlayControls();
								timeLabel.faded = !canPlay;
								timeLabel.paused = false;
								if (payload.data.game.turnTimeLeft)
									timeLabel.show();
							}
						})();
						break;
				}
			}
		}
	});
	webSocket.addEventListener('close', webSocket_close);
}
function webSocket_close() {
	communicationError();
}

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
	currentReplay = { turns: [ ], placements: [ ], replayPlayerData: [ ], watchingPlayer: 0 };
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

		const deck = [ ];
		const initialDrawOrder = [ ];
		const drawOrder = [ ];
		for (let j = 0; j < 15; j++) {
			deck.push(cardDatabase.get(dataView.getUint8(pos + 9 + j)));
		}
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
		currentReplay.replayPlayerData.push({ deck, initialDrawOrder, drawOrder });
		pos += 35 + len;
	}

	for (let i = 0; i < 12; i++) {
		const turn = [ ];
		for (let j = 0; j < numPlayers; j++) {
			const cardNumber = dataView.getUint8(pos);
			const b = dataView.getUint8(pos + 1);
			const x = dataView.getInt8(pos + 2);
			const y = dataView.getInt8(pos + 3);
			if (b & 0x80)
				turn.push({ card: cardDatabase.get(cardNumber), isPass: true, isTimeout: (b & 0x20) != 0 });
			else {
				const move: PlayMove = { card: cardDatabase.get(cardNumber), isPass: false, isTimeout: (b & 0x20) != 0, x, y, rotation: b & 0x03, isSpecialAttack: (b & 0x40) != 0 };
				turn.push(move);
			}
			pos += 4;
		}
		currentReplay.turns.push(turn);
	}

	currentGame = {
		id: 'replay',
		state: GameState.Redraw,
		me: null,
		players: players,
		maxPlayers: numPlayers,
		turnNumber: 0,
		turnTimeLimit: null,
		turnTimeLeft: null,
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

function setConfirmLeavingGame() {
	if (!shouldConfirmLeavingGame) {
		shouldConfirmLeavingGame = true;
		window.addEventListener('beforeunload', onBeforeUnload_game);
	}
}

function clearConfirmLeavingGame() {
	if (shouldConfirmLeavingGame) {
		shouldConfirmLeavingGame = false;
		window.removeEventListener('beforeunload', onBeforeUnload_game);
	}
}

function clearGame() {
	if (currentGame?.webSocket) {
		currentGame.webSocket.removeEventListener('close', webSocket_close);
		currentGame.webSocket.close();
	}
	currentGame = null;
	currentReplay = null;
	clearConfirmLeavingGame();
}

function processUrl() {
	if (deckModified) {
		if (!confirm('You have unsaved changes to your deck. Are you sure you want to leave?')) {
			setUrl('deckeditor');
			return false;
		}
	} else if (shouldConfirmLeavingGame) {
		if (!confirm('This will disconnect you from a game in progress. Are you sure you want to leave?')) {
			setUrl(`game/${currentGame!.id}`);
			return false;
		}
	}
	stopEditingDeck();
	errorDialog.close();
	clearGame();
	if (location.pathname.endsWith('/deckeditor') || location.hash == '#deckeditor')
		onInitialise(showDeckList);
	else {
		showPage('preGame');
		if (location.pathname.endsWith('/help') || location.hash == '#help')
			helpDialog.showModal();
		else {
			helpDialog.close();
			const m = /[/#](?:(game)|replay)\/([A-Za-z0-9+/=\-_]+)$/.exec(location.toString());
			if (m) {
				if (m[1])
					presetGameID(m[2]);
				else
					onInitialise(() => loadReplay(m[2]));
			} else if (location.hash) {
				canPushState = false;
				presetGameID(location.hash);
			} else {
				clearPreGameForm(false);
			}
		}
	}
	return true;
}

function onBeforeUnload_game(e: BeforeUnloadEvent) {
	e.preventDefault();
	return 'This will disconnect you from a game in progress.';
}

function parseGameID(s: string) {
	const m = /(?:^|[#/])([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(s);
	return m ? m[1] : null;
}

function presetGameID(url: string) {
	showPage('preGame');

	const gameID = parseGameID(url);
	if (!gameID) {
		joinGameError('Invalid game ID or link.', true);
		return;
	}

	onInitialise(() => {
		let request = new XMLHttpRequest();
		request.open('GET', `${config.apiBaseUrl}/games/${gameID}/playerData` + (clientToken ? `?clientToken=${clientToken}` : ''));
		request.addEventListener('load', () => {
			switch (request.status) {
				case 200:
					let response = JSON.parse(request.responseText);

					if (response.playerData) {
						// We are already in the game; go to the game page immediately.
						onInitialise(() => getGameInfo(gameID, response.playerData.playerIndex));
					} else {
						// We're not already in the game; offer the option to join or spectate.
						document.getElementById('preGameDefaultSection')!.hidden = true;
						document.getElementById('preGameJoinSection')!.hidden = false;
						(document.getElementById('gameIDBox') as HTMLInputElement).value = gameID;
						setLoadingMessage(null);
					}
					break;
				case 404: joinGameError('The room was not found.', true); break;
				default: joinGameError('Unable to join the room.', true); break;
			}
		});
		request.addEventListener('error', () => {
			joinGameError('Unable to join the room.', true);
		});
		request.send();
		setLoadingMessage('Checking room info...');
	});
}

function encodeToUrlSafeBase64(array: Uint8Array) {
	let base64 = Base64.base64EncArr(array);
	base64 = base64.replaceAll('+', '-');
	base64 = base64.replaceAll('/', '_');
	return base64;
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
function resetAnimation(el: HTMLElement) {
	el.style.animation = 'none';
	el.offsetHeight;  // Trigger a reflow.
	el.style.animation = '';
}


document.getElementById('noJSPage')!.innerText = 'Loading client...';

if (config.discordUrl) {
	(document.getElementById('discordLink') as HTMLLinkElement).href = config.discordUrl;
	if (config.discordTitle)
		(document.getElementById('discordLink') as HTMLLinkElement).innerText = `Discord – ${config.discordTitle}`;
} else
	document.getElementById('discordSection')!.hidden = true;

Promise.all([ cardDatabase.loadAsync().then(initCardDatabase), stageDatabase.loadAsync().then(initStageDatabase) ])
	.then(() => {
		initialised = true;
		setLoadingMessage(null);
		if (initialiseCallback)
			initialiseCallback();
	}, initError);

function initError() {
	preGameLoadingSection.hidden = true;
	communicationError('Unable to load game data from the server.', false);
}

showPage('preGame');
window.addEventListener('load', processUrl);
