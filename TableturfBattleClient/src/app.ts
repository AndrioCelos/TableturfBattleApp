/// <reference path="Pages/PreGamePage.ts"/>

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
			lobbySelectedStageSection.hidden = true;
			lobbyStageSection.hidden = !playerData || game.players[playerData.playerIndex]?.isReady;
			break;
		case GameState.Preparing:
			showPage('lobby');
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
				updateHand(playerData);
				initGame();
			} else
				initSpectator();

			gameButtonsContainer.hidden = currentGame.me == null || game.state == GameState.Ended;

			switch (game.state) {
				case GameState.Redraw:
					redrawModal.hidden = currentGame.me == null || currentGame.players[currentGame.me.playerIndex].isReady;
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

let errorDialogCallback: ((e: Event) => void) | null = null;
function communicationError(message?: string, showButton?: boolean, callback?: (e: Event) => void) {
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

function setupWebSocket(gameID: string, myPlayerIndex: number | null) {
	const webSocket = new WebSocket(`${config.apiBaseUrl.replace(/(http)(s)?\:\/\//, 'ws$2://')}/websocket?gameID=${gameID}&clientToken=${clientToken}`);
	webSocket.addEventListener('open', e => {
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
						me: payload.playerData,
						players: payload.data.players,
						maxPlayers: payload.data.maxPlayers,
						turnNumber: payload.data.turnNumber,
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

					onGameStateChange(payload.data, payload.playerData);

					for (let i = 0; i < currentGame.players.length; i++) {
						if (currentGame.players[i].isReady)
							showReady(i);
					}

					if (currentGame.me) {
						if (currentGame.me.move) {
							canPlay = false;
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
						break;
					case 'turn':
					case 'gameEnd':
						clearReady();
						board.autoHighlight = false;
						showPage('game');

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

						(async () => {
							await playInkAnimations(payload.data, anySpecialAttacks);
							if (payload.playerData) updateHand(payload.playerData);
							turnNumberLabel.setTurnNumber(payload.data.game.turnNumber);
							clearPlayContainers();
							if (payload.event == 'gameEnd') {
								gameButtonsContainer.hidden = true;
								passButton.enabled = false;
								specialButton.enabled = false;
								gamePage.classList.add('gameEnded');
								showResult();
							} else {
								canPlay = myPlayerIndex != null;
								board.autoHighlight = canPlay;
								setupControlsForPlay();
							}
						})();
						break;
				}
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
	errorDialog.close();
	currentGame = null;
	currentReplay = null;
	if (location.pathname.endsWith('/deckeditor') || location.hash == '#deckeditor')
		onInitialise(showDeckList);
	else {
		showPage('preGame');
		if (location.pathname.endsWith('/help') || location.hash == '#help')
			helpDialog.showModal();
		else {
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
	}, () => {
		preGameLoadingSection.hidden = true;
		communicationError('Unable to load game data from the server.', false);
	});

if (!canPushState)
	preGameDeckEditorButton.href = '#deckeditor';
showPage('preGame');
processUrl();
