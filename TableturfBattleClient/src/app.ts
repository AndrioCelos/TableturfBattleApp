/// <reference path="CardDatabase.ts"/>

function delay(ms: number) { return new Promise(resolve => setTimeout(() => resolve(null), ms)); }

// Sections
const sections = new Map<string, HTMLDivElement>();
for (var id of [ 'noJS', 'preGame', 'lobby', 'deck', 'game' ]) {
	let el = document.getElementById(`${id}Section`) as HTMLDivElement;
	if (!el) throw new EvalError(`Element not found: ${id}Section`);
	sections.set(id, el);
}

function showSection(key: string) {
	for (const [key2, el] of sections) {
		el.hidden = key2 != key;
	}
}

function setClientToken(token: string) {
	window.localStorage.setItem('clientToken', token);
	clientToken = token;
}

function onGameStateChange(game: any, playerData: any) {
	if (currentGame == null)
		throw new Error('currentGame is null');
	clearPlayContainers();
	board.resize(game.board);
	board.refresh();
	loadPlayers(game.players);
	redrawModal.hidden = true;
	document.getElementById('gameSection')!.classList.remove('gameEnded');
	switch (game.state) {
		case GameState.WaitingForPlayers:
			showSection('lobby');
			break;
		case GameState.Preparing:
			showSection('deck');
			for (const button of cardButtons.slice(0, 15)) {
				button.inputElement.checked = true;
			}
			submitDeckButton.disabled = false;
			break;
		case GameState.Redraw:
		case GameState.Ongoing:
		case GameState.Ended:
			if (playerData)
				updateHand(playerData.hand);
			board.autoHighlight = false;
			redrawModal.hidden = true;
			showSection('game');

			switch (game.state) {
				case GameState.Redraw:
					redrawModal.hidden = false;
					turnNumberLabel.setTurnNumber(null);
					canPlay = false;
					break;
				case GameState.Ongoing:
					turnNumberLabel.setTurnNumber(game.turnNumber);
					board.autoHighlight = true;
					canPlay = currentGame.me != null && !currentGame.players[currentGame.me.playerIndex].isReady;
					setupControlsForPlay();
					break;
				case GameState.Ended:
					document.getElementById('gameSection')!.classList.add('gameEnded');
					turnNumberLabel.setTurnNumber(null);
					canPlay = false;
					showResult();
					break;
			}
			break;
	}
}

showSection('preGame');

cardDatabase.loadAsync().then(cards => {
	const cardList = document.getElementById('cardList')!;
	for (var card of cards) {
		const button = new CardButton('checkbox', card);
		cardButtons.push(button);
		button.inputElement.addEventListener('input', e => {
			var count = 0;
			for (var el of cardButtons) {
				if (el.inputElement.checked)
					count++;
			}
			document.getElementById('countLabel')!.innerText = count.toString();
			submitDeckButton.disabled = (count != 15);
		});
		cardList.appendChild(button.element);
	}
	document.getElementById('cardListLoadingSection')!.hidden = true;
}).catch(e => document.getElementById('errorModal')!.hidden = false);

function isInternetExplorer() {
	return !!(window.document as any).documentMode;  // This is a non-standard property implemented only by Internet Explorer.
}

if (isInternetExplorer()) {
	alert("You seem to be using an unsupported browser. Some layout or features of this app may not work correctly.");
}
