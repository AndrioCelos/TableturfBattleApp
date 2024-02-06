declare var baseUrl: string;

const CUSTOM_CARD_START = -10000;  // TODO: Card numbers in replays shall be expanded to 2 bytes.
const RECEIVED_CUSTOM_CARD_START = -20000;
const UNSAVED_CUSTOM_CARD_INDEX = CUSTOM_CARD_START + 1;
const defaultColours = [
	[ { r: 236, g: 249, b: 1 }, { r: 250, g: 158, b: 0 }, { r: 249, g: 249, b: 31 } ],
	[ { r: 74, g: 92, b: 252 }, { r: 1, g: 237, b: 254 }, { r: 213, g: 225, b: 225 } ],
	[ { r: 249, g: 6, b: 224 }, { r: 128, g: 6, b: 249 }, { r: 235, g: 180, b: 253 } ],
	[ { r: 6, g: 249, b: 148 }, { r: 6, g: 249, b: 6 }, { r: 180, g: 253, b: 199 } ]
];
let uiBaseColourIsSpecialColourOutOfGame = true;
let uiBaseColourIsSpecialColourPerPlayer = [ true, false, true, true ];

const errorDialog = document.getElementById('errorDialog') as HTMLDialogElement;
const errorMessage = document.getElementById('errorMessage')!;
const errorDialogForm = document.getElementById('errorDialogForm') as HTMLFormElement;

let initialised = false;
let initialiseCallback: (() => void) | null = null;
let canPushState = isSecureContext && location.protocol != 'file:';

const decks = [ new SavedDeck('Starter Deck', 0, [ 6, 34, 159, 13, 45, 137, 22, 52, 141, 28, 55, 103, 40, 56, 92 ], new Array(15).fill(1), true) ];
let selectedDeck: SavedDeck | null = null;
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
	galleryInitCardDatabase(cards);
	if (!cards.find(c => c.number < 0)) {
		gameSetupAllowUpcomingCardsBox.parentElement!.hidden = true;
		lobbyAllowUpcomingCardsBox.parentElement!.hidden = true;
	}
}
function initStageDatabase(stages: Stage[]) {
	preGameInitStageDatabase(stages);
	lobbyInitStageDatabase(stages);
	deckEditInitStageDatabase(stages);
}

// Pages
const pages = new Map<string, HTMLDivElement>();
for (var id of [ 'noJS', 'preGame', 'lobby', 'game', 'deckList', 'deckEdit', 'gallery' ]) {
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
	localStorage.setItem('clientToken', token);
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

function onGameSettingsChange() {
	if (currentGame == null) return;
	if (lobbyTimeLimitBox.value != currentGame.game.turnTimeLimit?.toString() ?? '')
		lobbyTimeLimitBox.value = currentGame.game.turnTimeLimit?.toString() ?? '';
	lobbyAllowUpcomingCardsBox.checked = currentGame.game.allowUpcomingCards;
}

function onGameStateChange(game: any, playerData: PlayerData | null) {
	if (currentGame == null)
		throw new Error('currentGame is null');

	const isSameTurnReconnect = currentGame.game.state == GameState.Ongoing && currentGame.game.turnNumber == turnNumberLabel.turnNumber;

	if (!isSameTurnReconnect) clearPlayContainers();
	currentGame.game.state = game.state;

	if (game.board) {
		board.flip = playerData != null && playerData.playerIndex % 2 != 0;
		if (board.flip) gamePage.classList.add('boardFlipped');
		else gamePage.classList.remove('boardFlipped');
		if (!isSameTurnReconnect) board.resize(game.board);
		board.startSpaces = game.startSpaces;
		if (!isSameTurnReconnect) board.refresh();
	}
	if (currentGame.game.state != GameState.Ongoing || currentGame.game.turnNumber != turnNumberLabel.turnNumber)
		loadPlayers(game.players);
	gamePage.dataset.myPlayerIndex = playerData ? playerData.playerIndex.toString() : '';
	gamePage.dataset.uiBaseColourIsSpecialColour = (userConfig.colourLock
		? (playerData?.playerIndex ?? 0) != 1
		: game.players[playerData?.playerIndex ?? 0]?.uiBaseColourIsSpecialColour ?? true).toString();

	if (game.state != GameState.WaitingForPlayers)
		lobbyLockSettings(true);

	redrawModal.hidden = true;
	gamePage.classList.remove('gameEnded');
	switch (game.state) {
		case GameState.WaitingForPlayers:
		case GameState.ChoosingStage:
			initLobbyPage(window.location.toString());
			showPage('lobby');
			clearConfirmLeavingGame();
			showStageSelectionForm(playerData?.stageSelectionPrompt ?? null, playerData && game.players[playerData.playerIndex]?.isReady);
			lobbySelectedStageSection.hidden = true;
			break;
		case GameState.ChoosingDeck:
			showPage('lobby');
			if (currentGame.me) setConfirmLeavingGame();
			if (selectedStageIndicator)
				lobbySelectedStageSection.removeChild(selectedStageIndicator.buttonElement);
			selectedStageIndicator = new StageButton(stageDatabase.stages![game.stage]);
			selectedStageIndicator.buttonElement.id = 'selectedStageButton';
			selectedStageIndicator.buttonElement.disabled = true;
			selectedStageIndicator.setStartSpaces(game.players.length);
			lobbySelectedStageSection.appendChild(selectedStageIndicator.buttonElement);

			lobbySelectedStageSection.hidden = false;
			initDeckSelection();
			break;
		case GameState.Redraw:
		case GameState.Ongoing:
		case GameState.GameEnded:
		case GameState.SetEnded:
			redrawModal.hidden = true;
			if (playerData) {
				updateHandAndDeck(playerData);
				initGame();
			} else
				initSpectator();

			currentGame.game.turnNumber = game.turnNumber;
			gameButtonsContainer.hidden = currentGame.me == null || game.state == GameState.GameEnded || game.state == GameState.SetEnded;

			switch (game.state) {
				case GameState.Redraw:
					if (currentGame.me) setConfirmLeavingGame();
					redrawModal.hidden = currentGame.me == null || currentGame.game.players[currentGame.me.playerIndex].isReady;
					turnNumberLabel.turnNumber = null;
					canPlay = false;
					timeLabel.faded = redrawModal.hidden;
					timeLabel.paused = false;
					break;
				case GameState.Ongoing:
					if (currentGame.me) setConfirmLeavingGame();
					turnNumberLabel.turnNumber = game.turnNumber;
					board.autoHighlight = true;
					canPlay = currentGame.me != null && !currentGame.game.players[currentGame.me.playerIndex].isReady;
					timeLabel.faded = !canPlay;
					timeLabel.paused = false;
					if (!isSameTurnReconnect) {
						for (let i = 0; i < currentGame.game.players.length; i++)
							showWaiting(i);
						resetPlayControls();
					}
					break;
				case GameState.GameEnded:
				case GameState.SetEnded:
					clearConfirmLeavingGame();
					gamePage.classList.add('gameEnded');
					turnNumberLabel.turnNumber = null;
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
		: key == 'hand' || key == 'cards'
		? (value as (Card | number)[]).map(v => typeof v == 'number' ? cardDatabase.get(v) : Card.fromJson(v))
		: key == 'card'
		? typeof value == 'number' ? cardDatabase.get(value) : Card.fromJson(value)
		: value;
}

function setupWebSocket(gameID: string) {
	const webSocket = new WebSocket(`${config.apiBaseUrl.replace(/(http)(s)?\:\/\//, 'ws$2://')}/websocket?gameID=${gameID}&clientToken=${clientToken}`);
	webSocket.addEventListener('open', _ => {
		enterGameTimeout = setTimeout(() => {
			webSocket.close(1000, 'Timeout waiting for a sync message');
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
				if (!payload.data) {
					webSocket.close();
					alert('The game was not found.');
				} else {
					currentGame = {
						id: gameID,
						game: {
							state: payload.data.state,
							players: payload.data.players,
							maxPlayers: payload.data.maxPlayers,
							turnNumber: payload.data.turnNumber,
							turnTimeLimit: payload.data.turnTimeLimit,
							turnTimeLeft: payload.data.turnTimeLeft,
							goalWinCount: payload.data.goalWinCount,
							allowUpcomingCards: payload.data.allowUpcomingCards
						},
						me: payload.playerData,
						isHost: payload.isHost,
						webSocket: webSocket,
						reconnecting: false
					};
					updateColours();

					lobbyResetSlots();
					for (let i = 0; i < currentGame.game.players.length; i++)
						lobbyAddPlayer();
					onGameSettingsChange();

					for (let i = 0; i < playerBars.length; i++) {
						playerBars[i].visible = i < currentGame.game.maxPlayers;
					}

					for (const button of stageButtons.buttons) {
						if (!(button instanceof StageButton)) continue;
						(button as StageButton).setStartSpaces(currentGame.game.maxPlayers);
					}

					onGameStateChange(payload.data, payload.playerData);

					for (let i = 0; i < currentGame.game.players.length; i++) {
						if (currentGame.game.players[i].isReady) showReady(i);
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
					if (currentGame.game.turnTimeLeft) {
						timeLabel.setTime(currentGame.game.turnTimeLeft);
						timeLabel.show();
					} else
						timeLabel.hide();
				}
			} else {
				if (currentGame == null) {
					if (payload.event != 'playerOnline') communicationError();
					return;
				}
				switch (payload.event) {
					case 'settingsChange':
						currentGame.game.turnTimeLimit = payload.data.turnTimeLimit;
						currentGame.game.allowUpcomingCards = payload.data.allowUpcomingCards;
						onGameSettingsChange();
						break;
					case 'join':
						if (payload.data.playerIndex == currentGame.game.players.length) {
							currentGame.game.players.push(payload.data.player);
							lobbyAddPlayer();
						} else
							communicationError();
						break;
					case 'leave':
						if (payload.data.playerIndex < currentGame.game.players.length) {
							currentGame.game.players.splice(payload.data.playerIndex, 1);
							lobbyRemovePlayer(payload.data.playerIndex);
						}
						else
							communicationError();
						break;
					case 'playerReady':
						currentGame.game.players[payload.data.playerIndex].isReady = true;
						lobbySetReady(payload.data.playerIndex);

						if (payload.data.playerIndex == currentGame.me?.playerIndex) {
							lobbyDeckSection.hidden = true;
						}

						showReady(payload.data.playerIndex);
						break;
					case 'playerOnline':
						currentGame.game.players[payload.data.playerIndex].isOnline = payload.data.isOnline;
						lobbySetOnline(payload.data.playerIndex, payload.data.isOnline);
						playerBars[payload.data.playerIndex].setOnline(payload.data.isOnline);
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
						currentGame.game.turnNumber = payload.data.game.turnNumber;

						for (let i = 0; i < currentGame.game.players.length; i++) {
							const player = currentGame.game.players[i];
							player.specialPoints = payload.data.game.players[i].specialPoints;
							player.totalSpecialPoints = payload.data.game.players[i].totalSpecialPoints;
							player.passes = payload.data.game.players[i].passes;
							player.gamesWon = payload.data.game.players[i].gamesWon;
							player.isReady = payload.data.game.players[i].isReady;
							lobbyWinCounters[i].wins = player.gamesWon;
						}
						timeLabel.paused = true;
						if (payload.data.game.turnTimeLeft)
							timeLabel.setTime(payload.data.game.turnTimeLeft);

						(async () => {
							await playInkAnimations(payload.data);
							if (payload.playerData) updateHandAndDeck(payload.playerData);
							turnNumberLabel.turnNumber = payload.data.game.turnNumber;
							clearPlayContainers();
							if (payload.event == 'gameEnd') {
								currentGame.game.state = payload.data.game.state;
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
								for (let i = 0; i < currentGame.game.players.length; i++)
									showWaiting(i);
							}
						})();
						break;
				}
			}
		}
	});
	webSocket.addEventListener('close', webSocket_close);
}

function webSocket_close(e: CloseEvent) {
	if (currentGame == null || currentGame.reconnecting || (e.code != 1005 && e.code != 1006))
		communicationError();
	else
		// Try to automatically reconnect.
		setupWebSocket(currentGame.id);
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
	swapColours();
	stopEditingDeck();
	errorDialog.close();
	clearGame();
	if (location.pathname.endsWith('/deckeditor') || location.hash == '#deckeditor')
		onInitialise(showDeckList);
	else if (location.pathname.endsWith('/cardlist') || location.hash == '#cardlist')
		onInitialise(showCardList);
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
					onInitialise(() => new ReplayLoader(m[2]).loadReplay());
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
	alert('You seem to be using an unsupported browser. Some layout or features of this app may not work correctly.');
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
