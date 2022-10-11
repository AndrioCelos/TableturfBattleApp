const board = new Board(document.getElementById('gameBoard') as HTMLTableElement);
const turnNumberLabel = new TurnNumberLabel(document.getElementById('turnNumberContainer')!, document.getElementById('turnNumberLabel')!);
const handButtons: CardButton[] = [ ];

const passButton = document.getElementById('passButton') as HTMLInputElement;
const specialButton = document.getElementById('specialButton') as HTMLInputElement;

const handContainer = document.getElementById('handContainer')!;
const redrawModal = document.getElementById('redrawModal')!;

const midGameContainer = document.getElementById('midGameContainer')!;
const resultContainer = document.getElementById('resultContainer')!;
const resultElement = document.getElementById('result')!;

const playerBars = Array.from(document.getElementsByClassName('playerBar'), el => new PlayerBar(el as HTMLDivElement));
playerBars.sort((a, b) => a.playerIndex - b.playerIndex);

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

function loadPlayers(players: Player[]) {
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
		while (container.firstChild)
			container.removeChild(container.firstChild);
	}
}

function setupControlsForPlay() {
	passButton.checked = false;
	specialButton.checked = false;
	board.specialAttack = false;
	board.cardPlaying = null;
	if (canPlay && currentGame?.me?.hand != null) {
		passButton.disabled = false;

		for (let i = 0; i < 4; i++) {
			canPlayCard[i] = board.canPlayCard(currentGame.me.playerIndex, currentGame.me.hand[i], false);
			canPlayCardAsSpecialAttack[i] = currentGame.players[currentGame.me.playerIndex].specialPoints >= currentGame.me.hand[i].specialCost
				&& board.canPlayCard(currentGame.me.playerIndex, currentGame.me.hand[i], true);
			handButtons[i].enabled = canPlayCard[i];
		}

		specialButton.disabled = !canPlayCardAsSpecialAttack.includes(true);
		board.autoHighlight = true;
	} else {
		for (const button of handButtons) {
			button.enabled = false;
			passButton.disabled = true;
			specialButton.disabled = true;
		}
	}
}

async function playInkAnimations(data: {
	game: { state: GameState, board: Space[][] | null, turnNumber: number, players: Player[] },
	placements: { cards: { playerIndex: number, card: Card }[], spacesAffected: { space: { x: number, y: number }, newState: Space }[] }[],
	specialSpacesActivated: { x: number, y: number }[]
}, anySpecialAttacks: boolean) {
	if (!data.game.board) throw new Error("Board is null during game");

	const inkPlaced = new Set<number>();
	const placements = data.placements;
	board.clearHighlight();
	board.cardPlaying = null;
	board.autoHighlight = false;
	canPlay = false;
	await delay(anySpecialAttacks ? 3000 : 1000);
	for (const placement of placements) {
		// Skip the delay when cards don't overlap.
		if (placement.spacesAffected.find(p => inkPlaced.has(p.space.y * 37 + p.space.x))) {
			inkPlaced.clear();
			await delay(1000);
		}

		for (const p of placement.spacesAffected) {
			inkPlaced.add(p.space.y * 37 + p.space.x);
			board.grid[p.space.x][p.space.y] = p.newState;
		}
		board.refresh();
	}
	await delay(1000);

	// Show special spaces.
	board.grid = data.game.board;
	board.refresh();
	if (data.specialSpacesActivated.length > 0)
		await delay(1000);  // Delay if we expect that this changed the board.
	for (let i = 0; i < data.game.players.length; i++) {
		playerBars[i].specialPoints = data.game.players[i].specialPoints;
		playerBars[i].pointsDelta = board.getScore(i) - playerBars[i].points;
	}
	await delay(1000);
	for (let i = 0; i < data.game.players.length; i++) {
		updateStats(i);
	}
	await delay(1000);
}

function showResult() {
	if (currentGame == null) return;
	midGameContainer.hidden = true;
	resultContainer.hidden = false;
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
}

function updateHand(cards: any[]) {
	for (const button of handButtons) {
		handContainer.removeChild(button.element);
	}
	handButtons.splice(0);

	if (!currentGame?.me) return;
	currentGame.me.hand = cards.map(Card.fromJson);
	if (cards) {
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
}

(document.getElementById('redrawNoButton') as HTMLButtonElement).addEventListener('click', redrawButton_click);
(document.getElementById('redrawYesButton') as HTMLButtonElement).addEventListener('click', redrawButton_click);
function redrawButton_click(e: MouseEvent) {
	let req = new XMLHttpRequest();
	req.open('POST', `${config.apiBaseUrl}/games/${currentGame!.id}/redraw`);
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
passButton.addEventListener('input', passButton_input);

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
specialButton.addEventListener('input', specialButton_input);

board.onclick = (x, y) => {
	if (board.cardPlaying == null || !currentGame?.me)
		return;
	const message = board.checkMoveLegality(currentGame.me.playerIndex, board.cardPlaying, x, y, board.cardRotation, board.specialAttack);
	if (message != null) {
		alert(message);
		return;
	}
	if (testMode) {
		for (let dy = 0; dy < 8; dy++) {
			for (let dx = 0; dx < 8; dx++) {
				let space = board.cardPlaying.getSpace(dx, dy, board.cardRotation);
				if (space != Space.Empty) {
					board.grid[x + dx][y + dy] = space;
				}
			}
		}
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
}

document.addEventListener('keydown', e => {
	if (!sections.get('game')!.hidden) {
		switch (e.key) {
			case 'p':
				if (!passButton.disabled) {
					passButton.checked = !passButton.checked;
					passButton_input();
					focusFirstEnabledHandCard();
				}
				e.preventDefault();
				break;
			case 's':
				if (!specialButton.disabled) {
					specialButton.checked = !specialButton.checked;
					specialButton_input();
					focusFirstEnabledHandCard();
				}
				e.preventDefault();
				break;
		}
	}
});

document.getElementById('resultLeaveButton')!.addEventListener('click', e => {
	e.preventDefault();
	clearPreGameForm(true);
	showSection('preGame');
	newGameButton.focus();
});
