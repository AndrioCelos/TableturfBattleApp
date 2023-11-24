/// <reference path="../CheckButtonGroup.ts"/>

const gamePage = document.getElementById('gamePage')!;
const board = new Board(document.getElementById('gameBoard') as HTMLTableElement);
const turnNumberLabel = new TurnNumberLabel(document.getElementById('turnNumberContainer')!, document.getElementById('turnNumberLabel')!);
const timeLabel = new TimeLabel(document.getElementById('timeLabel')!);

const passButton = CheckButton.fromId('passButton');
const specialButton = CheckButton.fromId('specialButton');
const gameButtonsContainer = document.getElementById('gameButtonsContainer')!;
const rotateLeftButton = document.getElementById('rotateLeftButton') as HTMLButtonElement;
const rotateRightButton = document.getElementById('rotateRightButton') as HTMLButtonElement;
const gameDeckButton = document.getElementById('gameDeckButton') as HTMLButtonElement;

const handContainer = document.getElementById('handContainer')!;
const handButtons = new CheckButtonGroup<Card>(handContainer);
const redrawModal = document.getElementById('redrawModal')!;

const gameControls = document.getElementById('gameControls')!;
const playRow = document.getElementById('playRow')!;
const spectatorRow = document.getElementById('spectatorRow')!;
const leaveButton = document.getElementById('leaveButton') as HTMLLinkElement;
const replayPreviousGameButton = CheckButton.fromId('replayPreviousGameButton');
const replayNextGameButton = CheckButton.fromId('replayNextGameButton');
const replayPreviousButton = CheckButton.fromId('replayPreviousButton');
const replayNextButton = CheckButton.fromId('replayNextButton');
const nextGameButton = CheckButton.fromId('nextGameButton');
const flipButton = document.getElementById('flipButton') as HTMLButtonElement;
let replayAnimationAbortController: AbortController | null = null;

const cardHint = HintLabel.fromId('cardHint');
const playHint = HintLabel.fromId('playHint');

const shareReplayLinkButton = document.getElementById('shareReplayLinkButton') as HTMLButtonElement;
let canShareReplay = false;

const playerBars = Array.from(document.getElementsByClassName('playerBar'), el => new PlayerBar(el as HTMLDivElement));
playerBars.sort((a, b) => a.playerIndex - b.playerIndex);

const showDeckContainer = document.getElementById('showDeckContainer')!;
const showDeckListElement = document.getElementById('showDeckList')!;
const showDeckButtons: CardButton[] = [ ];
const showDeckCloseButton = document.getElementById('showDeckCloseButton') as HTMLButtonElement;

const playContainers = Array.from(document.getElementsByClassName('playContainer')) as HTMLDivElement[];
playContainers.sort((a, b) => parseInt(a.dataset.index || '0') - parseInt(b.dataset.index || '0'));

const testControls = document.getElementById('testControls')!;
const testDeckList = document.getElementById('testDeckList')!;
const testAllCardsList = CardList.fromId('testAllCardsList', 'testAllCardsListSortBox', 'testAllCardsListFilterBox');
const testPlacementList = document.getElementById('testPlacementList')!;
const testDeckButton = CheckButton.fromId('testDeckButton');
const testDeckContainer = document.getElementById('testDeckContainer')!;
const testAllCardsButton = CheckButton.fromId('testAllCardsButton');
const testAllCardsContainer = document.getElementById('testAllCardsContainer')!;
const testUndoButton = CheckButton.fromId('testUndoButton');
const testBackButton = document.getElementById('testBackButton') as HTMLButtonElement;
const testCardButtonGroup = new CheckButtonGroup<Card>();
const testDeckCardButtons: CardButton[] = [ ];
const testPlacements: { card: Card, placementResults: PlacementResults }[] = [ ];
const testCardListBackdrop = document.getElementById('testCardListBackdrop')!;

let playHintHtml: string | null = null;

let testMode = false;
let canPlay = false;

let cols: Space[][] = [ ];
for (let x = 0; x < 9; x++) {
	const col = [ ];
	for (let y = 0; y < 26; y++)
		col.push(Space.Empty);
	cols.push(col);
}
board.startSpaces.push({ x: 4, y: 21 });
board.startSpaces.push({ x: 4, y: 4 });
cols[4][21] = Space.SpecialInactive1;
cols[4][4] = Space.SpecialInactive2;
board.resize(cols);

function clear() {
	testMode = false;
	gamePage.classList.remove('replay');
	gamePage.classList.remove('deckTest');
	gamePage.classList.remove('gameEnded');
	gameControls.hidden = true;
	handContainer.hidden = true;
	playRow.hidden = true;
	spectatorRow.hidden = true;
	leaveButton.hidden = false;
	replayPreviousGameButton.buttonElement.hidden = true;
	replayNextGameButton.buttonElement.hidden = true;
	replayPreviousButton.buttonElement.hidden = true;
	replayNextButton.buttonElement.hidden = true;
	nextGameButton.buttonElement.hidden = true;
	shareReplayLinkButton.hidden = true;
	flipButton.hidden = false;
	gameButtonsContainer.hidden = true;
	testControls.hidden = true;
	for (const playerBar of playerBars) {
		playerBar.resultElement.classList.remove('win');
		playerBar.resultElement.classList.remove('lose');
		playerBar.resultElement.classList.remove('draw');
		playerBar.resultElement.innerText = '';
	}
}

/** Shows the game page for playing in a game. */
function initGame() {
	clear();
	gameControls.hidden = false;
	handContainer.hidden = false;
	playRow.hidden = false;
	gameButtonsContainer.hidden = false;
	showPage('game');
}

/** Shows the game page for spectating a game. */
function initSpectator() {
	clear();
	gameControls.hidden = false;
	spectatorRow.hidden = false;
	flipButton.hidden = false;
	gameButtonsContainer.hidden = false;
	board.autoHighlight = false;
	showPage('game');
}

/** Shows the game page for viewing a replay. */
function initReplay() {
	clear();
	gamePage.classList.add('replay');
	gameControls.hidden = false;
	handContainer.hidden = false;
	spectatorRow.hidden = false;
	replayPreviousGameButton.buttonElement.hidden = false;
	replayNextGameButton.buttonElement.hidden = false;
	replayPreviousButton.buttonElement.hidden = false;
	replayNextButton.buttonElement.hidden = false;
	flipButton.hidden = false;
	gameButtonsContainer.hidden = false;
	gamePage.dataset.myPlayerIndex = '0';
	updateColours();
	gamePage.dataset.uiBaseColourIsSpecialColour = (userConfig.colourLock || (currentGame!.game.players[0].uiBaseColourIsSpecialColour ?? true)).toString();
	canPlay = false;
	showPage('game');
	clearPlayContainers();
	timeLabel.hide();
	turnNumberLabel.turnNumber = null;
	replaySwitchGame(0);
}

/** Shows the game page for deck editor testing. */
function initTest(stage: Stage) {
	clear();
	testMode = true;
	gamePage.classList.add('deckTest');
	currentGame = { id: 'test', game: { state: GameState.Ongoing, maxPlayers: 2, players: [ ], turnNumber: 1, turnTimeLimit: null, turnTimeLeft: null, goalWinCount: null, allowUpcomingCards: true }, me: { playerIndex: 0, move: null, deck: null, hand: null, cardsUsed: [ ], stageSelectionPrompt: null }, webSocket: null };
	board.resize(stage.copyGrid());
	const startSpaces = stage.getStartSpaces(2);
	board.startSpaces = startSpaces;
	for (let i = 0; i < 2; i++)
		board.grid[startSpaces[i].x][startSpaces[i].y] = Space.SpecialInactive1 | i;
	board.refresh();

	for (var o of playerBars)
		o.element.hidden = true;
	for (var el of playContainers)
		el.hidden = true;
	testPlacements.splice(0);
	testUndoButton.enabled = false;
	clearChildren(testPlacementList);
	gamePage.dataset.myPlayerIndex = '0';
	gamePage.dataset.uiBaseColourIsSpecialColour = uiBaseColourIsSpecialColourOutOfGame.toString();
	gameButtonsContainer.hidden = false;
	testControls.hidden = false;
	clearPlayContainers();
	timeLabel.hide();
	turnNumberLabel.turnNumber = null;
	showPage('game');

	testDeckButton.checked = true;
	testAllCardsButton.checked = false;
	setTestListPage(false);
	testAllCardsList.clearFilter();
	for (const button of testDeckCardButtons.concat(testAllCardsList.cardButtons))
		button.enabled = true;
}

replayNextButton.buttonElement.addEventListener('click', _ => {
	if (currentGame == null || currentReplay == null || currentGame.game.state == GameState.GameEnded || currentGame.game.state == GameState.SetEnded)
		return;

	if (replayAnimationAbortController) {
		replayUpdateHand();
		replayAnimationAbortController.abort();
		replayAnimationAbortController = null;
		turnNumberLabel.turnNumber = currentGame.game.turnNumber;
		board.refresh();
		const scores = board.getScores();
		for (let i = 0; i < currentGame.game.players.length; i++) {
			updateStats(i, scores);
		}
	}

	clearPlayContainers();
	if (currentGame.game.turnNumber == 0) {
		// Show redraw decisions.
		replayPreviousButton.enabled = true;
		currentGame.game.state = GameState.Ongoing;
		currentGame.game.turnNumber++;
		turnNumberLabel.turnNumber = currentGame.game.turnNumber;
		replayUpdateHand();
	} else if (currentGame.game.turnNumber > 12) {
		currentGame.game.state = currentReplay.gameNumber + 1 >= currentReplay.games.length ? GameState.SetEnded : GameState.GameEnded;
		gameButtonsContainer.hidden = true;
		gamePage.classList.add('gameEnded');
		showResult();
	} else {
		const moves = currentReplay.turns[currentGame.game.turnNumber - 1];
		const result = board.makePlacements(moves);
		currentReplay.placements.push(result);

		const entry = handButtons.entries.find(b => b.value.number == moves[currentReplay!.watchingPlayer].card.number);
		if (entry) entry.button.checked = true;

		for (const p of result.specialSpacesActivated) {
			const space = board.grid[p.x][p.y];
			const player2 = currentGame.game.players[space & 3];
			player2.specialPoints++;
			player2.totalSpecialPoints++;
		}
		currentGame.game.turnNumber++;

		for (let i = 0; i < currentGame.game.players.length; i++)
			showReady(i);

		replayAnimationAbortController = new AbortController();
		(async () => {
			await playInkAnimations({ game: { state: GameState.Ongoing, board: null, turnNumber: currentGame.game.turnNumber, players: currentGame.game.players }, moves, placements: result.placements, specialSpacesActivated: result.specialSpacesActivated }, replayAnimationAbortController.signal);
			turnNumberLabel.turnNumber = currentGame.game.turnNumber;
			clearPlayContainers();
			if (currentGame.game.turnNumber > 12) {
				currentGame.game.state = currentReplay.gameNumber + 1 >= currentReplay.games.length ? GameState.SetEnded : GameState.GameEnded;
				gameButtonsContainer.hidden = true;
				gamePage.classList.add('gameEnded');
				showResult();
			} else
				replayUpdateHand();
		})();
	}
});

replayPreviousButton.buttonElement.addEventListener('click', _ => {
	if (currentGame == null || currentReplay == null || currentGame.game.turnNumber == 0) return;

	replayAnimationAbortController?.abort();
	replayAnimationAbortController = null;

	if (currentGame.game.state == GameState.GameEnded || currentGame.game.state == GameState.SetEnded) {
		for (let i = 0; i < currentGame.game.players.length; i++) {
			if (currentReplay.games[currentReplay.gameNumber].playerData[i].won)
				currentGame.game.players[i].gamesWon--;
			playerBars[i].winCounter.wins = currentGame.game.players[i].gamesWon;
		}
	}

	if (currentGame.game.turnNumber > 1) {
		const result = currentReplay.placements.pop();
		if (!result) return;

		clearPlayContainers();
		for (let i = 0; i < currentGame.game.players.length; i++) {
			const el = playerBars[i].resultElement;
			el.innerText = '';
		}

		undoTurn(result);
	}
	currentGame.game.turnNumber--;
	replayNextButton.enabled = true;
	gamePage.classList.remove('gameEnded');
	handContainer.hidden = false;
	gameButtonsContainer.hidden = false;

	if (currentGame.game.turnNumber > 0) {
		currentGame.game.state = GameState.Ongoing;
		turnNumberLabel.turnNumber = currentGame.game.turnNumber;
		const scores = board.getScores();
		for (let i = 0; i < currentGame.game.players.length; i++) {
			const move = currentReplay.turns[currentGame.game.turnNumber - 1][i];
			if (move.isPass) {
				currentGame.game.players[i].passes--;
				currentGame.game.players[i].specialPoints--;
			} else if ((move as PlayMove).isSpecialAttack)
				currentGame.game.players[i].specialPoints += (move as PlayMove).card.specialCost;
			updateStats(i, scores);
		}
	} else {
		currentGame.game.state = GameState.Redraw;
		replayPreviousButton.enabled = false;
		turnNumberLabel.turnNumber = null;
	}

	replayUpdateHand();
});

/** Undoes the last turn of the current replay, returning the view to the game state before that turn. */
function undoTurn(turn: PlacementResults) {
	for (const p of turn.specialSpacesActivated) {
		const space = board.grid[p.x][p.y];
		const player2 = currentGame!.game.players[space & 3];
		if (player2) {
			player2.specialPoints--;
			player2.totalSpecialPoints--;
		}
		board.grid[p.x][p.y] &= ~4;
	}

	for (let i = turn.placements.length - 1; i >= 0; i--) {
		const placement = turn.placements[i];
		for (const p of placement.spacesAffected) {
			if (p.oldState == undefined) throw new TypeError('oldState missing');
			board.grid[p.space.x][p.space.y] = p.oldState;
		}
	}

	board.refresh();
}

function replaySwitchGame(gameNumber: number) {
	if (!currentGame || !currentReplay)
		throw new Error('Not in a replay.');
	if (gameNumber < 0 || gameNumber >= currentReplay.games.length)
		throw new RangeError(`No game number ${gameNumber} in replay.`);

	replayAnimationAbortController?.abort();
	replayAnimationAbortController = null;

	for (let i = 0; i < currentGame.game.players.length; i++) {
		currentGame.game.players[i].specialPoints = 0;
		currentGame.game.players[i].totalSpecialPoints = 0;
		currentGame.game.players[i].passes = 0;
		currentGame.game.players[i].gamesWon = 0;
		for (let j = 0; j < gameNumber; j++) {
			if (currentReplay.games[j].playerData[i].won)
				currentGame.game.players[i].gamesWon++;
		}
		playerBars[i].winCounter.wins = currentGame.game.players[i].gamesWon;
	}

	currentReplay.gameNumber = gameNumber;
	currentReplay.turns = currentReplay.games[gameNumber].turns;
	currentReplay.placements.splice(0);
	currentGame.game.state = GameState.Ongoing;
	currentGame.game.turnNumber = 0;
	clearPlayContainers();
	gamePage.classList.remove('gameEnded');
	replayPreviousGameButton.enabled = gameNumber > 0;
	replayNextGameButton.enabled = gameNumber + 1 < currentReplay.games.length;
	replayPreviousButton.enabled = false;
	replayNextButton.enabled = true;
	handContainer.hidden = false;
	gameButtonsContainer.hidden = false;
	turnNumberLabel.turnNumber = null;

	const stage = currentReplay.games[gameNumber].stage;
	board.resize(stage.copyGrid());
	const startSpaces = stage.getStartSpaces(currentGame.game.players.length);
	for (let i = 0; i < currentGame.game.players.length; i++) {
		board.grid[startSpaces[i].x][startSpaces[i].y] = Space.SpecialInactive1 | i;
		playerBars[i].points = 1;
		playerBars[i].pointsDelta = null;
		playerBars[i].pointsTo = null;
		playerBars[i].specialPoints = 0;
	}
	board.refresh();

	replayUpdateHand();
}

flipButton.addEventListener('click', () => {
	if (currentGame == null) return;
	if (replayAnimationAbortController) {
		replayAnimationAbortController.abort();
		replayAnimationAbortController = null;
		clearPlayContainers();
		turnNumberLabel.turnNumber = currentGame.game.turnNumber;
		const scores = board.getScores();
		for (let i = 0; i < currentGame.game.players.length; i++) {
			updateStats(i, scores);
		}
	}
	if (currentReplay) {
		currentReplay.watchingPlayer++;
		if (currentReplay.watchingPlayer >= currentGame.game.players.length)
		currentReplay.watchingPlayer = 0;
		gamePage.dataset.myPlayerIndex = currentReplay.watchingPlayer.toString();
		gamePage.dataset.uiBaseColourIsSpecialColour = (userConfig.colourLock
			? currentReplay.watchingPlayer != 1
			: currentGame.game.players[currentReplay.watchingPlayer].uiBaseColourIsSpecialColour ?? true).toString();
		board.flip = currentReplay.watchingPlayer % 2 != 0;
		clearShowDeck();
		replayUpdateHand();
	} else
		board.flip = !board.flip;
	if (board.flip) gamePage.classList.add('boardFlipped');
	else gamePage.classList.remove('boardFlipped');
	board.resize();
});

function addTestDeckCard(card: Card) {
	card = cardDatabase.get(card.number);
	const button = new CardButton(card);
	testCardButtonGroup.add(button, card);
	testDeckList.appendChild(button.buttonElement);
	testDeckCardButtons.push(button);
	button.buttonElement.addEventListener('click', () => testCardButton_click(button));
}

function addTestCard(card: Card) {
	card = cardDatabase.get(card.number);
	const button = new CardButton(card);
	testCardButtonGroup.add(button, card);
	testAllCardsList.add(button);
	button.buttonElement.addEventListener('click', () => {
		testCardButton_click(button);
		if (!testCardListBackdrop.hidden) {
			testCardListBackdrop.hidden = true;
			gamePage.removeChild(testAllCardsContainer);
			testControls.appendChild(testAllCardsContainer);
			setTestListPage(false);
		}
	});
}

function testCardButton_click(button: CardButton) {
	if (!button.enabled) {
		cardHint.showError('This card has already been played.');
		return;
	}
	board.autoHighlight = true;
	board.cardPlaying = testCardButtonGroup.value!;
	for (const button of testCardButtonGroup.buttons)
		button.checked = (button as CardButton).card?.number == testCardButtonGroup.value?.number;
	if (isNaN(board.highlightX) || isNaN(board.highlightY)) {
		board.highlightX = board.startSpaces[board.playerIndex!].x - (board.flip ? 4 : 3);
		board.highlightY = board.startSpaces[board.playerIndex!].y - (board.flip ? 4 : 3);
	}
	board.cardRotation = board.flip ? 2 : 0;
	board.refreshHighlight();
	board.table.focus();
}

testUndoButton.buttonElement.addEventListener('click', () => {
	const turn = testPlacements.pop();
	if (turn) {
		undoTurn(turn.placementResults);
		testPlacementList.removeChild(testPlacementList.firstChild!);

		for (const button of testDeckCardButtons.concat(testAllCardsList.cardButtons)) {
			if (button.card.number == turn.card.number)
				button.enabled = true;
		}

		testUndoButton.enabled = testPlacements.length > 0;
	}
});

testBackButton.addEventListener('click', _ => {
	showPage(editingDeck ? 'deckEdit' : 'deckList');
});

testDeckButton.buttonElement.addEventListener('click', _ => {
	setTestListPage(false);
});
testAllCardsButton.buttonElement.addEventListener('click', _ => {
	setTestListPage(true);
});
function setTestListPage(showAllCards: boolean) {
	testDeckButton.checked = !showAllCards;
	testAllCardsButton.checked = showAllCards;
	testDeckContainer.hidden = showAllCards
	testAllCardsContainer.hidden = !showAllCards;
}

document.getElementById('testAllCardsMobileButton')!.addEventListener('click', _ => {
	setTestListPage(true);
	testControls.removeChild(testAllCardsContainer);
	gamePage.appendChild(testAllCardsContainer);
	testCardListBackdrop.hidden = false;
});

/** Updates the game view with received player data. */
function loadPlayers(players: Player[]) {
	gamePage.dataset.players = players.length.toString();
	const scores = board.getScores();
	for (let i = 0; i < players.length; i++) {
		const player = players[i];
		currentGame!.game.players[i] = players[i];
		playerBars[i].name = player.name;
		playerBars[i].setOnline(player.isOnline);
		playerBars[i].winCounter.wins = players[i].gamesWon;
		updateStats(i, scores);
	}
	for (let i = 0; i < playerBars.length; i++) {
		playerBars[i].visible = i < players.length;
		playContainers[i].hidden = i >= players.length;
	}
	updateColours();
}

function updateColours() {
	if (currentGame == null || currentGame.game.players.length == 0) return;
	for (let i = 0; i < currentGame.game.players.length; i++) {
		if (currentGame.game.players[i].colour.r > 0 || currentGame.game.players[i].colour.g > 0 || currentGame.game.players[i].colour.b > 0) {
			setColour(i, 0, currentGame.game.players[i].colour);
			setColour(i, 1, currentGame.game.players[i].specialColour);
			setColour(i, 2, currentGame.game.players[i].specialAccentColour);
			for (let j = 0; j < 3; j++) {
				updateHSL(i, j);
				updateRGB(i, j);
			}
		}
	}
	uiBaseColourIsSpecialColourOutOfGame = currentGame.game.players[0].uiBaseColourIsSpecialColour ?? true;
}

function updateStats(playerIndex: number, scores: number[]) {
	if (currentGame == null) return;
	playerBars[playerIndex].points = scores[playerIndex];
	playerBars[playerIndex].pointsDelta = 0;
	playerBars[playerIndex].pointsTo = 0;
	playerBars[playerIndex].specialPoints = currentGame.game.players[playerIndex].specialPoints;
	playerBars[playerIndex].statSpecialPointsElement.innerText = currentGame.game.players[playerIndex].totalSpecialPoints.toString();
	playerBars[playerIndex].statPassesElement.innerText = currentGame.game.players[playerIndex].passes.toString();
}

/** Shows the waiting indication for the specified player. */
function showWaiting(playerIndex: number) {
	if (playContainers[playerIndex].firstElementChild?.className == 'waiting') return;
	clearChildren(playContainers[playerIndex]);
	const el = document.createElement('div');
	el.className = 'waiting';
	playContainers[playerIndex].appendChild(el);
}

/** Shows the ready indication for the specified player. */
function showReady(playerIndex: number) {
	clearChildren(playContainers[playerIndex]);
	const el = document.createElement('div');
	el.className = 'cardBack';
	el.dataset.sleeves = (currentGame?.game.players[playerIndex].sleeves ?? 0).toString();
	playContainers[playerIndex].appendChild(el);
}

function clearPlayContainers() {
	for (const container of playContainers) {
		clearChildren(container);
	}
}

/** Clears the game page controls for a new turn. */
function resetPlayControls() {
	passButton.checked = false;
	specialButton.checked = false;
	board.specialAttack = false;
	board.cardPlaying = null;
	if (canPlay && currentGame?.me?.hand != null) {
		for (let i = 0; i < 4; i++) {
			canPlayCard[i] = board.canPlayCard(currentGame.me.playerIndex, currentGame.me.hand[i], false);
			canPlayCardAsSpecialAttack[i] = currentGame.game.players[currentGame.me.playerIndex].specialPoints >= currentGame.me.hand[i].specialCost
				&& board.canPlayCard(currentGame.me.playerIndex, currentGame.me.hand[i], true);
			handButtons.entries[i].button.enabled = canPlayCard[i];
		}

		passButton.enabled = true;
		specialButton.enabled = canPlayCardAsSpecialAttack.includes(true);
		board.autoHighlight = true;
		focusFirstEnabledHandCard();
	} else {
		lockGamePage();
		if (currentGame?.me?.move) {
			for (const el of handButtons.entries)
				el.button.checked = el.value.number == currentGame.me.move.card.number;
			passButton.checked = currentGame.me.move.isPass;
			specialButton.checked = (currentGame.me.move as PlayMove).isSpecialAttack;
 		}
	}
}

/** Disables controls on the game page after a play is submitted. */
function lockGamePage() {
	canPlay = false;
	board.autoHighlight = false;
	for (const button of handButtons.buttons) button.enabled = false;
	passButton.enabled = false;
	specialButton.enabled = false;
	cardHint.clear();
	playHint.clear();
}

function addCardDisplay(playerIndex: number, card: Card, isPass: boolean, isSpecialAttack: boolean, isPreview: boolean) {
	clearChildren(playContainers[playerIndex]);
	const display = new CardDisplay(card, 1);
	if (isPreview) display.element.classList.add('preview');
	playContainers[playerIndex].append(display.element);
	if (isSpecialAttack) {
		const el = document.createElement('div');
		el.className = 'specialAttackLabel';
		el.innerText = 'Special Attack!';
		playContainers[playerIndex].appendChild(el);
		display.element.classList.add('specialAttack');
	} else if (isPass) {
		const el = document.createElement('div');
		el.className = 'passLabel';
		el.innerText = 'Pass';
		playContainers[playerIndex].appendChild(el);
	}
}

async function playInkAnimations(data: {
	game: { state: GameState, board: Space[][] | null, turnNumber: number, players: Player[] },
	moves: Move[],
	placements: Placement[],
	specialSpacesActivated: Point[]
}, abortSignal?: AbortSignal) {
	try {
		if (!currentGame) return;

		const inkPlaced = new Set<number>();
		const placements = data.placements;
		board.clearHighlight();
		board.cardPlaying = null;
		board.autoHighlight = false;
		board.specialAttack = false;
		canPlay = false;
		timeLabel.faded = true;

		// Show the cards that were played.
		let anySpecialAttacks = false;
		for (let i = 0; i < currentGame.game.players.length; i++) {
			const player = currentGame.game.players[i];
			const move = data.moves[i];
			if ((move as PlayMove).isSpecialAttack) {
				anySpecialAttacks = true;
				if (currentReplay) player.specialPoints -= (move as PlayMove).card.specialCost;
			} else if (move.isPass) {
				if (currentReplay) {
					player.passes++;
					player.specialPoints++;
				}
			}

			const back = playContainers[i].firstElementChild as HTMLElement;
			if (back) {
				back.style.setProperty('animation', '0.1s ease-in forwards flipCardOut');
				back.addEventListener('animationend', () => addCardDisplay(i, move.card, move.isPass, (move as PlayMove).isSpecialAttack, false));
			} else
				addCardDisplay(i, move.card, move.isPass, (move as PlayMove).isSpecialAttack, false);
		}

		await delay(anySpecialAttacks ? 3000 : 1000, abortSignal);
		for (let i = 0; i < data.game.players.length; i++) {
			if ((data.moves[i] as PlayMove).isSpecialAttack)
				playerBars[i].specialPoints -= data.moves[i].card.specialCost;
			playerBars[i].highlightSpecialPoints = 0;
		}
		board.enableInkAnimations();
		for (const placement of placements) {
			// Skip the delay when cards don't overlap.
			if (placement.spacesAffected.find(p => inkPlaced.has(p.space.y * 37 + p.space.x))) {
				inkPlaced.clear();
				await delay(500, abortSignal);
				board.clearInkAnimations();
				await delay(500, abortSignal);
				board.enableInkAnimations();
			}

			for (const p of placement.spacesAffected) {
				inkPlaced.add(p.space.y * 37 + p.space.x);
				board.setDisplayedSpace(p.space.x, p.space.y, p.newState);
				board.showInkAnimation(p.space.x, p.space.y);
			}
		}
		await delay(500, abortSignal);
		board.clearInkAnimations();
		await delay(500, abortSignal);

		// Show special spaces.
		if (data.game.board)
			board.grid = data.game.board;
		board.refresh();
		if (data.specialSpacesActivated.length > 0)
			await delay(1000, abortSignal);  // Delay if we expect that this changed the board.
		const scores = board.getScores();
		for (let i = 0; i < data.game.players.length; i++) {
			playerBars[i].specialPoints = data.game.players[i].specialPoints;
			playerBars[i].pointsDelta = scores[i] - playerBars[i].points;
		}
		await delay(1000, abortSignal);
		for (let i = 0; i < data.game.players.length; i++) {
			updateStats(i, scores);
		}
		await delay(1000, abortSignal);
	} catch (ex) {
		if (!(ex instanceof DOMException) || ex.name != 'AbortError') console.error(ex);
	}
}

function showResult() {
	if (currentGame == null) return;
	turnNumberLabel.turnNumber = null;

	let winners = [ 0 ]; let maxPoints = playerBars[0].points;
	for (let i = 1; i < currentGame.game.players.length; i++) {
		if (playerBars[i].points > maxPoints) {
			winners.splice(0);
			winners.push(i);
			maxPoints = playerBars[i].points;
		} else if (playerBars[i].points == maxPoints)
			winners.push(i);
	}

	for (let i = 0; i < currentGame.game.players.length; i++) {
		const el = playerBars[i].resultElement;
		if (winners.includes(i)) {
			if (winners.length == 1) {
				el.classList.add('win');
				el.classList.remove('lose');
				el.classList.remove('draw');
				el.innerText = 'Victory';
				if (currentReplay) {
					currentGame.game.players[i].gamesWon++;
					playerBars[i].winCounter.wins++;
				}
			} else {
				el.classList.remove('win');
				el.classList.remove('lose');
				el.classList.add('draw');
				el.innerText = 'Draw';
			}
		} else {
			el.classList.remove('win');
			el.classList.add('lose');
			el.classList.remove('draw');
			el.innerText = 'Defeat';
		}
	}

	handContainer.hidden = true;
	replayNextButton.enabled = false;
	if (!currentReplay) {
		playRow.hidden = true;
		spectatorRow.hidden = false;
		replayPreviousGameButton.buttonElement.hidden = true;
		replayPreviousButton.buttonElement.hidden = true;
		replayNextButton.buttonElement.hidden = true;
		replayNextGameButton.buttonElement.hidden = true;
		flipButton.hidden = true;
		if (currentGame.game.state == GameState.SetEnded) {
			leaveButton.hidden = false;
			nextGameButton.buttonElement.hidden = currentGame.game.goalWinCount != null;
			shareReplayLinkButton.hidden = false;
			canShareReplay = navigator.canShare && navigator.canShare({ url: window.location.href, title: 'Tableturf Battle Replay' });
			shareReplayLinkButton.innerText = canShareReplay ? 'Share replay link' : 'Copy replay link';
		} else {
			leaveButton.hidden = currentGame.me != null;
			nextGameButton.buttonElement.hidden = currentGame.me == null;
		}
		nextGameButton.enabled = currentGame.me != null && !currentGame.game.players[currentGame.me.playerIndex].isReady;
		nextGameButton.buttonElement.innerHTML = nextGameButton.enabled ? 'Next game' : '<div class="loadingSpinner"></div> Waiting for other player';
	}
}

function clearShowDeck() {
	showDeckContainer.hidden = true;
	testCardListBackdrop.hidden = true;
	clearChildren(showDeckListElement);
	showDeckButtons.splice(0);
}

function populateShowDeck(deck: Deck) {
	if (showDeckButtons.length == 0) {
		for (const card of deck.cards) {
			const button = new CardButton(card);
			button.buttonElement.disabled = true;
			showDeckButtons.push(button);

			const li = document.createElement('li');
			li.appendChild(button.buttonElement);
			showDeckListElement.appendChild(li);
		}
	}
}

/** Handles an update to the player's hand and/or deck during a game. */
function updateHandAndDeck(playerData: PlayerData) {
	const hand = playerData.hand!;
	populateShowDeck(playerData.deck!);

	for (const button of showDeckButtons) {
		const li = button.buttonElement.parentElement!;
		if (hand.find(c => c.number == button.card.number))
			li.className = 'inHand';
		else if (playerData.cardsUsed.includes(button.card.number))
			li.className = 'used';
		else
			li.className = 'unused';
	}

	if (!currentGame?.me) return;

	if (handButtons.entries.length == 4 && hand.length == 4) {
		let handIsSame = true;
		for (let i = 0; i < 4; i++) {
			if ((<CardButton> handButtons.entries[i].button).card.number != hand[i].number) {
				handIsSame = false;
				break;
			}
		}
		if (handIsSame) return;  // The player's hand has not changed after reconnecting to the game.
	}
	currentGame.me.hand = hand.map(Card.fromJson);
	handButtons.clear();
	board.autoHighlight = false;
	for (let i = 0; i < currentGame.me.hand.length; i++) {
		const card = currentGame.me.hand[i];
		const button = new CardButton(card);
		handButtons.add(button, card);
		button.buttonElement.addEventListener('click', e => {
			if (!button.enabled) {
				if (specialButton.checked && currentGame!.game.players[currentGame!.me!.playerIndex].specialPoints < card.specialCost)
					cardHint.showError('Not enough special points.');
				else if (!(specialButton.checked ? canPlayCardAsSpecialAttack : canPlayCard)[i])
					cardHint.showError('No place to play this card.');
				e.preventDefault();
				return;
			}
			cardHint.clear();
			if (passButton.checked) {
				if (canPlay) {
					timeLabel.faded = true;
					lockGamePage();
					sendPlay({ clientToken, cardNumber: card.number.toString(), isPass: 'true' });
				}
			} else {
				board.cardPlaying = card;
				addCardDisplay(currentGame!.me!.playerIndex, card, false, false, true);
				if (specialButton.checked)
					playerBars[currentGame!.me!.playerIndex].highlightSpecialPoints = card.specialCost;
				if (isNaN(board.highlightX) || isNaN(board.highlightY)) {
					board.highlightX = board.startSpaces[board.playerIndex!].x - (board.flip ? 4 : 3);
					board.highlightY = board.startSpaces[board.playerIndex!].y - (board.flip ? 4 : 3);
				}
				if (specialButton.checked)
					playHint.show('Unleash it next to <div class="playHintSpecial">&nbsp;</div>!', true);
				board.cardRotation = board.flip ? 2 : 0;
				board.refreshHighlight();
				board.table.focus();
			}
		});
		button.buttonElement.addEventListener('keydown', e => {
			switch (e.key) {
				case 'ArrowUp':
					if (i >= 2)
						handButtons.entries[i - 2].button.buttonElement.focus();
					e.preventDefault();
					break;
				case 'ArrowDown':
					if (i < 2)
						handButtons.entries[i + 2].button.buttonElement.focus();
					e.preventDefault();
					break;
				case 'ArrowLeft':
					if (i % 2 != 0)
						handButtons.entries[i - 1].button.buttonElement.focus();
					e.preventDefault();
					break;
				case 'ArrowRight':
					if (i % 2 == 0)
						handButtons.entries[i + 1].button.buttonElement.focus();
					e.preventDefault();
					break;
			}
		});
	}
}

/** Handles an update to the player's hand and/or deck during a replay. */
function replayUpdateHand() {
	if (currentGame == null || currentReplay == null) return;

	handButtons.clear();

	const playerData = currentReplay.games[currentReplay.gameNumber].playerData[currentReplay.watchingPlayer];
	populateShowDeck(playerData.deck);
	for (const b of showDeckButtons)
		b.buttonElement.parentElement!.className = '';

	let indices;
	if (currentGame.game.turnNumber == 0) {
		indices = playerData.initialDrawOrder;
	} else {
		indices = playerData.drawOrder.slice(0, 4);
		for (let i = 0; i < currentGame.game.turnNumber - 1; i++) {
			const move = currentReplay.turns[i][currentReplay.watchingPlayer];
			let j = indices.findIndex(k => playerData.deck.cards[k].number == move.card.number);
			if (j < 0) j = indices.findIndex(k => k < 0 || k >= 15);
			if (j >= 0) {
				showDeckButtons[indices[j]].buttonElement.parentElement!.className = 'used';
				if (i < 11)
					indices[j] = playerData.drawOrder[4 + i];
			}
		}
	}

	for (let i = 0; i < showDeckButtons.length; i++) {
		const li = showDeckButtons[i].buttonElement.parentElement!;
		if (!li.className)
			li.className = indices.includes(i) ? 'inHand' : 'unused';
	}

	for (let i = 0; i < 4; i++) {
		if (indices[i] >= 15) continue;  // Accounts for an old bug in the server that corrupted the initialDrawOrder replay fields.
		const card = playerData.deck.cards[indices[i]];
		const button = new CardButton(card);
		button.buttonElement.disabled = true;
		handButtons.add(button, card);
		handContainer.appendChild(button.buttonElement);
	}
}

(document.getElementById('redrawNoButton') as HTMLButtonElement).addEventListener('click', redrawButton_click);
(document.getElementById('redrawYesButton') as HTMLButtonElement).addEventListener('click', redrawButton_click);
function redrawButton_click(e: MouseEvent) {
	let req = new XMLHttpRequest();
	req.open('POST', `${config.apiBaseUrl}/games/${currentGame!.id}/redraw`);
	req.addEventListener('error', () => communicationError());
	let data = new URLSearchParams();
	data.append('clientToken', clientToken);
	data.append('redraw', (e.target as HTMLButtonElement).dataset.redraw!);
	req.send(data.toString());
	redrawModal.hidden = true;
}

function passButton_click(e: Event) {
	if (!passButton.enabled) {
		e.preventDefault();
		return;
	}
	passButton.checked = !passButton.checked;
	board.autoHighlight = !passButton.checked;
	if (passButton.checked) {
		cardHint.show('Pick a card to discard.', false);
		playHint.clear();
		specialButton.checked = false;
		board.cardPlaying = null;
		showWaiting(currentGame!.me!.playerIndex);
		playerBars[currentGame!.me!.playerIndex].highlightSpecialPoints = 0;
		board.specialAttack = false;
		board.clearHighlight();
		handButtons.deselect();
		for (const button of handButtons.buttons)
			button.enabled = true;
	} else {
		cardHint.clear();
		for (let i = 0; i < 4; i++) {
			handButtons.entries[i].button.enabled = canPlayCard[i];
		}
	}
}
passButton.buttonElement.addEventListener('click', passButton_click);

function specialButton_click(e: Event) {
	if (!specialButton.enabled) {
		if (currentGame!.me!.hand!.every(c => currentGame!.game.players[currentGame!.me!.playerIndex].specialPoints < c.specialCost))
			cardHint.showError('Not enough special points.');
		else if (!canPlayCardAsSpecialAttack.includes(true))
			cardHint.showError('No place to play a special attack.');
		e.preventDefault();
		return;
	}
	specialButton.checked = !specialButton.checked;
	board.specialAttack = specialButton.checked;
	handButtons.deselect();
	playerBars[currentGame!.me!.playerIndex].highlightSpecialPoints = 0;
	playHint.clear();
	if (specialButton.checked) {
		cardHint.show('Pick a card to do a Special Attack!', true);
		passButton.checked = false;
		board.autoHighlight = true;
		board.cardPlaying = null;
		showWaiting(currentGame!.me!.playerIndex);
		board.clearHighlight();
		for (let i = 0; i < 4; i++)
			handButtons.entries[i].button.enabled = canPlayCardAsSpecialAttack[i];
	} else {
		cardHint.clear();
		for (let i = 0; i < 4; i++) {
			handButtons.entries[i].button.enabled = canPlayCard[i];
		}
	}
}
specialButton.buttonElement.addEventListener('click', specialButton_click);

function sendPlay(data: { clientToken: string, [k: string]: string }) {
	if (!currentGame) throw new Error('No game in progress.');
	let req = new XMLHttpRequest();
	req.open('POST', `${config.apiBaseUrl}/games/${currentGame.id}/play`);
	req.addEventListener('load', _ => {
		if (req.status != 204) {
			alert(`The server rejected the play. This is probably a bug.\n${req.responseText}`);
			canPlay = true;
			board.autoHighlight = true;
			for (let i = 0; i < handButtons.entries.length; i++)
				handButtons.entries[i].button.enabled = passButton.checked || (specialButton.checked ? canPlayCardAsSpecialAttack : canPlayCard)[i];
			passButton.enabled = true;
			specialButton.enabled = canPlayCardAsSpecialAttack.includes(true);
			board.clearHighlight();
		}
	});
	req.addEventListener('error', () => communicationError());
	req.send(new URLSearchParams(data).toString());
}

board.onsubmit = (x, y) => {
	if (board.cardPlaying == null || !currentGame?.me)
		return;
	const message = board.checkMoveLegality(currentGame.me.playerIndex, board.cardPlaying, x, y, board.cardRotation, board.specialAttack);
	if (message != null) {
		playHint.showError(message);
		return;
	}
	if (testMode) {
		const move: PlayMove = { card: board.cardPlaying, isPass: false, isTimeout: false, x, y, rotation: board.cardRotation, isSpecialAttack: false };
		const result = board.makePlacements([ move ]);
		testPlacements.push({ card: board.cardPlaying, placementResults: result });
		board.enableInkAnimations();
		for (const p of result.placements[0].spacesAffected) {
			board.setDisplayedSpace(p.space.x, p.space.y, p.newState);
			board.showInkAnimation(p.space.x, p.space.y);
		}

		if (result.specialSpacesActivated.length > 0)
			setTimeout(() => board.refresh(), 333);

		var li = document.createElement('div');
		li.innerText = board.cardPlaying.name;
		if (testDeckCardButtons.find(b => b.card.number == board.cardPlaying!.number))
			li.classList.add('deckCard');
		else
			li.classList.add('externalCard');
		testPlacementList.insertBefore(li, testPlacementList.firstChild);

		for (const button of testDeckCardButtons.concat(testAllCardsList.cardButtons)) {
			if (button.card.number == board.cardPlaying.number) {
				button.checked = false;
				button.enabled = false;
			}
		}

		board.cardPlaying = null;
		testUndoButton.enabled = true;
	} else if (canPlay) {
		board.showSubmitAnimation();
		timeLabel.faded = true;
		lockGamePage();
		let req = new XMLHttpRequest();
		req.open('POST', `${config.apiBaseUrl}/games/${currentGame.id}/play`);
		req.addEventListener('load', _ => {
			if (req.status != 204) {
				alert(req.responseText);
				board.clearHighlight();
				board.autoHighlight = true;
			}
		});
		sendPlay({
			clientToken,
			cardNumber: board.cardPlaying.number.toString(),
			isSpecialAttack: specialButton.checked.toString(),
			x: board.highlightX.toString(),
			y: board.highlightY.toString(),
			r: board.cardRotation.toString()
		});
	}
};

board.oncancel = () => {
	board.cardPlaying = null;
	if (currentGame?.me) {
		showWaiting(currentGame.me.playerIndex);
		playerBars[currentGame.me.playerIndex].highlightSpecialPoints = 0;
	}
	board.clearHighlight();
	for (const button of handButtons.buttons) {
		if (button.checked) {
			button.checked = false;
			button.buttonElement.focus();
			break;
		}
	}
	playHint.clear();
	if (passButton.checked)
		cardHint.show('Pick a card to discard.', false);
	else if (specialButton.checked)
		cardHint.show('Pick a card to do a Special Attack!', true);
};

board.onhighlightchange = dScores => {
	if (currentGame == null) return;
	const scores = board.getScores();
	for (let i = 0; i < playerBars.length; i++) {
		playerBars[i].pointsTo = dScores && dScores[i] != 0 ? scores[i] + dScores[i] : null;
	}
};

timeLabel.ontimeout = () => {
	if (currentGame == null || !canPlay) return;
	if (currentGame.game.turnNumber == 0) {
		let req = new XMLHttpRequest();
		req.open('POST', `${config.apiBaseUrl}/games/${currentGame!.id}/redraw`);
		req.addEventListener('error', () => communicationError());
		req.send(new URLSearchParams({ clientToken, redraw: 'false', isTimeout: 'true' }).toString());
		redrawModal.hidden = true;
	} else {
		// When time runs out, automatically discard the largest card in the player's hand.
		let entry = handButtons.entries[0];
		for (let i = 1; i < handButtons.entries.length; i++) {
			if (handButtons.entries[i].value.size > entry.value.size)
				entry = handButtons.entries[i];
		}
		handButtons.deselect();
		entry.button.checked = true;
		lockGamePage();
		sendPlay({ clientToken, cardNumber: entry.value.number.toString(), isPass: 'true', isTimeout: 'true' });
	}
};

function focusFirstEnabledHandCard() {
	const input = document.activeElement as HTMLInputElement;
	if (input.name == 'handCard') {
		if (input.disabled)
			input.checked = false;
		else {
			// An enabled hand button is already active; don't move the focus.
			return;
		}
	}
	const firstEnabledButton = handButtons.buttons.find(b => b.enabled);
	if (firstEnabledButton)
		firstEnabledButton.buttonElement.focus();
	else
		passButton.buttonElement.focus();
}

function toggleShowDeck() {
	if (showDeckContainer.hidden) {
		showDeckContainer.hidden = false;
		testCardListBackdrop.hidden = false;
		showDeckCloseButton.focus();
	} else {
		showDeckContainer.hidden = true;
		testCardListBackdrop.hidden = true;
		focusFirstEnabledHandCard();
	}
}

rotateLeftButton.addEventListener('click', () => {
	board.rotateAnticlockwise(true);
});
rotateRightButton.addEventListener('click', () => {
	board.rotateClockwise(true);
});
gameDeckButton.addEventListener('click', toggleShowDeck);
showDeckCloseButton.addEventListener('click', toggleShowDeck);

document.addEventListener('keydown', e => {
	if (!pages.get('game')!.hidden) {
		switch (e.key) {
			case 'p':
				if (playRow.hidden) return;
				passButton_click(e);
				if (passButton.enabled)
					focusFirstEnabledHandCard();
				e.preventDefault();
				break;
			case 's':
				if (playRow.hidden) return;
				specialButton_click(e);
				if (specialButton.enabled)
					focusFirstEnabledHandCard();
				e.preventDefault();
				break;
			case 'd':
				if (testMode || gameButtonsContainer.hidden) return;
				toggleShowDeck();
				e.preventDefault();
				break;
		}
	}
});

replayPreviousGameButton.buttonElement.addEventListener('click', () => {
	if (!currentGame || !currentReplay) return;
	if (currentReplay.gameNumber > 0)
		replaySwitchGame(currentReplay.gameNumber - 1);
});

replayNextGameButton.buttonElement.addEventListener('click', () => {
	if (!currentGame || !currentReplay) return;
	if (currentReplay.gameNumber < currentReplay.games.length - 1)
		replaySwitchGame(currentReplay.gameNumber + 1);
});
nextGameButton.buttonElement.addEventListener('click', () => {
	if (!currentGame) return;
	nextGameButton.enabled = false;
	nextGameButton.buttonElement.innerHTML = '<div class="loadingSpinner"></div> Waiting for other player';
	let req = new XMLHttpRequest();
	req.open('POST', `${config.apiBaseUrl}/games/${currentGame.id}/nextGame`);
	req.addEventListener('error', () => communicationError());
	req.send(new URLSearchParams({ clientToken }).toString());
});

shareReplayLinkButton.addEventListener('click', () => {
	shareReplayLinkButton.disabled = true;

	let req = new XMLHttpRequest();
	req.responseType = "arraybuffer";
	req.open('GET', `${config.apiBaseUrl}/games/${currentGame!.id}/replay`);
	req.addEventListener('load', _ => {
		if (req.status == 200) {
			const array = new Uint8Array(req.response as ArrayBuffer);
			const base64 = encodeToUrlSafeBase64(array);
			const url = new URL(`${canPushState ? '' : '#'}replay/${base64}`, baseUrl);
			shareReplayLinkButton.disabled = false;
			if (canShareReplay) {
				navigator.share({ url: url.href, title: 'Tableturf Battle Replay' });
			} else {
				navigator.clipboard.writeText(url.href).then(() => shareReplayLinkButton.innerText = 'Copied');
			}
		}
	});
	req.send();
});

function leaveButton_click(e: MouseEvent) {
	e.preventDefault();
	clearGame();
	clearPreGameForm(true);
	showPage('preGame');
	newGameButton.focus();
}

leaveButton.addEventListener('click', leaveButton_click);

function showColourDebug() {
	document.getElementById('debugColour')!.hidden = false;
}

const colBoxes = [
	[
		[ document.getElementById("colH0I") as HTMLInputElement, document.getElementById("colS0I") as HTMLInputElement, document.getElementById("colL0I") as HTMLInputElement, document.getElementById("colRGB0I") as HTMLInputElement ],
		[ document.getElementById("colH0S") as HTMLInputElement, document.getElementById("colS0S") as HTMLInputElement, document.getElementById("colL0S") as HTMLInputElement, document.getElementById("colRGB0S") as HTMLInputElement ],
		[ document.getElementById("colH0A") as HTMLInputElement, document.getElementById("colS0A") as HTMLInputElement, document.getElementById("colL0A") as HTMLInputElement, document.getElementById("colRGB0A") as HTMLInputElement ]
	],
	[
		[ document.getElementById("colH1I") as HTMLInputElement, document.getElementById("colS1I") as HTMLInputElement, document.getElementById("colL1I") as HTMLInputElement, document.getElementById("colRGB1I") as HTMLInputElement ],
		[ document.getElementById("colH1S") as HTMLInputElement, document.getElementById("colS1S") as HTMLInputElement, document.getElementById("colL1S") as HTMLInputElement, document.getElementById("colRGB1S") as HTMLInputElement ],
		[ document.getElementById("colH1A") as HTMLInputElement, document.getElementById("colS1A") as HTMLInputElement, document.getElementById("colL1A") as HTMLInputElement, document.getElementById("colRGB1A") as HTMLInputElement ]
	],
	[
		[ document.getElementById("colH2I") as HTMLInputElement, document.getElementById("colS2I") as HTMLInputElement, document.getElementById("colL2I") as HTMLInputElement, document.getElementById("colRGB2I") as HTMLInputElement ],
		[ document.getElementById("colH2S") as HTMLInputElement, document.getElementById("colS2S") as HTMLInputElement, document.getElementById("colL2S") as HTMLInputElement, document.getElementById("colRGB2S") as HTMLInputElement ],
		[ document.getElementById("colH2A") as HTMLInputElement, document.getElementById("colS2A") as HTMLInputElement, document.getElementById("colL2A") as HTMLInputElement, document.getElementById("colRGB2A") as HTMLInputElement ]
	],
	[
		[ document.getElementById("colH3I") as HTMLInputElement, document.getElementById("colS3I") as HTMLInputElement, document.getElementById("colL3I") as HTMLInputElement, document.getElementById("colRGB3I") as HTMLInputElement ],
		[ document.getElementById("colH3S") as HTMLInputElement, document.getElementById("colS3S") as HTMLInputElement, document.getElementById("colL3S") as HTMLInputElement, document.getElementById("colRGB3S") as HTMLInputElement ],
		[ document.getElementById("colH3A") as HTMLInputElement, document.getElementById("colS3A") as HTMLInputElement, document.getElementById("colL3A") as HTMLInputElement, document.getElementById("colRGB3A") as HTMLInputElement ]
	]
];
function colHSL_change(e: Event) {
	const box = e.target as HTMLInputElement;
	const playerIndex = parseInt(box.dataset.player!);
	const colourIndex = parseInt(box.dataset.index!);

	const h = (parseInt(colBoxes[playerIndex][colourIndex][0].value) % 360 + 360) % 360;  // degrees
	const s = Math.min(100, Math.max(0, parseInt(colBoxes[playerIndex][colourIndex][1].value)));  // %
	const l = Math.min(100, Math.max(0, parseInt(colBoxes[playerIndex][colourIndex][2].value)));  // %

	const c = (100 - Math.abs(2 * l - 100)) * s;  // × 1/10000
	const x = c * (60 - Math.abs(h % 120 - 60));  // × 1/600000
	const min = (l * 100 - c / 2) * 60;  // × 1/600000
	const rgb1 =
		h <  60 ? { r: c * 60, g: x, b: 0 } :
		h < 120 ? { r: x, g: c * 60, b: 0 } :
		h < 180 ? { r: 0, g: c * 60, b: x } :
		h < 240 ? { r: 0, g: x, b: c * 60 } :
		h < 300 ? { r: x, g: 0, b: c * 60 } :
		{ r: c * 60, g: 0, b: x };  // × 1/600000
	const rgb = { r: Math.round((rgb1.r + min) * 255 / 600000), g: Math.round((rgb1.g + min) * 255 / 600000), b: Math.round((rgb1.b + min) * 255 / 600000) };

	setColour(playerIndex, colourIndex, rgb);
	updateRGB(playerIndex, colourIndex);
}
function colRGB_change(e: Event) {
	const box = e.target as HTMLInputElement;
	const playerIndex = parseInt(box.dataset.player!);
	const colourIndex = parseInt(box.dataset.index!);

	let colourStr = colBoxes[playerIndex][colourIndex][3].value;
	if (colourStr.startsWith('#')) colourStr = colourStr.substring(1);
	if (colourStr.length >= 8) colourStr = colourStr.substring(colourStr.length - 6);
	const rgb = { r: parseInt(colourStr.substring(0, 2), 16), g: parseInt(colourStr.substring(2, 4), 16), b: parseInt(colourStr.substring(4, 6), 16) };
	setColour(playerIndex, colourIndex, rgb);
	updateHSL(playerIndex, colourIndex);
}
for (const a of colBoxes) {
	for (const a2 of a) {
		a2[0].addEventListener('change', colHSL_change);
		a2[1].addEventListener('change', colHSL_change);
		a2[2].addEventListener('change', colHSL_change);
		a2[3].addEventListener('change', colRGB_change);
	}
}
for (let p = 0; p < 4; p++) {
	for (let i = 0; i < 3; i++) {
		updateHSL(p, i);
	}
}
function updateHSL(playerIndex: number, colourIndex: number) {
	let colourStr = colBoxes[playerIndex][colourIndex][3].value;
	if (colourStr.startsWith('#')) colourStr = colourStr.substring(1);
	if (colourStr.length == 8) colourStr = colourStr.substring(2);
	const colour = currentGame != null
		? (colourIndex == 0 ? currentGame!.game.players[playerIndex].colour :
			colourIndex == 1 ? currentGame!.game.players[playerIndex].specialColour :
			currentGame!.game.players[playerIndex].specialAccentColour)
		: defaultColours[playerIndex][colourIndex];
	const max = Math.max(colour.r, colour.g, colour.b);  // × 1/255
	const min = Math.min(colour.r, colour.g, colour.b);  // × 1/255
	const c = max - min;  // × 1/255
	const l = Math.round((max + min) * 50 / 255);  // %
	const h = max == min ? 0
		: max == colour.r ? (colour.b > colour.g ? 360 : 0) + 60 * (colour.g - colour.b) / c
		: max == colour.g ? 120 + 60 * (colour.b - colour.r) / c
		: 240 + 60 * (colour.r - colour.g) / c;
	const s = max <= 0 || min >= 255
		? 0
		: Math.round(c / (255 - Math.abs(2 * max - c - 255)) * 100);
	colBoxes[playerIndex][colourIndex][0].value = Math.round(h).toString();
	colBoxes[playerIndex][colourIndex][1].value = s.toString();
	colBoxes[playerIndex][colourIndex][2].value = l.toString();
}
function updateRGB(playerIndex: number, colourIndex: number) {
	const colour = currentGame != null
		? (colourIndex == 0 ? currentGame!.game.players[playerIndex].colour :
			colourIndex == 1 ? currentGame!.game.players[playerIndex].specialColour :
			currentGame!.game.players[playerIndex].specialAccentColour)
		: defaultColours[playerIndex][colourIndex];
	colBoxes[playerIndex][colourIndex][3].value = `#${colour.r.toString(16).padStart(2, '0')}${colour.g.toString(16).padStart(2, '0')}${colour.b.toString(16).padStart(2, '0')}`;
}
function setColour(playerIndex: number, colourIndex: number, colour: Colour) {
	if (!currentGame || playerIndex >= currentGame.game.players.length) return;
	if (colourIndex == 0) {
		currentGame.game.players[playerIndex].colour = colour;
		if (!userConfig.colourLock)
			document.body.style.setProperty(`--primary-colour-${playerIndex + 1}`, `rgb(${colour.r}, ${colour.g}, ${colour.b})`);
	} else if (colourIndex == 1) {
		currentGame.game.players[playerIndex].specialColour = colour;
		if (!userConfig.colourLock)
			document.body.style.setProperty(`--special-colour-${playerIndex + 1}`, `rgb(${colour.r}, ${colour.g}, ${colour.b})`);
	} else {
		currentGame.game.players[playerIndex].specialAccentColour = colour;
		if (!userConfig.colourLock)
			document.body.style.setProperty(`--special-accent-colour-${playerIndex + 1}`, `rgb(${colour.r}, ${colour.g}, ${colour.b})`);
	}
}
