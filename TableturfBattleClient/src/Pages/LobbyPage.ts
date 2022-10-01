let cardButtons: CardButton[] = [ ];
let submitDeckButton = document.getElementById('submitDeckButton') as HTMLButtonElement;

function clearReady() {
	if (currentGame == null) return;
	for (var i = 0; i < currentGame.players.length; i++) {
		const player = currentGame.players[i];
		if (player != null) {
			player.isReady = false;
			updatePlayerListItem(i);
		}
	}
}

function updatePlayerListItem(playerIndex: number) {
	const player = currentGame != null ? currentGame.players[playerIndex] : null;
	const listItem = playerListItems[playerIndex];
	if (player != null) {
		listItem.innerText = player.name;
		if (player)
			listItem.innerText += ' (Ready)';
	} else
		listItem.innerText = "Waiting...";
}

submitDeckButton.addEventListener('click', e => {
	let req = new XMLHttpRequest();
	req.open('POST', `http://localhost:3333/api/games/${currentGame!.id}/chooseDeck`);
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
