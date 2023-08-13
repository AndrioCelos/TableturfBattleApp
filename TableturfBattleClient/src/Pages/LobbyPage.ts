const lobbyWinCounters: WinCounter[] = [ ];

const stageButtons = new CheckButtonGroup<Stage>(document.getElementById('stageList')!);
const shareLinkButton = document.getElementById('shareLinkButton') as HTMLButtonElement;
const showQrCodeButton = document.getElementById('showQrCodeButton') as HTMLButtonElement;
const stageSelectionForm = document.getElementById('stageSelectionForm') as HTMLFormElement;
const stageSelectionFormLoadingSection = stageSelectionForm.getElementsByClassName('loadingContainer')[0] as HTMLElement;
const stageSelectionFormSubmitButton = document.getElementById('submitStageButton') as HTMLButtonElement;
const stageRandomButton = CheckButton.fromId('stageRandomButton');

const deckSelectionForm = document.getElementById('deckSelectionForm') as HTMLFormElement;
const deckSelectionFormLoadingSection = deckSelectionForm.getElementsByClassName('loadingContainer')[0] as HTMLElement;
const lobbySelectedStageSection = document.getElementById('lobbySelectedStageSection')!;
const lobbyStageSection = document.getElementById('lobbyStageSection')!;
const lobbyStageSubmitButton = document.getElementById('submitStageButton') as HTMLButtonElement;
const lobbyDeckSection = document.getElementById('lobbyDeckSection')!;
const lobbyDeckList = document.getElementById('lobbyDeckList')!;
const lobbyDeckButtons = new CheckButtonGroup<Deck>(lobbyDeckList);
const lobbyDeckSubmitButton = document.getElementById('submitDeckButton') as HTMLButtonElement;

const lobbyTimeLimitBox = document.getElementById('lobbyTimeLimitBox') as HTMLInputElement;
const lobbyTimeLimitUnit = document.getElementById('lobbyTimeLimitUnit')!;

const qrCodeDialog = document.getElementById('qrCodeDialog') as HTMLDialogElement;
let qrCode: QRCode | null;
let lobbyShareData: ShareData | null;

let selectedStageIndicator = null as StageButton | null;

function lobbyInitStageDatabase(stages: Stage[]) {
	for (const stage of stages) {
		const button = new StageButton(stage);
		stageButtons.add(button, stage);
		button.buttonElement.addEventListener('click', () => {
			stageRandomButton.checked = false;
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
}

function showStageSelectionForm() {
	lobbyStageSection.hidden = false;
	stageSelectionFormLoadingSection.hidden = true;
	stageRandomButton.checked = true;
	stageButtons.deselect();
	lobbyStageSubmitButton.disabled = false;
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
	if (!currentGame) throw new Error('No current game');
	for (const li of playerListItems)
		playerList.removeChild(li);
	playerListItems.splice(0);
	lobbyWinCounters.splice(0);

	for (let i = 0; i < currentGame.maxPlayers; i++) {
		var el = document.createElement('li');
		el.className = 'empty';
		el.innerText = 'Waiting...';
		playerListItems.push(el);
		playerList.appendChild(el);
	}
}

function clearReady() {
	if (!currentGame) throw new Error('No current game');
	stageSelectionFormSubmitButton.disabled = false;
	stageSelectionFormLoadingSection.hidden = true;
	for (var i = 0; i < currentGame.players.length; i++) {
		currentGame.players[i].isReady = false;
		playerListItems[i].className = 'filled';
	}
}

function lobbyAddPlayer(playerIndex: number) {
	if (!currentGame) throw new Error('No current game');
	const listItem = playerListItems[playerIndex];
	const player = currentGame.players[playerIndex];
	listItem.innerText = player.name;
	listItem.className = player.isReady ? 'filled ready' : 'filled';

	const el = document.createElement('div');
	el.className = 'wins';
	el.title = 'Battles won';
	listItem.appendChild(el);
	const winCounter = new WinCounter(el);
	winCounter.wins = currentGame.players[playerIndex].gamesWon;
	lobbyWinCounters.push(winCounter);
}

function lobbySetReady(playerIndex: number) {
	playerListItems[playerIndex].className = 'filled ready';
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
			buttonElement.innerText = deck.name;
			const button = new CheckButton(buttonElement);
			lobbyDeckButtons.add(button, deck);

			buttonElement.addEventListener('click', () => {
				selectedDeck = deck;
				lobbyDeckSubmitButton.disabled = false;
			});

			if (!deck.isValid) {
				button.enabled = false;
			} else if (deck.name == lastDeckName) {
				selectedDeck = deck;
				button.checked = true;
			}
		}
		lobbyDeckSubmitButton.disabled = selectedDeck == null;
		deckSelectionFormLoadingSection.hidden = true;
		lobbyDeckSection.hidden = false;
	} else {
		lobbyDeckSection.hidden = true;
	}
}

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
	req.send(data.toString());

	localStorage.setItem('lastDeckName', selectedDeck.name);
	deckSelectionFormLoadingSection.hidden = false;
	lobbyDeckSubmitButton.disabled = true;
});

stageRandomButton.buttonElement.addEventListener('click', () => {
	stageRandomButton.checked = true;
	stageButtons.deselect();
});

stageSelectionForm.addEventListener('submit', e => {
	e.preventDefault();
	let req = new XMLHttpRequest();
	req.open('POST', `${config.apiBaseUrl}/games/${currentGame!.id}/chooseStage`);
	req.addEventListener('load', () => {
		if (req.status != 204) {
			stageSelectionFormLoadingSection.hidden = true;
			alert(req.responseText);
			lobbyStageSubmitButton.disabled = false;
		}
	});
	req.addEventListener('error', () => communicationError());
	let data = new URLSearchParams();
	const stageName = stageRandomButton.checked ? 'random' : stageButtons.value!.name;
	data.append('clientToken', clientToken);
	data.append('stage', stageName);
	req.send(data.toString());

	localStorage.setItem('lastStage', stageName);
	stageSelectionFormLoadingSection.hidden = false;
	lobbyStageSubmitButton.disabled = true;
});
