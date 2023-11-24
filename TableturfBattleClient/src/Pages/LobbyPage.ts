const playerList = document.getElementById('playerList')!;
const playerListSlots: HTMLElement[] = [ ];
const playerListNames: HTMLElement[] = [ ];
const lobbyWinCounters: WinCounter[] = [ ];
const playerListItemsToRemove: HTMLElement[] = [ ];
let playerListItemToRemove: HTMLElement | null = null;

const stageButtons = new CheckButtonGroup<number>(document.getElementById('stageList')!);
const shareLinkButton = document.getElementById('shareLinkButton') as HTMLButtonElement;
const showQrCodeButton = document.getElementById('showQrCodeButton') as HTMLButtonElement;
const stageSelectionForm = document.getElementById('stageSelectionForm') as HTMLFormElement;
const stageSelectionFormLoadingSection = stageSelectionForm.getElementsByClassName('loadingContainer')[0] as HTMLElement;
const stageRandomButton = CheckButton.fromId('stageRandomButton');
const strikeOrderSelectionForm = document.getElementById('strikeOrderSelectionForm') as HTMLFormElement;

const deckSelectionForm = document.getElementById('deckSelectionForm') as HTMLFormElement;
const deckSelectionFormLoadingSection = deckSelectionForm.getElementsByClassName('loadingContainer')[0] as HTMLElement;
const lobbySelectedStageSection = document.getElementById('lobbySelectedStageSection')!;
const lobbyStageSection = document.getElementById('lobbyStageSection')!;
const stagePrompt = document.getElementById('stagePrompt')!;
const lobbyStageSubmitButton = document.getElementById('submitStageButton') as HTMLButtonElement;
const lobbyDeckSection = document.getElementById('lobbyDeckSection')!;
const lobbyDeckList = document.getElementById('lobbyDeckList')!;
const lobbyDeckButtons = new CheckButtonGroup<SavedDeck>(lobbyDeckList);
const lobbyDeckSubmitButton = document.getElementById('submitDeckButton') as HTMLButtonElement;

const lobbyTimeLimitBox = document.getElementById('lobbyTimeLimitBox') as HTMLInputElement;
const lobbyAllowUpcomingCardsBox = document.getElementById('lobbyAllowUpcomingCardsBox') as HTMLInputElement;
const lobbyTimeLimitUnit = document.getElementById('lobbyTimeLimitUnit')!;

const qrCodeDialog = document.getElementById('qrCodeDialog') as HTMLDialogElement;
let qrCode: QRCode | null;
let lobbyShareData: ShareData | null;

let selectedStageIndicator = null as StageButton | null;
let stageSelectionPrompt = null as StageSelectionPrompt | null;

function lobbyInitStageDatabase(stages: Stage[]) {
	stageButtons.add(stageRandomButton, -1);
	let i = 0;
	for (const stage of stages) {
		const button = new StageButton(stage);
		stageButtons.add(button, i++);
		button.buttonElement.addEventListener('click', () => {
			stageRandomButton.checked = false;
			lobbyStageSubmitButton.disabled = !stageSelectionPrompt || stageButtons.buttons.filter(b => b.checked).length != (stageSelectionPrompt.promptType == StageSelectionPromptType.Strike ? stageSelectionPrompt.numberOfStagesToStrike : 1);
		});
		button.setStartSpaces(2);
	}
	document.getElementById('stageListLoadingSection')!.hidden = true;
}

function initLobbyPage(url: string) {
	lobbyShareData = { url: url, title: 'Tableturf Battle' };
	if (navigator.canShare && navigator.canShare(lobbyShareData)) {
		shareLinkButton.innerText = 'Share link';
	} else {
		lobbyShareData = null;
		shareLinkButton.innerText = 'Copy link';
	}
	lobbyDeckSection.hidden = true;
}

function showStageSelectionForm(prompt: StageSelectionPrompt | null, isReady: boolean) {
	stageSelectionPrompt = prompt;
	if (!prompt) return;

	lobbyStageSection.hidden = false;
	stageSelectionFormLoadingSection.hidden = true;
	stageRandomButton.checked = true;
	stageButtons.deselect();
	lobbyStageSubmitButton.disabled = true;

	let i = -1;
	for (const button of stageButtons.buttons) {
		const originalClass = i < 0 ? 'stageRandom' : 'stage';
		if (prompt.bannedStages?.includes(i)) {
			button.buttonElement.className = `${originalClass} banned`;
			button.enabled = false;
		} else if (prompt.struckStages?.includes(i)) {
			button.buttonElement.className = `${originalClass} struck`;
			button.enabled = false;
		} else {
			button.buttonElement.className = originalClass;
			button.enabled = prompt.promptType != StageSelectionPromptType.Wait && !isReady;
		}
		i++;
	}

	switch (prompt.promptType) {
		case StageSelectionPromptType.Vote:
			stageSelectionForm.hidden = false;
			stageRandomButton.buttonElement.hidden = false;
			strikeOrderSelectionForm.hidden = true;
			stagePrompt.innerText = isReady ? 'Opponent is choosing...' : 'Vote for the stage.';
			stageButtons.allowMultipleSelections = false;
			stageButtons.parentElement!.classList.remove('striking');
			break;
		case StageSelectionPromptType.VoteOrder:
			stageSelectionForm.hidden = true;
			strikeOrderSelectionForm.hidden = false;
			for (const button of strikeOrderSelectionForm.getElementsByTagName('button'))
				(<HTMLButtonElement> button).disabled = isReady;
			break;
		case StageSelectionPromptType.Strike:
			stageSelectionForm.hidden = false;
			stageRandomButton.buttonElement.hidden = true;
			strikeOrderSelectionForm.hidden = true;
			stagePrompt.innerText = prompt.numberOfStagesToStrike == 1 ? 'Choose a stage to strike.' : `Choose ${prompt.numberOfStagesToStrike} stages to strike.`;
			stageButtons.allowMultipleSelections = prompt.numberOfStagesToStrike != 1;
			stageButtons.parentElement!.classList.add('striking');
			break;
		case StageSelectionPromptType.Choose:
			stageSelectionForm.hidden = false;
			stageRandomButton.buttonElement.hidden = true;
			strikeOrderSelectionForm.hidden = true;
			stagePrompt.innerText = 'Choose the stage for the next battle.';
			stageButtons.allowMultipleSelections = false;
			stageButtons.parentElement!.classList.remove('striking');
			break;
		case StageSelectionPromptType.Wait:
			stageSelectionForm.hidden = false;
			stageRandomButton.buttonElement.hidden = true;
			strikeOrderSelectionForm.hidden = true;
			stagePrompt.innerText = currentGame?.game.state == GameState.ChoosingStage ? 'Opponent is choosing...' : 'Possible stages:';
			stageButtons.allowMultipleSelections = false;
			stageButtons.parentElement!.classList.remove('striking');
			break;
	}
}

shareLinkButton.addEventListener('click', () => {
	if (lobbyShareData) {
		navigator.share(lobbyShareData);
	} else {
		navigator.clipboard.writeText(window.location.toString()).then(() => shareLinkButton.innerText = 'Copied');
	}
});

showQrCodeButton.addEventListener('click', () => {
	const qrCodeUrl = config.qrCodeGameUrl ? config.qrCodeGameUrl.replace('$id', currentGame!.id) : window.location.href;
	if (qrCode)
		qrCode.makeCode(qrCodeUrl);
	else {
		const correctLevel = config.qrCodeCorrectionLevel ?
			(typeof(config.qrCodeCorrectionLevel) == 'string'
				? QRCode.CorrectLevel[config.qrCodeCorrectionLevel as keyof typeof QRCode.CorrectLevel]
				: config.qrCodeCorrectionLevel)
			: QRCode.CorrectLevel.H;
		qrCode = new QRCode(document.getElementById("qrCode")!, { text: qrCodeUrl, correctLevel });
	}
	qrCodeDialog.showModal();
});

qrCodeDialog.addEventListener('click', e => {
	if (e.target == qrCodeDialog && (e.offsetX < 0 || e.offsetY < 0 || e.offsetX >= qrCodeDialog.offsetWidth || e.offsetY >= qrCodeDialog.offsetHeight)) {
		// Background was clicked.
		qrCodeDialog.close();
	}
});

function lobbyResetSlots() {
	if (!currentGame) throw new TypeError('No current game');
	playerListSlots.splice(0);
	playerListNames.splice(0);
	lobbyWinCounters.splice(0);
	clearChildren(playerList);

	for (let i = 0; i < currentGame.game.maxPlayers; i++) {
		const el = document.createElement('li');
		const placeholder = document.createElement('div');
		placeholder.className = 'placeholder';
		placeholder.innerText = 'Waiting...';
		playerList.appendChild(el);
		el.appendChild(placeholder);
		playerListSlots.push(el);
	}

	lobbyLockSettings(currentGame.me?.playerIndex != 0);
}

function lobbyLockSettings(lock: boolean) {
	lobbyTimeLimitBox.readOnly = lock;
	lobbyAllowUpcomingCardsBox.disabled = lock;
}

function clearReady() {
	if (!currentGame) throw new TypeError('No current game');
	lobbyStageSubmitButton.disabled = false;
	stageSelectionFormLoadingSection.hidden = true;
	for (var i = 0; i < currentGame.game.players.length; i++) {
		currentGame.game.players[i].isReady = false;
		playerListNames[i].classList.remove('ready');
	}
}

function lobbyAddPlayer() {
	if (!currentGame) throw new TypeError('No current game');

	if (playerListItemToRemove) {
		playerListItemToRemove.removeEventListener('animationend', playerListItem_animationEnd);
		playerListItem_animationEnd();
	}

	const playerIndex = playerListNames.length;
	const slot = playerListSlots[playerIndex];
	const player = currentGame.game.players[playerIndex];

	const el = document.createElement('div');
	el.classList.add('filled');
	if (player.isReady) el.classList.add('ready');
	if (!player.isOnline) el.classList.add('disconnected');
	el.innerText = player.name;
	slot.appendChild(el);
	playerListNames.push(el);

	const el2 = document.createElement('img');
	el2.src = 'assets/wifi-off.svg';
	el2.className = 'disconnectedIcon';
	el2.title = 'Disconnected';
	el.appendChild(el2);

	const el3 = document.createElement('div');
	el3.className = 'wins';
	el3.title = 'Battles won';
	el.appendChild(el3);

	const winCounter = new WinCounter(el3);
	winCounter.wins = player.gamesWon;
	lobbyWinCounters.push(winCounter);
}

function lobbyRemovePlayer(playerIndex: number) {
	if (!currentGame) throw new TypeError('No current game');

	// Animate the leaving player and all entries below them to mimic the original game.
	for (let i = playerIndex; i < playerListNames.length; i++)
		(<HTMLElement>playerListSlots[i].lastElementChild).classList.add('removed');

	const el = <HTMLElement>playerListSlots[playerIndex].lastElementChild;
	el.classList.add('removed');
	playerListItemsToRemove.push(el);

	if (playerListItemToRemove)
		playerListItemToRemove.removeEventListener('animationend', playerListItem_animationEnd);

	playerListItemToRemove = el;
	el.addEventListener('animationend', playerListItem_animationEnd);
	playerListNames.splice(playerIndex, 1);
}

function playerListItem_animationEnd() {
	for (const el of playerListItemsToRemove)
		el.parentElement!.removeChild(el);
	playerListItemsToRemove.splice(0);
	playerListItemToRemove = null;

	for (let i = 0; i < playerListNames.length; i++) {
		playerListNames[i].classList.remove('removed');
		if (playerListNames[i].parentElement != playerListSlots[i]) {
			playerListNames[i].parentElement!.removeChild(playerListNames[i]);
			playerListSlots[i].appendChild(playerListNames[i]);
		}
	}
}

function lobbySetReady(playerIndex: number) {
	playerListNames[playerIndex].classList.add('ready');
}

function lobbySetOnline(playerIndex: number, isOnline: boolean) {
	if (isOnline) playerListNames[playerIndex].classList.remove('disconnected');
	else playerListNames[playerIndex].classList.add('disconnected');
}

function initDeckSelection() {
	const lastDeckName = localStorage.getItem('lastDeckName');

	selectedDeck = null;
	if (currentGame?.me) {
		lobbyDeckButtons.clear();

		for (let i = 0; i < decks.length; i++) {
			const deck = decks[i];

			const buttonElement = document.createElement('button');
			buttonElement.type = 'button';
			buttonElement.className = 'deckButton';
			buttonElement.innerText = deck.name;
			buttonElement.dataset.sleeves = deck.sleeves.toString();
			const button = new CheckButton(buttonElement);
			lobbyDeckButtons.add(button, deck);

			buttonElement.addEventListener('click', () => {
				if (button.enabled) {
					selectedDeck = deck;
					lobbyDeckSubmitButton.disabled = false;
				}
			});

			if (!deck.isValid || (!currentGame.game.allowUpcomingCards && deck.cards.find(n => cardDatabase.get(n).number < 0))) {
				button.enabled = false;
			} else if (deck.name == lastDeckName) {
				selectedDeck = deck;
				button.checked = true;
			}
		}
		lobbyDeckSubmitButton.disabled = selectedDeck == null;
		deckSelectionFormLoadingSection.hidden = true;
		lobbyStageSection.hidden = true;
		lobbyDeckSection.hidden = false;
	} else {
		lobbyDeckSection.hidden = true;
	}
}

lobbyTimeLimitBox.addEventListener('change', () => {
	let req = new XMLHttpRequest();
	req.open('POST', `${config.apiBaseUrl}/games/${currentGame!.id}/setGameSettings`);
	let data = new URLSearchParams();
	data.append('clientToken', clientToken);
	data.append('turnTimeLimit', lobbyTimeLimitBox.value || '');
	req.send(data.toString());
});

lobbyAllowUpcomingCardsBox.addEventListener('change', () => {
	let req = new XMLHttpRequest();
	req.open('POST', `${config.apiBaseUrl}/games/${currentGame!.id}/setGameSettings`);
	let data = new URLSearchParams();
	data.append('clientToken', clientToken);
	data.append('allowUpcomingCards', lobbyAllowUpcomingCardsBox.checked.toString());
	req.send(data.toString());
});

deckSelectionForm.addEventListener('submit', e => {
	e.preventDefault();
	if (selectedDeck == null) return;

	let req = new XMLHttpRequest();
	req.open('POST', `${config.apiBaseUrl}/games/${currentGame!.id}/chooseDeck`);
	req.addEventListener('load', () => {
		if (req.status != 204) {
			deckSelectionFormLoadingSection.hidden = true;
			alert(req.responseText);
			lobbyDeckSubmitButton.disabled = false;
		}
	});
	req.addEventListener('error', () => communicationError());
	let data = new URLSearchParams();
	data.append('clientToken', clientToken);
	data.append('deckName', selectedDeck.name);
	data.append('deckCards', selectedDeck.cards.join('+'));
	data.append('deckSleeves', selectedDeck.sleeves.toString());
	req.send(data.toString());

	localStorage.setItem('lastDeckName', selectedDeck.name);
	deckSelectionFormLoadingSection.hidden = false;
	lobbyDeckSubmitButton.disabled = true;
});

stageRandomButton.buttonElement.addEventListener('click', () => {
	stageRandomButton.checked = true;
	stageButtons.deselect();
	lobbyStageSubmitButton.disabled = false;
});

stageSelectionForm.addEventListener('submit', e => {
	e.preventDefault();
	let req = new XMLHttpRequest();
	req.open('POST', `${config.apiBaseUrl}/games/${currentGame!.id}/chooseStage`);
	req.addEventListener('load', () => {
		stageSelectionFormLoadingSection.hidden = true;
		if (req.status != 204) {
			alert(req.responseText);
			lobbyStageSubmitButton.disabled = false;
		}
	});
	req.addEventListener('error', () => communicationError());
	let data = new URLSearchParams();
	data.append('clientToken', clientToken);
	data.append('stages', stageButtons.entries.filter(e => e.button.checked).map(e => e.value).join(','));
	req.send(data.toString());

	stageSelectionFormLoadingSection.hidden = false;
	lobbyStageSubmitButton.disabled = true;
});

strikeOrderSelectionForm.addEventListener('submit', e => {
	e.preventDefault();
	for (const button of strikeOrderSelectionForm.getElementsByTagName('button'))
		(<HTMLButtonElement> button).disabled = true;
	let req = new XMLHttpRequest();
	req.open('POST', `${config.apiBaseUrl}/games/${currentGame!.id}/chooseStage`);
	req.addEventListener('load', () => {
		if (req.status != 204) {
			stageSelectionFormLoadingSection.hidden = true;
			alert(req.responseText);
			lobbyStageSubmitButton.disabled = false;
			for (const button of strikeOrderSelectionForm.getElementsByTagName('button'))
				(<HTMLButtonElement> button).disabled = false;
		}
	});
	req.addEventListener('error', () => communicationError());
	let data = new URLSearchParams();
	const number = e.submitter!.dataset.strikeIndex!;
	data.append('clientToken', clientToken);
	data.append('stages', number);
	req.send(data.toString());
});
