/// <reference path="../CardDatabase.ts"/>
/// <reference path="../StageDatabase.ts"/>

const stageButtons: StageButton[] = [ ];
const shareLinkButton = document.getElementById('shareLinkButton') as HTMLButtonElement;
const showQrCodeButton = document.getElementById('showQrCodeButton') as HTMLButtonElement;
const stageSelectionForm = document.getElementById('stageSelectionForm') as HTMLFormElement;
const stageSelectionFormLoadingSection = stageSelectionForm.getElementsByClassName('loadingContainer')[0] as HTMLElement;
const stageSelectionFormSubmitButton = document.getElementById('submitStageButton') as HTMLButtonElement;
const stageRandomLabel = document.getElementById('stageRandomLabel')!;
const stageRandomButton = document.getElementById('stageRandomButton') as HTMLInputElement;

const deckSelectionForm = document.getElementById('deckSelectionForm') as HTMLFormElement;
const deckSelectionFormLoadingSection = deckSelectionForm.getElementsByClassName('loadingContainer')[0] as HTMLElement;
const lobbySelectedStageSection = document.getElementById('lobbySelectedStageSection')!;
const lobbyStageSection = document.getElementById('lobbyStageSection')!;
const lobbyDeckSection = document.getElementById('lobbyDeckSection')!;
const lobbyDeckList = document.getElementById('lobbyDeckList')!;
const lobbyDeckButtons: CheckButton[] = [ ];

const qrCodeDialog = document.getElementById('qrCodeDialog') as HTMLDialogElement;
let qrCode: QRCode | null;
let lobbyShareData: ShareData | null;

let selectedStageButton = null as StageButton | null;

function initLobbyPage(url: string) {
	stageSelectionFormSubmitButton.disabled = false;
	stageSelectionFormLoadingSection.hidden = true;
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
	for (const input of stageSelectionForm.elements) {
		if (input instanceof HTMLButtonElement)
			input.disabled = false;
		else if (input instanceof HTMLInputElement)
			input.checked = false;
	}
	stageRandomButton.checked = true;
	stageRandomLabel.classList.add('checked');
	for (const button of stageButtons)
		button.element.classList.remove('checked');
}

function showDeckSelectionForm() {
	lobbyStageSection.hidden = false;
	stageSelectionFormLoadingSection.hidden = true;
	for (const input of stageSelectionForm.elements) {
		if (input instanceof HTMLButtonElement)
			input.disabled = false;
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
})

function clearReady() {
	if (currentGame == null) return;
	for (var i = 0; i < currentGame.players.length; i++) {
		currentGame.players[i].isReady = false;
		updatePlayerListItem(i);
	}
}

function updatePlayerListItem(playerIndex: number) {
	const listItem = playerListItems[playerIndex];
	if (!currentGame?.players || playerIndex >= currentGame.players.length) {
		listItem.className = 'empty';
		listItem.innerText = 'Waiting...';
	} else {
		const player = currentGame.players[playerIndex];
		listItem.innerText = player.name;
		listItem.className = player.isReady ? 'filled ready' : 'filled';
	}
}

function initDeckSelection() {
	const lastDeckName = localStorage.getItem('lastDeckName');

	selectedDeck = null;
	if (currentGame?.me) {
		clearChildren(lobbyDeckList);
		lobbyDeckButtons.splice(0);

		for (let i = 0; i < decks.length; i++) {
			const deck = decks[i];

			const label = document.createElement('label');

			const input = document.createElement('input');
			input.name = 'gameSelectedDeck';
			input.type = 'radio';
			input.dataset.index = i.toString();
			input.addEventListener('input', () => {
				if (input.checked) {
					for (const button of lobbyDeckButtons) {
						if (button.input != input) button.checked = false;
					}
					selectedDeck = deck;
					for (const input of deckSelectionForm.elements) {
						if (input instanceof HTMLButtonElement)
							input.disabled = false;
					}
				}
			});
			label.appendChild(input);

			label.appendChild(document.createTextNode(deck.name));

			lobbyDeckList.appendChild(label);
			const button = new CheckButton(input, label);
			lobbyDeckButtons.push(button);

			if (!deck.isValid) {
				button.enabled = false;
			} else if (deck.name == lastDeckName) {
				selectedDeck = deck;
				button.checked = true;
			}
		}
		for (const input of deckSelectionForm.elements) {
			if (input instanceof HTMLButtonElement)
				input.disabled = selectedDeck == null;
		}
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
			for (const input of deckSelectionForm.elements) {
				if (input instanceof HTMLButtonElement)
					input.disabled = false;
			}
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
	for (const input of deckSelectionForm.elements) {
		if (input instanceof HTMLButtonElement)
			input.disabled = true;
	}
});

function initStageDatabase(stages: Stage[]) {
	const stageList = document.getElementById('stageList')!;
	for (const stage of stages) {
		const button = new StageButton(stage);
		stageButtons.push(button);
		button.inputElement.name = 'stage';
		button.inputElement.addEventListener('input', () => {
			if (button.inputElement.checked) {
				stageRandomLabel.classList.remove('checked');
				for (const button2 of stageButtons) {
					if (button2 != button)
						button2.element.classList.remove('checked');
				}
			}
		});
		button.setStartSpaces(2);
		stageList.appendChild(button.element);
		addTestStage(stage);
	}
	document.getElementById('stageListLoadingSection')!.hidden = true;
}

stageRandomButton.addEventListener('input', () => {
	if (stageRandomButton.checked) {
		stageRandomLabel.classList.add('checked');
		for (const button of stageButtons)
			button.element.classList.remove('checked');
	}
});

stageSelectionForm.addEventListener('submit', e => {
	e.preventDefault();
	let req = new XMLHttpRequest();
	req.open('POST', `${config.apiBaseUrl}/games/${currentGame!.id}/chooseStage`);
	req.addEventListener('load', () => {
		if (req.status != 204) {
			stageSelectionFormLoadingSection.hidden = true;
			alert(req.responseText);
			for (const input of stageSelectionForm.elements) {
				if (input instanceof HTMLButtonElement)
					input.disabled = false;
			}
		}
	});
	req.addEventListener('error', () => communicationError());
	let data = new URLSearchParams();
	const stageName = stageRandomButton.checked ? 'random' : stageButtons.find(b => b.checked)!.stage.name;
	data.append('clientToken', clientToken);
	data.append('stage', stageName);
	req.send(data.toString());

	localStorage.setItem('lastStage', stageName);
	stageSelectionFormLoadingSection.hidden = false;
	for (const input of stageSelectionForm.elements) {
		if (input instanceof HTMLButtonElement)
			input.disabled = true;
	}
});
