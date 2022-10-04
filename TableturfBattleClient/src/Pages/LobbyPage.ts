let cardButtons: CardButton[] = [ ];
let shareLinkButton = document.getElementById('shareLinkButton') as HTMLButtonElement;
let submitDeckButton = document.getElementById('submitDeckButton') as HTMLButtonElement;
let lobbyShareData: ShareData | null;

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
});
