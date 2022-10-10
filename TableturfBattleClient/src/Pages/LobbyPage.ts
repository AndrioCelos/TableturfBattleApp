/// <reference path="../CardDatabase.ts"/>
/// <reference path="../StageDatabase.ts"/>

const stageButtons: StageButton[] = [ ];
const cardButtons: CardButton[] = [ ];
const shareLinkButton = document.getElementById('shareLinkButton') as HTMLButtonElement;
const submitDeckButton = document.getElementById('submitDeckButton') as HTMLButtonElement;
let lobbyShareData: ShareData | null;
const stageSelectionForm = document.getElementById('stageSelectionForm') as HTMLFormElement;
const stageRandomLabel = document.getElementById('stageRandomLabel')!;
const stageRandomButton = document.getElementById('stageRandomButton') as HTMLInputElement;

const lobbySelectedStageSection = document.getElementById('lobbySelectedStageSection')!;
const lobbyStageSection = document.getElementById('lobbyStageSection')!;
const lobbyDeckSection = document.getElementById('lobbyDeckSection')!;

let selectedStageButton = null as StageButton | null;

function initLobbyPage(url: string) {
	lobbyShareData = { url: url, title: 'Tableturf Battle' };
	if (navigator.canShare && navigator.canShare(lobbyShareData)) {
		shareLinkButton.innerText = 'Share link';
	} else {
		lobbyShareData = null;
		shareLinkButton.innerText = 'Copy link';
	}
}

shareLinkButton.addEventListener('click', () => {
	if (lobbyShareData != null) {
		navigator.share(lobbyShareData);
	} else {
		navigator.clipboard.writeText(window.location.toString()).then(() => shareLinkButton.innerText = 'Copied');
	}
});

function clearReady() {
	if (currentGame == null) return;
	for (var i = 0; i < currentGame.players.length; i++) {
		currentGame.players[i].isReady = false;
		updatePlayerListItem(i);
	}
}

function updatePlayerListItem(playerIndex: number) {
	const player = currentGame != null ? currentGame.players[playerIndex] : null;
	const listItem = playerListItems[playerIndex];
	if (player != null) {
		listItem.innerText = player.name;
		if (player.isReady)
			listItem.innerText += ' (Ready)';
	} else
		listItem.innerText = "Waiting...";
}

function updateDeckCount() {
	var count = 0;
	for (var el of cardButtons) {
		if (el.inputElement.checked)
			count++;
	}
	document.getElementById('countLabel')!.innerText = count.toString();
	submitDeckButton.disabled = (count != 15);
}

submitDeckButton.addEventListener('click', e => {
	let req = new XMLHttpRequest();
	req.open('POST', `${config.apiBaseUrl}/games/${currentGame!.id}/chooseDeck`);
	req.addEventListener('load', e => {
		if (req.status == 204) {
			showSection('lobby');
		}
	});
	let data = new URLSearchParams();
	let cardsString = '';
	for (var el of cardButtons) {
		if (el.inputElement.checked) {
			if (cardsString != '') cardsString += '+';
			cardsString += el.card.number.toString();
		}
	}
	data.append('clientToken', clientToken);
	data.append('deckName', 'Deck');
	data.append('deckCards', cardsString);
	req.send(data.toString());
	localStorage.setItem('lastDeck', cardsString);
});

const starterDeck = [ 6, 34, 159, 13, 45, 137, 22, 52, 141, 28, 55, 103, 40, 56, 92 ];
const lastDeckString = localStorage.getItem('lastDeck');
const lastDeck = lastDeckString?.split(/\+/)?.map(s => parseInt(s)) || starterDeck;

cardDatabase.loadAsync().then(cards => {
	const cardList = document.getElementById('cardList')!;
	for (const card of cards) {
		const button = new CardButton('checkbox', card);
		cardButtons.push(button);
		button.checked = lastDeck != null && lastDeck.includes(card.number);
		button.inputElement.addEventListener('input', updateDeckCount);
		cardList.appendChild(button.element);
	}
	updateDeckCount();
	document.getElementById('cardListLoadingSection')!.hidden = true;
}).catch(() => communicationError);

stageDatabase.loadAsync().then(stages => {
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
	}
	document.getElementById('stageListLoadingSection')!.hidden = true;
}).catch(() => communicationError);

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
	let data = new URLSearchParams();
	const stageName = stageRandomButton.checked ? 'random' : stageButtons.find(b => b.checked)!.stage.name;
	data.append('clientToken', clientToken);
	data.append('stage', stageName);
	req.send(data.toString());
	localStorage.setItem('lastStage', stageName);
});
