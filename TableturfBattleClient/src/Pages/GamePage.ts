/// <reference path="../CheckButton.ts"/>

const gamePage = document.getElementById('gamePage')!;
const board = new Board(document.getElementById('gameBoard') as HTMLTableElement);
const turnNumberLabel = new TurnNumberLabel(document.getElementById('turnNumberContainer')!, document.getElementById('turnNumberLabel')!);
const handButtons: CardButton[] = [ ];

const passButton = CheckButton.fromId('passButton');
const specialButton = CheckButton.fromId('specialButton');
const gameButtonsContainer = document.getElementById('gameButtonsContainer')!;
const rotateLeftButton = document.getElementById('rotateLeftButton') as HTMLButtonElement;
const rotateRightButton = document.getElementById('rotateRightButton') as HTMLButtonElement;
const gameDeckButton = document.getElementById('gameDeckButton') as HTMLButtonElement;

const handContainer = document.getElementById('handContainer')!;
const redrawModal = document.getElementById('redrawModal')!;

const playControls = document.getElementById('playControls')!;
const resultContainer = document.getElementById('resultContainer')!;
const resultElement = document.getElementById('result')!;
const replayControls = document.getElementById('replayControls')!;
const replayNextButton = document.getElementById('replayNextButton')!;
const replayPreviousButton = document.getElementById('replayPreviousButton')!;
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

function initGame() {
	playControls.hidden = false;
	resultContainer.hidden = true;
	replayControls.hidden = true;
	gameButtonsContainer.hidden = false;
	showPage('game');
}

function initReplay() {
	playControls.hidden = true;
	resultContainer.hidden = true;
	replayControls.hidden = false;
	gameButtonsContainer.hidden = true;
	canPlay = false;
	showPage('game');
	turnNumberLabel.setTurnNumber(1);
}

replayNextButton.addEventListener('click', _ => {
	if (currentGame == null || currentReplay == null || currentGame.turnNumber > 12) return;

	if (replayAnimationAbortController) {
		replayAnimationAbortController.abort();
		replayAnimationAbortController = null;
		turnNumberLabel.setTurnNumber(currentGame.turnNumber);
		board.refresh();
		for (let i = 0; i < currentGame.players.length; i++) {
			updateStats(i);
		}
	}

	const moves = currentReplay.turns[currentGame.turnNumber - 1];
	const result = board.makePlacements(moves);
	currentReplay.placements.push(result);

	let anySpecialAttacks = false;
	// Show the cards that were played.
	clearPlayContainers();
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
			player.totalSpecialPoints++;
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
		}
	})();
});

replayPreviousButton.addEventListener('click', _ => {
	if (currentGame == null || currentReplay == null) return;

	replayAnimationAbortController?.abort();
	replayAnimationAbortController = null;

	const result = currentReplay.placements.pop();
	if (!result) return;

	clearPlayContainers();
	for (let i = 0; i < currentGame.players.length; i++) {
		const el = playerBars[i].resultElement;
		el.innerText = '';
	}

	// Unwind the turn.
	for (const p of result.specialSpacesActivated) {
		const space = board.grid[p.x][p.y];
		const player2 = currentGame.players[space & 3];
		player2.specialPoints--;
		player2.totalSpecialPoints--;
		board.grid[p.x][p.y] &= ~4;
	}
	currentGame.turnNumber--;

	for (let i = result.placements.length - 1; i >= 0; i--) {
		const placement = result.placements[i];
		for (const p of placement.spacesAffected) {
			if (p.oldState == undefined) throw new TypeError('oldState missing');
			board.grid[p.space.x][p.space.y] = p.oldState;
		}
	}

	gamePage.classList.remove('gameEnded');
	turnNumberLabel.setTurnNumber(currentGame.turnNumber);
	board.refresh();

	for (let i = 0; i < currentGame.players.length; i++) {
		const move = currentReplay.turns[currentGame.turnNumber - 1][i];
		if (move.isPass) {
			currentGame.players[i].passes--;
			currentGame.players[i].specialPoints--;
			currentGame.players[i].totalSpecialPoints--;
		} else if ((move as PlayMove).isSpecialAttack)
			currentGame.players[i].specialPoints += (move as PlayMove).card.specialCost;
		updateStats(i);
	}
});

function loadPlayers(players: Player[]) {
	gamePage.dataset.players = players.length.toString();
	for (let i = 0; i < players.length; i++) {
		const player = players[i];
		currentGame!.players[i] = players[i];
		playerBars[i].name = player.name;
		updateStats(i);
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

function updateStats(playerIndex: number) {
	if (currentGame == null) return;
	playerBars[playerIndex].points = board.getScore(playerIndex);
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
	for (let i = 0; i < data.game.players.length; i++) {
		playerBars[i].specialPoints = data.game.players[i].specialPoints;
		playerBars[i].pointsDelta = board.getScore(i) - playerBars[i].points;
	}
	await delay(1000, abortSignal);
	for (let i = 0; i < data.game.players.length; i++) {
		updateStats(i);
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

	if (!currentReplay) {
		playControls.hidden = true;
		resultContainer.hidden = false;
		canShareReplay = navigator.canShare && navigator.canShare({ url: window.location.href, title: 'Tableturf Battle Replay' });
		shareReplayLinkButton.innerText = canShareReplay ? 'Share replay link' : 'Copy replay link';
	}
}

function clearShowDeck() {
	showDeckContainer.hidden = true;
	clearChildren(showDeckListElement);
	showDeckButtons.splice(0);
}

function updateHand(playerData: PlayerData) {
	for (const button of handButtons) {
		handContainer.removeChild(button.element);
	}
	handButtons.splice(0);

	if (showDeckButtons.length == 0) {
		for (const card of playerData.deck!) {
			const button = new CardButton('checkbox', card);
			button.inputElement.hidden = true;
			showDeckButtons.push(button);

			const li = document.createElement('li');
			li.appendChild(button.element);
			showDeckListElement.appendChild(li);
		}
	}

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
		button.inputElement.addEventListener('input', e => {
			if (button.checked) {
				for (const button2 of handButtons) {
					if (button2 != button)
						button2.element.classList.remove('checked');
				}
				if (passButton.checked) {
					if (canPlay) {
						canPlay = false;
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
						board.highlightX = board.startSpaces[board.playerIndex!].x - 3;
						board.highlightY = board.startSpaces[board.playerIndex!].y - 3;
					}
					board.cardRotation = 0;
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

board.onclick = (x, y) => {
	if (board.cardPlaying == null || !currentGame?.me)
		return;
	const message = board.checkMoveLegality(currentGame.me.playerIndex, board.cardPlaying, x, y, board.cardRotation, board.specialAttack);
	if (message != null) {
		alert(message);
		return;
	}
	if (testMode) {
		const move: PlayMove = { card: board.cardPlaying, isPass: false, x, y, rotation: board.cardRotation, isSpecialAttack: false };
		const r = board.makePlacements([ move ]);
		board.refresh();
	} else if (canPlay) {
		canPlay = false;
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
		showDeckCloseButton.focus();
	} else {
		showDeckContainer.hidden = true;
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
showDeckCloseButton.addEventListener('click', () => showDeckContainer.hidden = true);

document.addEventListener('keydown', e => {
	if (!pages.get('game')!.hidden) {
		switch (e.key) {
			case 'p':
				if (passButton.enabled) {
					passButton.checked = !passButton.checked;
					passButton_input();
					focusFirstEnabledHandCard();
				}
				e.preventDefault();
				break;
			case 's':
				if (specialButton.enabled) {
					specialButton.checked = !specialButton.checked;
					specialButton_input();
					focusFirstEnabledHandCard();
				}
				e.preventDefault();
				break;
			case 'd':
				if (!gameButtonsContainer.hidden) toggleShowDeck();
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
				navigator.clipboard.writeText(window.location.toString()).then(() => shareLinkButton.innerText = 'Copied');
			}
		}
	});
	req.send();
});

document.getElementById('resultLeaveButton')!.addEventListener('click', e => {
	e.preventDefault();
	clearPreGameForm(true);
	showPage('preGame');
	newGameButton.focus();
});

document.getElementById('replayLeaveButton')!.addEventListener('click', e => {
	e.preventDefault();
	clearPreGameForm(true);
	showPage('preGame');
	newGameButton.focus();
	currentReplay = null;
});
