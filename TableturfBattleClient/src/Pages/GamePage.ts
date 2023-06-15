/// <reference path="../TimeLabel.ts"/>

const gamePage = document.getElementById('gamePage')!;
const board = new Board(document.getElementById('gameBoard') as HTMLTableElement);
const turnNumberLabel = new TurnNumberLabel(document.getElementById('turnNumberContainer')!, document.getElementById('turnNumberLabel')!);
const timeLabel = new TimeLabel(document.getElementById('timeLabel')!);
const handButtons: CardButton[] = [ ];

const passButton = CheckButton.fromId('passButton');
const specialButton = CheckButton.fromId('specialButton');
const gameButtonsContainer = document.getElementById('gameButtonsContainer')!;
const rotateLeftButton = document.getElementById('rotateLeftButton') as HTMLButtonElement;
const rotateRightButton = document.getElementById('rotateRightButton') as HTMLButtonElement;
const gameDeckButton = document.getElementById('gameDeckButton') as HTMLButtonElement;

const handContainer = document.getElementById('handContainer')!;
const redrawModal = document.getElementById('redrawModal')!;

const gameControls = document.getElementById('gameControls')!;
const playRow = document.getElementById('playRow')!;
const spectatorRow = document.getElementById('spectatorRow')!;
const replayNextButton = document.getElementById('replayNextButton')!;
const replayPreviousButton = document.getElementById('replayPreviousButton')!;
const flipButton = document.getElementById('flipButton') as HTMLButtonElement;
let replayAnimationAbortController: AbortController | null = null;

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
const testUndoButton = document.getElementById('testUndoButton') as HTMLButtonElement;
const testBackButton = document.getElementById('testBackButton') as HTMLButtonElement;
const testDeckCardButtons: CardButton[] = [ ];
const testPlacements: { card: Card, placementResults: PlacementResults }[] = [ ];
const testCardListBackdrop = document.getElementById('testCardListBackdrop')!;

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
	replayPreviousButton.hidden = true;
	replayNextButton.hidden = true;
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

function initGame() {
	clear();
	gameControls.hidden = false;
	handContainer.hidden = false;
	playRow.hidden = false;
	gameButtonsContainer.hidden = false;
	showPage('game');
}

function initSpectator() {
	clear();
	gameControls.hidden = false;
	spectatorRow.hidden = false;
	flipButton.hidden = false;
	gameButtonsContainer.hidden = false;
	showPage('game');
}

function initReplay() {
	clear();
	gamePage.classList.add('replay');
	gameControls.hidden = false;
	handContainer.hidden = false;
	spectatorRow.hidden = false;
	replayPreviousButton.hidden = false;
	replayNextButton.hidden = false;
	flipButton.hidden = false;
	gameButtonsContainer.hidden = false;
	canPlay = false;
	showPage('game');
	clearPlayContainers();
	turnNumberLabel.setTurnNumber(null);
	replayUpdateHand();
}

function initTest(stage: Stage) {
	clear();
	testMode = true;
	gamePage.classList.add('deckTest');
	currentGame = { id: 'test', state: GameState.Ongoing, maxPlayers: 2, players: [ ], webSocket: null, turnNumber: 1, turnTimeLimit: null, turnTimeLeft: null, me: { playerIndex: 0, move: null, deck: null, hand: null, cardsUsed: [ ] } };
	board.resize(stage.copyGrid());
	const startSpaces = stage.getStartSpaces(2);
	board.startSpaces = startSpaces;
	for (let i = 0; i < 2; i++)
		board.grid[startSpaces[i].x][startSpaces[i].y] = Space.SpecialInactive1 | i;
	board.refresh();

	for (var o of playerBars)
		o.element.hidden = true;
	testPlacements.splice(0);
	clearChildren(testPlacementList);
	gamePage.dataset.myPlayerIndex = '0';
	gamePage.dataset.uiBaseColourIsSpecialColour = 'true';
	gameButtonsContainer.hidden = false;
	testControls.hidden = false;
	clearPlayContainers();
	turnNumberLabel.setTurnNumber(null);
	showPage('game');

	testDeckButton.checked = true;
	testAllCardsButton.checked = false;
	setTestListPage(false);
	testAllCardsList.clearFilter();
}

replayNextButton.addEventListener('click', _ => {
	if (currentGame == null || currentReplay == null || currentGame.turnNumber > 12) return;

	if (replayAnimationAbortController) {
		replayUpdateHand();
		replayAnimationAbortController.abort();
		replayAnimationAbortController = null;
		turnNumberLabel.setTurnNumber(currentGame.turnNumber);
		board.refresh();
		const scores = board.getScores();
		for (let i = 0; i < currentGame.players.length; i++) {
			updateStats(i, scores);
		}
	}

	clearPlayContainers();
	if (currentGame.turnNumber == 0) {
		// Show redraw decisions.
		currentGame.turnNumber++;
		turnNumberLabel.setTurnNumber(currentGame.turnNumber);
		replayUpdateHand();
	} else {
		const moves = currentReplay.turns[currentGame.turnNumber - 1];
		const result = board.makePlacements(moves);
		currentReplay.placements.push(result);

		let anySpecialAttacks = false;
		// Show the cards that were played.
		const handButton = handButtons.find(b => b.card.number == moves[currentReplay!.watchingPlayer].card.number);
		if (handButton) handButton.checked = true;
		for (let i = 0; i < currentGame.players.length; i++) {
			const player = currentGame.players[i];

			const move = moves[i];
			const button = new CardButton('checkbox', move.card);
			if ((move as PlayMove).isSpecialAttack) {
				anySpecialAttacks = true;
				player.specialPoints -= (move as PlayMove).card.specialCost;
				button.element.classList.add('specialAttack');
			} else if (move.isPass) {
				player.passes++;
				player.specialPoints++;
				const el = document.createElement('div');
				el.className = 'passLabel';
				el.innerText = 'Pass';
				button.element.appendChild(el);
			}
			button.inputElement.hidden = true;
			playContainers[i].append(button.element);
		}

		for (const p of result.specialSpacesActivated) {
			const space = board.grid[p.x][p.y];
			const player2 = currentGame.players[space & 3];
			player2.specialPoints++;
			player2.totalSpecialPoints++;
		}
		currentGame.turnNumber++;

		replayAnimationAbortController = new AbortController();
		(async () => {
			await playInkAnimations({ game: { state: GameState.Ongoing, board: null, turnNumber: currentGame.turnNumber, players: currentGame.players }, placements: result.placements, specialSpacesActivated: result.specialSpacesActivated }, anySpecialAttacks, replayAnimationAbortController.signal);
			turnNumberLabel.setTurnNumber(currentGame.turnNumber);
			clearPlayContainers();
			if (currentGame.turnNumber > 12) {
				gameButtonsContainer.hidden = true;
				passButton.enabled = false;
				specialButton.enabled = false;
				gamePage.classList.add('gameEnded');
				showResult();
			} else
				replayUpdateHand();
		})();
	}
});

replayPreviousButton.addEventListener('click', _ => {
	if (currentGame == null || currentReplay == null || currentGame.turnNumber == 0) return;

	replayAnimationAbortController?.abort();
	replayAnimationAbortController = null;

	if (currentGame.turnNumber > 1) {
		const result = currentReplay.placements.pop();
		if (!result) return;

		clearPlayContainers();
		for (let i = 0; i < currentGame.players.length; i++) {
			const el = playerBars[i].resultElement;
			el.innerText = '';
		}

		undoTurn(result);
	}
	currentGame.turnNumber--;
	gamePage.classList.remove('gameEnded');
	handContainer.hidden = false;
	gameButtonsContainer.hidden = false;

	if (currentGame.turnNumber > 0) {
		turnNumberLabel.setTurnNumber(currentGame.turnNumber);
		const scores = board.getScores();
		for (let i = 0; i < currentGame.players.length; i++) {
			const move = currentReplay.turns[currentGame.turnNumber - 1][i];
			if (move.isPass) {
				currentGame.players[i].passes--;
				currentGame.players[i].specialPoints--;
			} else if ((move as PlayMove).isSpecialAttack)
				currentGame.players[i].specialPoints += (move as PlayMove).card.specialCost;
			updateStats(i, scores);
		}
	} else
		turnNumberLabel.setTurnNumber(null);

	replayUpdateHand();
});

function undoTurn(turn: PlacementResults) {
	for (const p of turn.specialSpacesActivated) {
		const space = board.grid[p.x][p.y];
		const player2 = currentGame!.players[space & 3];
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

flipButton.addEventListener('click', () => {
	if (currentGame == null) return;
	if (replayAnimationAbortController) {
		replayAnimationAbortController.abort();
		replayAnimationAbortController = null;
		clearPlayContainers();
		turnNumberLabel.setTurnNumber(currentGame.turnNumber);
		const scores = board.getScores();
		for (let i = 0; i < currentGame.players.length; i++) {
			updateStats(i, scores);
		}
	}
	if (currentReplay) {
		currentReplay.watchingPlayer++;
		if (currentReplay.watchingPlayer >= currentGame.players.length)
		currentReplay.watchingPlayer = 0;
		gamePage.dataset.myPlayerIndex = currentReplay.watchingPlayer.toString();
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
	const button = new CardButton('radio', cardDatabase.get(card.number));
	button.inputElement.name = 'deckEditorTestSelectedCard'
	testDeckList.appendChild(button.element);
	testDeckCardButtons.push(button);
	button.inputElement.addEventListener('input', () => {
		if (button.checked) {
			for (const button2 of testDeckCardButtons.concat(testAllCardsList.cardButtons)) {
				if (button2 != button)
					button2.element.classList.remove('checked');
			}
			board.cardPlaying = card;
			if (isNaN(board.highlightX) || isNaN(board.highlightY)) {
				board.highlightX = board.startSpaces[board.playerIndex!].x - (board.flip ? 4 : 3);
				board.highlightY = board.startSpaces[board.playerIndex!].y - (board.flip ? 4 : 3);
			}
			board.cardRotation = board.flip ? 2 : 0;
			board.refreshHighlight();
			board.table.focus();
		}
	});
}

function addTestCard(card: Card) {
	const button = new CardButton('radio', cardDatabase.get(card.number));
	button.inputElement.name = 'deckEditorTestSelectedCard'
	testAllCardsList.add(button);
	button.inputElement.addEventListener('input', () => {
		if (button.checked) {
			for (const button2 of testDeckCardButtons.concat(testAllCardsList.cardButtons)) {
				if (button2 != button)
					button2.element.classList.remove('checked');
			}
			board.cardPlaying = card;
			if (isNaN(board.highlightX) || isNaN(board.highlightY)) {
				board.highlightX = board.startSpaces[board.playerIndex!].x - (board.flip ? 4 : 3);
				board.highlightY = board.startSpaces[board.playerIndex!].y - (board.flip ? 4 : 3);
			}
			board.cardRotation = board.flip ? 2 : 0;
			board.refreshHighlight();
			board.table.focus();
			if (!testCardListBackdrop.hidden) {
				testCardListBackdrop.hidden = true;
				gamePage.removeChild(testAllCardsContainer);
				testControls.appendChild(testAllCardsContainer);
				setTestListPage(false);
			}
		}
	});
}

testUndoButton.addEventListener('click', _ => {
	const turn = testPlacements.pop();
	if (turn) {
		undoTurn(turn.placementResults);
		testPlacementList.removeChild(testPlacementList.firstChild!);

		for (const button of testDeckCardButtons.concat(testAllCardsList.cardButtons)) {
			if (button.card.number == turn.card.number)
				button.enabled = true;
		}

		testUndoButton.disabled = testPlacements.length == 0;
	}
});

testBackButton.addEventListener('click', _ => {
	showPage(editingDeck ? 'deckEdit' : 'deckList');
});

testDeckButton.input.addEventListener('input', _ => {
	if (testDeckButton.checked) setTestListPage(false);
});
testAllCardsButton.input.addEventListener('input', _ => {
	if (testAllCardsButton.checked) setTestListPage(true);
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

function loadPlayers(players: Player[]) {
	gamePage.dataset.players = players.length.toString();
	const scores = board.getScores();
	for (let i = 0; i < players.length; i++) {
		const player = players[i];
		currentGame!.players[i] = players[i];
		playerBars[i].name = player.name;
		updateStats(i, scores);
		if (player.colour.r || player.colour.g || player.colour.b) {
			document.body.style.setProperty(`--primary-colour-${i + 1}`, `rgb(${player.colour.r}, ${player.colour.g}, ${player.colour.b})`);
			document.body.style.setProperty(`--special-colour-${i + 1}`, `rgb(${player.specialColour.r}, ${player.specialColour.g}, ${player.specialColour.b})`);
			document.body.style.setProperty(`--special-accent-colour-${i + 1}`, `rgb(${player.specialAccentColour.r}, ${player.specialAccentColour.g}, ${player.specialAccentColour.b})`);
		}
	}
	for (let i = 0; i < playerBars.length; i++) {
		playerBars[i].visible = i < players.length;
	}
}

function updateStats(playerIndex: number, scores: number[]) {
	if (currentGame == null) return;
	playerBars[playerIndex].points = scores[playerIndex];
	playerBars[playerIndex].pointsDelta = 0;
	playerBars[playerIndex].pointsTo = 0;
	playerBars[playerIndex].specialPoints = currentGame.players[playerIndex].specialPoints;
	playerBars[playerIndex].statSpecialPointsElement.innerText = currentGame.players[playerIndex].totalSpecialPoints.toString();
	playerBars[playerIndex].statPassesElement.innerText = currentGame.players[playerIndex].passes.toString();
}

function showReady(playerIndex: number) {
	const el = document.createElement('div');
	el.className = 'cardBack';
	el.innerText = 'Ready';
	playContainers[playerIndex].appendChild(el);
}

function clearPlayContainers() {
	for (const container of playContainers) {
		clearChildren(container);
	}
}

function setupControlsForPlay() {
	passButton.checked = false;
	specialButton.checked = false;
	board.specialAttack = false;
	board.cardPlaying = null;
	if (canPlay && currentGame?.me?.hand != null) {
		passButton.enabled = true;

		for (let i = 0; i < 4; i++) {
			canPlayCard[i] = board.canPlayCard(currentGame.me.playerIndex, currentGame.me.hand[i], false);
			canPlayCardAsSpecialAttack[i] = currentGame.players[currentGame.me.playerIndex].specialPoints >= currentGame.me.hand[i].specialCost
				&& board.canPlayCard(currentGame.me.playerIndex, currentGame.me.hand[i], true);
			handButtons[i].enabled = canPlayCard[i];
		}

		specialButton.enabled = canPlayCardAsSpecialAttack.includes(true);
		board.autoHighlight = true;
	} else {
		for (const button of handButtons) {
			button.enabled = false;
		}
		passButton.enabled = false;
		specialButton.enabled = false;
	}
}

async function playInkAnimations(data: {
	game: { state: GameState, board: Space[][] | null, turnNumber: number, players: Player[] },
	placements: Placement[],
	specialSpacesActivated: Point[]
}, anySpecialAttacks: boolean, abortSignal?: AbortSignal) {
	const inkPlaced = new Set<number>();
	const placements = data.placements;
	board.clearHighlight();
	board.cardPlaying = null;
	board.autoHighlight = false;
	canPlay = false;
	timeLabel.faded = true;
	await delay(anySpecialAttacks ? 3000 : 1000, abortSignal);
	for (const placement of placements) {
		// Skip the delay when cards don't overlap.
		if (placement.spacesAffected.find(p => inkPlaced.has(p.space.y * 37 + p.space.x))) {
			inkPlaced.clear();
			await delay(1000, abortSignal);
		}

		for (const p of placement.spacesAffected) {
			inkPlaced.add(p.space.y * 37 + p.space.x);
			board.setDisplayedSpace(p.space.x, p.space.y, p.newState);
		}
	}
	await delay(1000, abortSignal);

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
}

function showResult() {
	if (currentGame == null) return;
	turnNumberLabel.setTurnNumber(null);

	let winners = [ 0 ]; let maxPoints = playerBars[0].points;
	for (let i = 1; i < currentGame.players.length; i++) {
		if (playerBars[i].points > maxPoints) {
			winners.splice(0);
			winners.push(i);
			maxPoints = playerBars[i].points;
		} else if (playerBars[i].points == maxPoints)
			winners.push(i);
	}

	for (let i = 0; i < currentGame.players.length; i++) {
		const el = playerBars[i].resultElement;
		if (winners.includes(i)) {
			if (winners.length == 1) {
				el.classList.add('win');
				el.classList.remove('lose');
				el.classList.remove('draw');
				el.innerText = 'Victory';
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
	if (!currentReplay) {
		playRow.hidden = true;
		spectatorRow.hidden = false;
		replayPreviousButton.hidden = true;
		replayNextButton.hidden = true;
		shareReplayLinkButton.hidden = false;
		flipButton.hidden = true;
		canShareReplay = navigator.canShare && navigator.canShare({ url: window.location.href, title: 'Tableturf Battle Replay' });
		shareReplayLinkButton.innerText = canShareReplay ? 'Share replay link' : 'Copy replay link';
	}
}

function clearShowDeck() {
	showDeckContainer.hidden = true;
	testCardListBackdrop.hidden = true;
	clearChildren(showDeckListElement);
	showDeckButtons.splice(0);
}

function populateShowDeck(deck: Card[]) {
	if (showDeckButtons.length == 0) {
		for (const card of deck) {
			const button = new CardButton('checkbox', card);
			button.inputElement.hidden = true;
			showDeckButtons.push(button);

			const li = document.createElement('li');
			li.appendChild(button.element);
			showDeckListElement.appendChild(li);
		}
	}
}

function updateHand(playerData: PlayerData) {
	for (const button of handButtons) {
		handContainer.removeChild(button.element);
	}
	handButtons.splice(0);

	populateShowDeck(playerData.deck!);

	for (const button of showDeckButtons) {
		const li = button.element.parentElement!;
		if (playerData.hand!.find(c => c.number == button.card.number))
			li.className = 'inHand';
		else if (playerData.cardsUsed.includes(button.card.number))
			li.className = 'used';
		else
			li.className = 'unused';
	}

	if (!currentGame?.me) return;
	currentGame.me.hand = playerData.hand!.map(Card.fromJson);
	for (let i = 0; i < currentGame.me.hand.length; i++) {
		const card = currentGame.me.hand[i];
		const button = new CardButton('radio', card);
		button.inputElement.name = 'handCard';
		handButtons.push(button);
		button.inputElement.addEventListener('input', _ => {
			if (button.checked) {
				for (const button2 of handButtons) {
					if (button2 != button)
						button2.element.classList.remove('checked');
				}
				if (passButton.checked) {
					if (canPlay) {
						canPlay = false;
						timeLabel.faded = true;
						// Send the play to the server.
						let req = new XMLHttpRequest();
						req.open('POST', `${config.apiBaseUrl}/games/${currentGame!.id}/play`);
						req.addEventListener('error', () => communicationError());
						let data = new URLSearchParams();
						data.append('clientToken', clientToken);
						data.append('cardNumber', card.number.toString());
						data.append('isPass', 'true');
						req.send(data.toString());

						board.autoHighlight = false;
					}
				} else {
					board.cardPlaying = card;
					if (isNaN(board.highlightX) || isNaN(board.highlightY)) {
						board.highlightX = board.startSpaces[board.playerIndex!].x - (board.flip ? 4 : 3);
						board.highlightY = board.startSpaces[board.playerIndex!].y - (board.flip ? 4 : 3);
					}
					board.cardRotation = board.flip ? 2 : 0;
					board.refreshHighlight();
					board.table.focus();
				}
			}
		});
		button.inputElement.addEventListener('keydown', e => {
			switch (e.key) {
				case 'ArrowUp':
					if (i >= 2)
						handButtons[i - 2].inputElement.focus();
					e.preventDefault();
					break;
				case 'ArrowDown':
					if (i < 2)
						handButtons[i + 2].inputElement.focus();
					e.preventDefault();
					break;
				case 'ArrowLeft':
					if (i % 2 != 0)
						handButtons[i - 1].inputElement.focus();
					e.preventDefault();
					break;
				case 'ArrowRight':
					if (i % 2 == 0)
						handButtons[i + 1].inputElement.focus();
					e.preventDefault();
					break;
			}
		});
		handContainer.appendChild(button.element);
	}
}

function replayUpdateHand() {
	if (currentGame == null || currentReplay == null) return;

	for (const button of handButtons) {
		handContainer.removeChild(button.element);
	}
	handButtons.splice(0);

	const playerData = currentReplay.replayPlayerData[currentReplay.watchingPlayer];
	populateShowDeck(playerData.deck);
	for (const b of showDeckButtons)
		b.element.parentElement!.className = '';

	let indices;
	if (currentGame.turnNumber == 0) {
		indices = playerData.initialDrawOrder;
	} else {
		indices = playerData.drawOrder.slice(0, 4);
		for (let i = 0; i < currentGame.turnNumber - 1; i++) {
			const move = currentReplay.turns[i][currentReplay.watchingPlayer];
			let j = indices.findIndex(k => playerData.deck[k].number == move.card.number);
			if (j < 0) j = indices.findIndex(k => k < 0 || k >= 15);
			if (j >= 0) {
				showDeckButtons[indices[j]].element.parentElement!.className = 'used';
				if (i < 11)
					indices[j] = playerData.drawOrder[4 + i];
			}
		}
	}

	for (let i = 0; i < showDeckButtons.length; i++) {
		const li = showDeckButtons[i].element.parentElement!;
		if (!li.className)
			li.className = indices.includes(i) ? 'inHand' : 'unused';
	}

	for (let i = 0; i < 4; i++) {
		if (indices[i] >= 15) continue;  // Accounts for an old bug in the server that corrupted the initialDrawOrder replay fields.
		const card = playerData.deck[indices[i]];
		const button = new CardButton('radio', card);
		button.inputElement.hidden = true;
		handButtons.push(button);
		handContainer.appendChild(button.element);
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

function passButton_input() {
	board.autoHighlight = !passButton.checked;
	if (passButton.checked) {
		specialButton.checked = false;
		board.cardPlaying = null;
		board.specialAttack = false;
		board.clearHighlight();
		for (const el of handButtons) {
			el.enabled = true;
			el.checked = false;
		}
	} else {
		for (let i = 0; i < 4; i++) {
			handButtons[i].enabled = canPlayCard[i];
		}
	}
}
passButton.input.addEventListener('input', passButton_input);

function specialButton_input() {
	board.specialAttack = specialButton.checked;
	if (specialButton.checked) {
		passButton.checked = false;
		board.autoHighlight = true;
		for (let i = 0; i < 4; i++) {
			handButtons[i].enabled = canPlayCardAsSpecialAttack[i];
			if (!canPlayCardAsSpecialAttack[i])
				handButtons[i].checked = false;
		}
	} else {
		for (let i = 0; i < 4; i++) {
			handButtons[i].enabled = canPlayCard[i];
			if (!canPlayCard[i])
				handButtons[i].checked = false;
		}
	}
}
specialButton.input.addEventListener('input', specialButton_input);

board.onsubmit = (x, y) => {
	if (board.cardPlaying == null || !currentGame?.me)
		return;
	const message = board.checkMoveLegality(currentGame.me.playerIndex, board.cardPlaying, x, y, board.cardRotation, board.specialAttack);
	if (message != null) {
		alert(message);
		return;
	}
	if (testMode) {
		const move: PlayMove = { card: board.cardPlaying, isPass: false, isTimeout: false, x, y, rotation: board.cardRotation, isSpecialAttack: false };
		const r = board.makePlacements([ move ]);
		testPlacements.push({ card: board.cardPlaying, placementResults: r });
		board.refresh();

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
		testUndoButton.disabled = false;
	} else if (canPlay) {
		canPlay = false;
		timeLabel.faded = true;
		// Send the play to the server.
		let req = new XMLHttpRequest();
		req.open('POST', `${config.apiBaseUrl}/games/${currentGame.id}/play`);
		req.addEventListener('load', e => {
			if (req.status != 204) {
				alert(req.responseText);
				board.clearHighlight();
				board.autoHighlight = true;
			}
		});
		req.addEventListener('error', () => communicationError());
		let data = new URLSearchParams();
		data.append('clientToken', clientToken);
		data.append('cardNumber', board.cardPlaying.number.toString());
		data.append('isSpecialAttack', specialButton.checked.toString());
		data.append('x', board.highlightX.toString());
		data.append('y', board.highlightY.toString());
		data.append('r', board.cardRotation.toString());
		req.send(data.toString());

		board.autoHighlight = false;
	}
};

board.oncancel = () => {
	board.cardPlaying = null;
	board.clearHighlight();
	for (const button of handButtons) {
		if (button.checked) {
			button.checked = false;
			button.inputElement.focus();
		}
	}
};

board.onhighlightchange = dScores => {
	if (currentGame == null) return;
	const scores = board.getScores();
	for (let i = 0; i < playerBars.length; i++) {
		playerBars[i].pointsTo = dScores && dScores[i] != 0 ? scores[i] + dScores[i] : null;
	}
};

timeLabel.ontimeout = () => {
	if (currentGame == null) return;
	if (currentGame.turnNumber == 0) {
		let req = new XMLHttpRequest();
		req.open('POST', `${config.apiBaseUrl}/games/${currentGame!.id}/redraw`);
		req.addEventListener('error', () => communicationError());
		let data = new URLSearchParams();
		data.append('clientToken', clientToken);
		data.append('redraw', 'false');
		data.append('isTimeout', 'true');
		req.send(data.toString());
		redrawModal.hidden = true;
	} else {
		// When time runs out, automatically discard the largest card in the player's hand.
		let button = handButtons[0];
		for (let i = 1; i < handButtons.length; i++) {
			if (handButtons[i].card.size > button.card.size)
				button = handButtons[i];
		}
		for (const el of handButtons) {
			el.enabled = false;
			el.checked = false;
		}
		button.checked = true;
		canPlay = false;
		// Send the play to the server.
		let req = new XMLHttpRequest();
		req.open('POST', `${config.apiBaseUrl}/games/${currentGame!.id}/play`);
		req.addEventListener('error', () => communicationError());
		let data = new URLSearchParams();
		data.append('clientToken', clientToken);
		data.append('cardNumber', button.card.number.toString());
		data.append('isPass', 'true');
		data.append('isTimeout', 'true');
		req.send(data.toString());

		board.autoHighlight = false;
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
	const firstEnabledButton = handButtons.find(b => b.enabled);
	if (firstEnabledButton)
		firstEnabledButton.inputElement.focus();
	else
		passButton.input.focus();
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
	board.cardRotation--;
	board.refreshHighlight();
});
rotateRightButton.addEventListener('click', () => {
	board.cardRotation++;
	board.refreshHighlight();
});
gameDeckButton.addEventListener('click', toggleShowDeck);
showDeckCloseButton.addEventListener('click', toggleShowDeck);

document.addEventListener('keydown', e => {
	if (!pages.get('game')!.hidden) {
		switch (e.key) {
			case 'p':
				if (playRow.hidden) return;
				if (passButton.enabled) {
					passButton.checked = !passButton.checked;
					passButton_input();
					focusFirstEnabledHandCard();
				}
				e.preventDefault();
				break;
			case 's':
				if (playRow.hidden) return;
				if (specialButton.enabled) {
					specialButton.checked = !specialButton.checked;
					specialButton_input();
					focusFirstEnabledHandCard();
				}
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

shareReplayLinkButton.addEventListener('click', _ => {
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
	clearPreGameForm(true);
	showPage('preGame');
	newGameButton.focus();
	currentReplay = null;
}

document.getElementById('leaveButton')!.addEventListener('click', leaveButton_click);
