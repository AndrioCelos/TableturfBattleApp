const preGameForm = document.getElementById('preGameForm') as HTMLFormElement;
const newGameButton = document.getElementById('newGameButton')!;
const newGameSetupButton = document.getElementById('newGameSetupButton')!;
const joinGameButton = document.getElementById('joinGameButton')!;
const nameBox = document.getElementById('nameBox') as HTMLInputElement;
const gameIDBox = document.getElementById('gameIDBox') as HTMLInputElement;
const preGameDeckEditorButton = document.getElementById('preGameDeckEditorButton') as HTMLLinkElement;
const preGameLoadingSection = document.getElementById('preGameLoadingSection')!;
const preGameLoadingLabel = document.getElementById('preGameLoadingLabel')!;
const preGameReplayButton = document.getElementById('preGameReplayButton') as HTMLLinkElement;
const preGameSettingsButton = document.getElementById('preGameSettingsButton') as HTMLLinkElement;
const preGameHelpButton = document.getElementById('preGameHelpButton') as HTMLLinkElement;
const helpDialog = document.getElementById('helpDialog') as HTMLDialogElement;
const settingsDialog = document.getElementById('settingsDialog') as HTMLDialogElement;

const gameSetupDialog = document.getElementById('gameSetupDialog') as HTMLDialogElement;
const gameSetupForm = document.getElementById('gameSetupForm') as HTMLFormElement;
const maxPlayersBox = document.getElementById('maxPlayersBox') as HTMLSelectElement;
const turnTimeLimitBox = document.getElementById('turnTimeLimitBox') as HTMLInputElement;
const goalWinCountBox = document.getElementById('goalWinCountBox') as HTMLSelectElement;
const gameSetupAllowUpcomingCardsBox = document.getElementById('gameSetupAllowUpcomingCardsBox') as HTMLInputElement;
const stageSelectionRuleFirstBox = document.getElementById('stageSelectionRuleFirstBox') as HTMLSelectElement;
const stageSelectionRuleAfterWinBox = document.getElementById('stageSelectionRuleAfterWinBox') as HTMLSelectElement;
const stageSelectionRuleAfterDrawBox = document.getElementById('stageSelectionRuleAfterDrawBox') as HTMLSelectElement;
const stageSwitch = document.getElementById('stageSwitch')!;
const stageSwitchButtons: HTMLButtonElement[] = [ ];
const gameSetupForceSameDeckAfterDrawBox = document.getElementById('gameSetupForceSameDeckAfterDrawBox') as HTMLInputElement;
const gameSetupSpectateBox = document.getElementById('gameSetupSpectateBox') as HTMLInputElement;
const gameSetupSubmitButton = document.getElementById('gameSetupSubmitButton') as HTMLButtonElement;

const optionsColourLock = document.getElementById('optionsColourLock') as HTMLInputElement;
const optionsTurnNumberStyle = document.getElementById('optionsTurnNumberStyle') as HTMLSelectElement;
const optionsSpecialWeaponSorting = document.getElementById('optionsSpecialWeaponSorting') as HTMLSelectElement;

let shownMaxPlayersWarning = false;

function setLoadingMessage(message: string | null) {
	if (message)
		preGameLoadingLabel.innerText = message;
	preGameLoadingSection.hidden = message == null;
	for (const input of preGameForm.elements) {
		if (input instanceof HTMLButtonElement || input instanceof HTMLInputElement || input instanceof HTMLSelectElement)
			input.disabled = message != null;
	}
}

function preGameInitStageDatabase(stages: Stage[]) {
	for (let i = 0; i < stages.length; i++) {
		const stage = stages[i];
		const status = userConfig.lastCustomRoomConfig ? userConfig.lastCustomRoomConfig.stageSwitch[i] : 0;

		const button = document.createElement('button');

		const div1 = document.createElement('div');
		div1.className = 'stageName';
		div1.innerText = stage.name;
		button.appendChild(div1);

		const div2 = document.createElement('div');
		div2.className = 'stageStatus';
		div2.innerText = [ 'Allowed', 'Counterpick only', 'Banned' ][status];
		button.appendChild(div2);

		button.type = 'button';
		button.dataset.index = stageSwitchButtons.length.toString();
		button.dataset.status = status.toString();
		stageSwitchButtons.push(button);
		button.addEventListener('click', stageSwitchButton_click);
		stageSwitch.appendChild(button);
	}
}

function stageSwitchButton_click(e: Event) {
	const button = e.currentTarget as HTMLButtonElement;
	let status = button.dataset.status == '0' ? 1 : button.dataset.status == '1' ? 2 : 0;
	button.dataset.status = status.toString();
	(<HTMLElement>button.getElementsByClassName('stageStatus')[0]).innerText = [ 'Allowed', 'Counterpick only', 'Banned' ][status];
	gameSetupSubmitButton.disabled = stageSwitchButtons.every(b => b.dataset.status != '0');
}

maxPlayersBox.addEventListener('change', () => {
	if (!shownMaxPlayersWarning && maxPlayersBox.value != '2') {
		if (confirm('Tableturf Battle is designed for two players and may not be well-balanced for more. Do you want to continue?'))
			shownMaxPlayersWarning = true;
		else
		maxPlayersBox.value = '2';
	}
});

newGameSetupButton.addEventListener('click', _ => {
	gameSetupDialog.showModal();
});

preGameForm.addEventListener('submit', e => {
	e.preventDefault();

	const name = nameBox.value;
	localStorage.setItem('name', name);

	if (e.submitter?.id == 'newGameButton' || (e.submitter?.id == 'preGameImplicitSubmitButton' && !gameIDBox.value)) {
		createRoom(false);
	} else if (e.submitter?.id?.startsWith('spectate')) {
		spectate(false);
	} else {
		tryJoinGame(name, gameIDBox.value, false);
	}
});

gameSetupForm.addEventListener('submit', e => {
	if (e.submitter?.id != 'gameSetupSubmitButton')
		return;
	const name = nameBox.value;
	localStorage.setItem('name', name);
	createRoom(true);
});

function uiParseGameID(s: string, fromInitialLoad: boolean) {
	const gameID = parseGameID(s);
	if (!gameID) {
		alert("Invalid game ID or link");
		if (fromInitialLoad)
			clearPreGameForm(true);
		else {
			gameIDBox.focus();
			gameIDBox.setSelectionRange(0, gameIDBox.value.length);
		}
	}
	return gameID;
}

function createRoom(useOptionsForm: boolean) {
	const name = nameBox.value;
	let request = new XMLHttpRequest();
	request.open('POST', `${config.apiBaseUrl}/games/new`);
	request.addEventListener('load', () => {
		if (request.status == 200) {
			let response = JSON.parse(request.responseText);
			if (!clientToken)
				setClientToken(response.clientToken);

			setGameUrl(response.gameID);

			getGameInfo(response.gameID, 0);
		} else if (request.status == 503)
			communicationError('The server is temporarily locked for an update. Please try again soon.', true, () => setLoadingMessage(null));
		else
			communicationError('Unable to create the room.', true, () => setLoadingMessage(null));
	});
	request.addEventListener('error', () => {
		communicationError('Unable to create the room.', true, () => setLoadingMessage(null));
	});

	let data = new URLSearchParams();
	data.append('name', name);
	data.append('clientToken', clientToken);
	if (useOptionsForm) {
		const settings = <CustomRoomConfig> {
			maxPlayers: parseInt(maxPlayersBox.value),
			turnTimeLimit: turnTimeLimitBox.value ? turnTimeLimitBox.valueAsNumber : null,
			goalWinCount: goalWinCountBox.value ? parseInt(goalWinCountBox.value) : null,
			allowUpcomingCards: gameSetupAllowUpcomingCardsBox.checked,
			stageSelectionMethodFirst: StageSelectionMethod[stageSelectionRuleFirstBox.value as keyof typeof StageSelectionMethod],
			stageSelectionMethodAfterWin: stageSelectionRuleAfterWinBox.value == 'Inherit' ? null : StageSelectionMethod[stageSelectionRuleAfterWinBox.value as keyof typeof StageSelectionMethod],
			stageSelectionMethodAfterDraw: stageSelectionRuleAfterDrawBox.value == 'Inherit' ? null : StageSelectionMethod[stageSelectionRuleAfterDrawBox.value as keyof typeof StageSelectionMethod],
			forceSameDecksAfterDraw: gameSetupForceSameDeckAfterDrawBox.checked,
			stageSwitch: stageSwitchButtons.map(b => parseInt(b.dataset.status!)),
			spectate: gameSetupSpectateBox.checked
		};
		userConfig.lastCustomRoomConfig = settings;
		saveSettings();

		data.append('maxPlayers', maxPlayersBox.value);
		if (turnTimeLimitBox.value)
			data.append('turnTimeLimit', turnTimeLimitBox.value);
		if (goalWinCountBox.value)
			data.append('goalWinCount', goalWinCountBox.value);
		data.append('allowUpcomingCards', settings.allowUpcomingCards.toString());

		const stageSelectionRuleFirst = {
			method: settings.stageSelectionMethodFirst,
			bannedStages: settings.stageSwitch.map((_, i) => i).filter(i => i != 0)
		};
		const stageSelectionRuleAfterWin = {
			method: settings.stageSelectionMethodAfterWin ?? settings.stageSelectionMethodFirst,
			bannedStages: settings.stageSwitch.map((_, i) => i).filter(i => i == 2)
		};
		const stageSelectionRuleAfterDraw = {
			method: settings.stageSelectionMethodAfterDraw ?? settings.stageSelectionMethodFirst,
			bannedStages: settings.stageSwitch.map((_, i) => i).filter(i => i == 2)
		};

		data.append('stageSelectionRuleFirst', JSON.stringify(stageSelectionRuleFirst));
		data.append('stageSelectionRuleAfterWin', JSON.stringify(stageSelectionRuleAfterWin));
		data.append('stageSelectionRuleAfterDraw', JSON.stringify(stageSelectionRuleAfterDraw));
		data.append('forceSameDeckAfterDraw', settings.forceSameDecksAfterDraw.toString());
		data.append('spectate', settings.forceSameDecksAfterDraw.toString());
	}
	request.send(data.toString());
	setLoadingMessage('Creating a room...');
}

function spectate(fromInitialLoad: boolean) {
	const gameID = uiParseGameID(gameIDBox.value, fromInitialLoad);
	if (!gameID) return;
	setGameUrl(gameID);
	getGameInfo(gameID, null);
}

function tryJoinGame(name: string, idOrUrl: string, fromInitialLoad: boolean) {
	const gameID = uiParseGameID(idOrUrl, fromInitialLoad);
	if (!gameID) return;

	setGameUrl(gameID);

	let request = new XMLHttpRequest();
	request.open('POST', `${config.apiBaseUrl}/games/${gameID}/join`);
	request.addEventListener('load', () => {
		if (request.status == 200) {
			let response = JSON.parse(request.responseText);
			if (!clientToken)
				setClientToken(response.clientToken);
			getGameInfo(gameID, response.playerIndex);
		} else {
			if (request.status == 404)
				joinGameError('The room was not found.', fromInitialLoad);
			else if (request.status == 409)
				joinGameError('The game is full.', fromInitialLoad);
			else if (request.status == 410)
				joinGameError('The game has already started.', fromInitialLoad);
			else
				joinGameError('Unable to join the room.', fromInitialLoad);
		}
	});
	request.addEventListener('error', () => {
		joinGameError('Unable to join the room.', fromInitialLoad);
	});
	request.send(new URLSearchParams({ name, clientToken }).toString());
	setLoadingMessage('Joining the game...');
}

function joinGameError(message: string, fromInitialLoad: boolean) {
	communicationError(message, true, () => {
		clearUrlFromGame();
		setLoadingMessage(null);
		if (fromInitialLoad)
			clearPreGameForm(true);
		else {
			gameIDBox.focus();
			gameIDBox.setSelectionRange(0, gameIDBox.value.length);
		}
	});
}

function getGameInfo(gameID: string, myPlayerIndex: number | null) {
	board.playerIndex = myPlayerIndex;
	initLobbyPage(window.location.toString());

	showDeckButtons.splice(0);
	clearShowDeck();
	setupWebSocket(gameID);
}

function backPreGameForm(updateUrl: boolean) {
	document.getElementById('preGameDefaultSection')!.hidden = false;
	document.getElementById('preGameJoinSection')!.hidden = true;

	if (updateUrl) {
		clearUrlFromGame();
	}
}
function clearPreGameForm(updateUrl: boolean) {
	backPreGameForm(updateUrl);
	currentGame = null;
	gameIDBox.value = '';
}

document.getElementById('preGameBackButton')!.addEventListener('click', e => {
	e.preventDefault();
	backPreGameForm(true);
})

preGameDeckEditorButton.addEventListener('touchstart', deckListEnableTouchMode);

preGameDeckEditorButton.addEventListener('click', e => {
	e.preventDefault();
	showDeckList();
	setUrl('deckeditor');
});

preGameSettingsButton.addEventListener('click', e => {
	e.preventDefault();
	optionsTurnNumberStyle.value = turnNumberLabel.absoluteMode ? 'absolute' : 'remaining';
	optionsSpecialWeaponSorting.value = SpecialWeaponSorting[userConfig.specialWeaponSorting];
	settingsDialog.showModal();
});

preGameHelpButton.addEventListener('click', e => {
	e.preventDefault();
	helpDialog.showModal();
	setUrl('help');
});

helpDialog.addEventListener('close', () => {
	if (canPushState) {
		try {
			history.pushState(null, '', '.');
		} catch {
			canPushState = false;
		}
	}
	if (location.hash)
		location.hash = '';
});

preGameReplayButton.addEventListener('click', e => {
	e.preventDefault();

	const s = prompt('Enter a replay link or code.');
	if (!s) return;
	const m = /(?:^|replay\/)([A-Za-z0-9+/=\-_]+)$/i.exec(s);
	if (!m) {
		alert('Not a valid replay code');
		return;
	}

	new ReplayLoader(m[1]).loadReplay();
});

optionsColourLock.addEventListener('change', () => {
	userConfig.colourLock = optionsColourLock.checked;
	saveSettings();
	if (userConfig.colourLock) {
		for (let i = 1; i <= 4; i++) {
			document.body.style.removeProperty(`--primary-colour-${i}`);
			document.body.style.removeProperty(`--special-colour-${i}`);
			document.body.style.removeProperty(`--special-accent-colour-${i}`);
			uiBaseColourIsSpecialColourOutOfGame = true;
			gamePage.dataset.uiBaseColourIsSpecialColour = 'true';
		}
	}
})

optionsTurnNumberStyle.addEventListener('change', () => turnNumberLabel.absoluteMode = optionsTurnNumberStyle.value == 'absolute');
optionsSpecialWeaponSorting.addEventListener('change', () => {
	userConfig.specialWeaponSorting = SpecialWeaponSorting[optionsSpecialWeaponSorting.value as keyof typeof SpecialWeaponSorting];
	saveSettings();
});

let playerName = localStorage.getItem('name');
(document.getElementById('nameBox') as HTMLInputElement).value = playerName || '';

let settingUrl = false;
window.addEventListener('popstate', () => {
	if (!settingUrl)
		processUrl();
});

// Initialise the settings dialog.
{
	optionsColourLock.checked = userConfig.colourLock;
}

// Initialise the room settings dialog.
{
	if (userConfig.lastCustomRoomConfig) {
		maxPlayersBox.value = userConfig.lastCustomRoomConfig.maxPlayers.toString();
		turnTimeLimitBox.value = userConfig.lastCustomRoomConfig.turnTimeLimit?.toString() ?? '';
		goalWinCountBox.value = userConfig.lastCustomRoomConfig.goalWinCount?.toString() ?? '';
		gameSetupAllowUpcomingCardsBox.checked = userConfig.lastCustomRoomConfig.allowUpcomingCards ?? true;
		stageSelectionRuleFirstBox.value = StageSelectionMethod[userConfig.lastCustomRoomConfig.stageSelectionMethodFirst]
		stageSelectionRuleAfterWinBox.value = userConfig.lastCustomRoomConfig.stageSelectionMethodAfterWin != null ? StageSelectionMethod[userConfig.lastCustomRoomConfig.stageSelectionMethodAfterWin] : 'Inherit';
		stageSelectionRuleAfterDrawBox.value = userConfig.lastCustomRoomConfig.stageSelectionMethodAfterDraw != null ? StageSelectionMethod[userConfig.lastCustomRoomConfig.stageSelectionMethodAfterDraw] : 'Inherit';
		gameSetupForceSameDeckAfterDrawBox.checked = userConfig.lastCustomRoomConfig.forceSameDecksAfterDraw;
	}
}

if (!canPushState)
	preGameDeckEditorButton.href = '#deckeditor';
setLoadingMessage('Loading game data...');
