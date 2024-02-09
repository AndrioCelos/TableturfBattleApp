const deckListPage = document.getElementById('deckListPage')!;
const deckListBackButton = document.getElementById('deckListBackButton') as HTMLLinkElement;
const deckViewBackButton = document.getElementById('deckViewBackButton') as HTMLLinkElement;
const deckEditorDeckViewSection = document.getElementById('deckEditorDeckViewSection')!;
const deckNameLabel = document.getElementById('deckName')!;
const deckViewSize = document.getElementById('deckViewSize')!;
const deckList = document.getElementById('deckList')!;
const deckCardListView = document.getElementById('deckCardListView')!;
const addDeckControls = document.getElementById('addDeckControls')!;
const newDeckButton = document.getElementById('newDeckButton') as HTMLButtonElement;
const importDeckButton = document.getElementById('importDeckButton') as HTMLButtonElement;

const deckViewMenu = document.getElementById('deckViewMenu')!;
const deckViewMenuButton = document.getElementById('deckViewMenuButton') as HTMLButtonElement;
const deckSleevesButton = document.getElementById('deckSleevesButton') as HTMLButtonElement;
const deckEditButton = document.getElementById('deckEditButton') as HTMLButtonElement;
const deckListTestButton = document.getElementById('deckListTestButton') as HTMLButtonElement;
const deckExportButton = document.getElementById('deckExportButton') as HTMLButtonElement;
const deckRenameButton = document.getElementById('deckRenameButton') as HTMLButtonElement;
const deckCopyButton = document.getElementById('deckCopyButton') as HTMLButtonElement;
const deckDeleteButton = document.getElementById('deckDeleteButton') as HTMLButtonElement;

const deckExportDialog = document.getElementById('deckExportDialog') as HTMLDialogElement;
const deckExportCopyButton = document.getElementById('deckExportCopyButton') as HTMLButtonElement;
const deckExportTextBox = document.getElementById('deckExportTextBox') as HTMLTextAreaElement;

const deckExportAllButton = document.getElementById('deckExportAllButton') as HTMLButtonElement;

const deckSleevesDialog = document.getElementById('deckSleevesDialog') as HTMLDialogElement;
const deckSleevesForm = document.getElementById('deckSleevesForm') as HTMLFormElement;
const deckSleevesButtons = deckSleevesForm.getElementsByTagName('input');
const deckSleevesOkButton = document.getElementById('deckSleevesOkButton') as HTMLButtonElement;

const deckImportDialog = document.getElementById('deckImportDialog') as HTMLDialogElement;
const deckImportForm = document.getElementById('deckImportForm') as HTMLFormElement;
const deckImportTextBox = document.getElementById('deckImportTextBox') as HTMLTextAreaElement;
const deckImportTextButton = document.getElementById('deckImportTextButton') as HTMLInputElement;
const deckImportTextSection = document.getElementById('deckImportTextSection')!;
const deckImportScreenshotButton = document.getElementById('deckImportScreenshotButton') as HTMLInputElement;
const deckImportScreenshotSection = document.getElementById('deckImportScreenshotSection')!;
const deckImportScreenshotInstructionsButton = document.getElementById('deckImportScreenshotInstructionsButton') as HTMLButtonElement;
const deckImportScreenshotInstructionsButtonPC = document.getElementById('deckImportScreenshotInstructionsButtonPC') as HTMLInputElement;
const deckImportScreenshotInstructionsButtonMobile = document.getElementById('deckImportScreenshotInstructionsButtonMobile') as HTMLInputElement;
const deckImportScreenshotInstructions = document.getElementById('deckImportScreenshotInstructions')!;
const deckImportScreenshotInstructionsPC = document.getElementById('deckImportScreenshotInstructionsPC')!;
const deckImportScreenshotInstructionsMobile = document.getElementById('deckImportScreenshotInstructionsMobile')!;
const deckImportFileBox = document.getElementById('deckImportFileBox') as HTMLInputElement;
const deckImportErrorBox = document.getElementById('deckImportErrorBox')!;
const deckImportOkButton = document.getElementById('deckImportOkButton') as HTMLButtonElement;

const deckButtons = new CheckButtonGroup<SavedDeck>(deckList);

let deckListTouchMode = false;
let draggingDeckButton: Element | null = null;

function showDeckList() {
	showPage('deckList');
	deselectDeck();
	deckButtons.deselect();
}

deckList.addEventListener('touchstart', deckListEnableTouchMode);

function deckListEnableTouchMode() {
	if (deckListTouchMode) return;
	deckListTouchMode = true;
	deckListPage.classList.add('touchmode');
	for (var b of deckButtons.buttons) {
		b.buttonElement.draggable = false;
		(b.buttonElement.getElementsByClassName('handle')[0] as HTMLElement).draggable = true;
	}
}

deckListBackButton.addEventListener('click', e => {
	e.preventDefault();
	showPage('preGame');

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

deckViewBackButton.addEventListener('click', e => {
	e.preventDefault();
	clearChildren(deckCardListView);
	deselectDeck();
	deckListPage.classList.remove('showingDeck');
	deckViewMenu.classList.remove('showing');
});

function saveDecks() {
	const json = JSON.stringify(decks.filter(d => !d.isReadOnly), [ 'name', 'cards', 'sleeves', 'upgrades' ]);
	localStorage.setItem('decks', json);
}

{
	const decksString = localStorage.getItem('decks');
	if (decksString) {
		for (const deck of JSON.parse(decksString)) {
			decks.push(SavedDeck.fromJson(deck));
		}
	} else {
		const lastDeckString = localStorage.getItem('lastDeck');
		const lastDeck = lastDeckString?.split(/\+/)?.map(s => parseInt(s));
		if (lastDeck && lastDeck.length == 15) {
			decks.push(new SavedDeck('Custom Deck', 0, lastDeck, new Array(15).fill(1), false));
			saveDecks();
		}
		localStorage.removeItem('lastDeck');
	}

	for (let i = 0; i < decks.length; i++) {
		createDeckButton(decks[i]);
	}
}

function createDeckButton(deck: SavedDeck) {
	const buttonElement = document.createElement('button');
	buttonElement.className = 'deckButton';
	buttonElement.type = 'button';
	buttonElement.dataset.sleeves = deck.sleeves.toString();
	const button = new CheckButton(buttonElement);
	deckButtons.add(button, deck);
	buttonElement.addEventListener('click', () => {
		selectedDeck = deckButtons.value;
		selectDeck();
	});
	buttonElement.addEventListener('dragstart', e => {
		if (e.dataTransfer == null) return;
		const index = decks.indexOf(deck);
		draggingDeckButton = buttonElement;
		e.dataTransfer.effectAllowed = 'copyMove';
		e.dataTransfer.setData('text/plain', serialiseDecks([ deck ]));
		e.dataTransfer.setData('application/tableturf-deck-index', index.toString());
		buttonElement.classList.add('dragging');
	});
	buttonElement.addEventListener('dragend', e => {
		buttonElement.classList.remove('dragging');
		if (draggingDeckButton != null && e.currentTarget == draggingDeckButton) {
			const index = deckButtons.entries.findIndex(el => el.button.buttonElement == e.currentTarget) + 1;
			deckList.insertBefore(draggingDeckButton, index >= deckButtons.entries.length ? null : deckButtons.entries[index].button.buttonElement);
			draggingDeckButton = null;
		}
	});
	buttonElement.addEventListener('dragenter', e => e.preventDefault());
	buttonElement.addEventListener('dragover', deckButton_dragover);
	buttonElement.addEventListener('drop', deckButton_drop);

	const handle = document.createElement('div');
	handle.className = 'handle';
	buttonElement.appendChild(handle);
	buttonElement.appendChild(document.createTextNode(deck.name));
	(deckListTouchMode ? handle : buttonElement).draggable = true;

	return button;
}

function deckButton_dragover(e: DragEvent) {
	e.preventDefault();
	if (e.dataTransfer == null) return;
	if (draggingDeckButton != null) {
		e.dataTransfer.dropEffect = 'move';
		if (e.currentTarget != draggingDeckButton && e.currentTarget != deckList) {
			// Move the deck being dragged into the new position as a preview.
			for (let el = draggingDeckButton.nextElementSibling; el != null; el = el.nextElementSibling) {
				if (el == e.currentTarget) {
					deckList.insertBefore(draggingDeckButton, el.nextElementSibling);
					return;
				}
			}
			deckList.insertBefore(draggingDeckButton, e.currentTarget as Node);
		}
	} else if (e.dataTransfer.types.includes('text/plain'))
		e.dataTransfer.dropEffect = 'copy';
}

function deckButton_drop(e: DragEvent) {
	e.preventDefault();
	if (e.dataTransfer == null) return;
	if (draggingDeckButton != null) {
		const index = deckButtons.entries.findIndex(el => el.button.buttonElement == draggingDeckButton);
		let newIndex = 0;
		for (let el = deckList.firstElementChild; el != null; el = el.nextElementSibling) {
			if (el == draggingDeckButton) break;
			newIndex++;
		}
		if (index < 0 || newIndex == index) return;
		console.log(`Moving deck ${index} to ${newIndex}.`);

		deckButtons.move(index, newIndex);
		const deck = decks[index];
		decks.splice(index, 1);
		decks.splice(newIndex, 0, deck);
		saveDecks();
		draggingDeckButton = null;
		return;
	}
	const text = e.dataTransfer.getData('text/plain');
	if (text) {
		try {
			importDecks(parseDecksForImport(text));
		} catch (ex: any) {
			alert(`Couldn't import dropped deck data: ${ex}`);
		}
	}
}

function importDecks(decksToImport: DeckFullExport) {
	let newSelectedDeck: SavedDeck | null = null;

	// Merge custom cards.
	const customCardNumbers: {[key: number]: number} = { };
	if (decksToImport.customCards) {
		console.log('Merging custom cards...');
		for (const key in decksToImport.customCards) {
			const incomingCard = Card.fromJson(decksToImport.customCards[key]);
			const existingCard = cardDatabase.customCards.find(c => c.isTheSameAs(incomingCard));
			if (existingCard) {
				console.log(`Incoming card (${key}) ${incomingCard.name} matches existing (${existingCard.number}).`);
				customCardNumbers[key] = existingCard.number;
			} else {
				const newNumber = CUSTOM_CARD_START - cardDatabase.customCards.length;
				console.log(`Adding incoming card (${key}) ${incomingCard.name} as (${newNumber}).`);
				incomingCard.number = newNumber;
				cardDatabase.customCards.push(incomingCard);
				addCardToGallery(incomingCard);
				cardDatabase.customCardsModified = true;
				customCardNumbers[key] = incomingCard.number;
			}
		}
		console.log('Done merging custom cards.');
		saveCustomCards();
	}

	// Import decks.
	for (const el of decksToImport.decks) {
		let deck;
		if (Array.isArray(el))
			deck = new SavedDeck(`Imported Deck ${decks.length + 1}`, 0, el, new Array(15).fill(1), false);
		else {
			deck = el;
			deck.sleeves ??= 0;
			deck.upgrades ??= new Array(15).fill(1);
			deck.isReadOnly = false;
			if (!deck.name) deck.name = `Imported Deck ${decks.length + 1}`;
		}
		for (let i = 0; i < deck.cards.length; i++) {
			if (deck.cards[i] <= CUSTOM_CARD_START)
				deck.cards[i] = customCardNumbers[deck.cards[i]];
		}
		createDeckButton(deck);
		decks.push(deck);
		newSelectedDeck ??= deck;
	}
	if (newSelectedDeck) {
		selectedDeck = newSelectedDeck;
		deckButtons.deselect();
		deckButtons.entries.find(e => e.value == newSelectedDeck)!.button.checked = true;
		deckButtons.value = newSelectedDeck;
		selectDeck();
		saveDecks();
	}
}

newDeckButton.addEventListener('click', () => {
	selectedDeck = new SavedDeck(`Deck ${decks.length + 1}`, 0, new Array(15).fill(0), new Array(15).fill(1), false);
	createDeckButton(selectedDeck);
	decks.push(selectedDeck);
	editDeck();
});
importDeckButton.addEventListener('click', () => {
	deckImportErrorBox.hidden = true;
	deckImportTextSection.hidden = true;
	deckImportScreenshotSection.hidden = true;
	deckImportScreenshotInstructions.hidden = true;
	deckImportScreenshotInstructionsPC.hidden = true;
	deckImportScreenshotInstructionsMobile.hidden = true;
	deckImportTextButton.checked = false;
	deckImportScreenshotButton.checked = false;
	deckImportScreenshotInstructionsButtonPC.checked = false;
	deckImportScreenshotInstructionsButtonMobile.checked = false;
	deckImportScreenshotInstructionsButton.innerText = 'Show instructions';
	deckImportDialog.showModal();
});
deckImportForm.addEventListener('submit', e => {
	if (e.submitter == deckImportOkButton) {
		try {
			importDecks(parseDecksForImport(deckImportTextBox.value));
		} catch (ex: any) {
			e.preventDefault();
			deckImportErrorBox.innerText = ex.message;
			deckImportErrorBox.hidden = false;
			deckImportTextBox.focus();
		}
	}
});

function parseDecksForImport(s: string) : DeckFullExport {
	let isKoishiShareUrl = false;
	const pos = s.indexOf('deck=');
	if (pos >= 0) {
		isKoishiShareUrl = true;
		s = decodeURIComponent(s.substring(pos + 5));
	}
	const data = JSON.parse(s);
	if (Array.isArray(data)) {
		if (data.length > 0 && typeof(data[0]) == 'number') {
			if (data.length > 15 || data.find(i => typeof(i) != 'number' || !cardDatabase.isValidCardNumber(isKoishiShareUrl ? i : i + 1)))
				throw new SyntaxError('Invalid deck data');
			if (isKoishiShareUrl)
				return { decks: [ data ] };  // tableturf.koishi.top share URL
			else
				return { decks: [ data.map(n => n + 1) ] };  // Tooltip export data
		} else {
			for (const deck of data) {
				if (typeof(deck) != 'object' || !Array.isArray(deck.cards) || deck.cards.length > 15 || (deck.cards as any[]).find((i => typeof(i) != 'number' || !cardDatabase.isValidCardNumber(i))))
					throw new SyntaxError('Invalid JSON deck');
			}
			return { decks: data.map(SavedDeck.fromJson) };  // Our export data without custom cards
		}
	} else if (typeof(data) == 'object') {
		if ('decks' in data) {
			// Our export data with custom cards
			const fullExport = data as DeckFullExport;
			fullExport.decks = fullExport.decks.map(SavedDeck.fromJson);
			return fullExport;
		} else {
			// Our old export data
			if (!Array.isArray(data.cards) || data.cards.length > 15 || (data.cards as any[]).find((i => typeof(i) != 'number' || !cardDatabase.isValidOfficialCardNumber(i))))
				throw new SyntaxError('Invalid JSON deck');
			return { decks: [ SavedDeck.fromJson(data) ] };
		}
	} else
		throw new SyntaxError('Invalid JSON deck');
}

deckViewMenuButton.addEventListener('click', () => {
	deckViewMenu.classList.toggle('showing');
});

deckViewMenu.addEventListener('click', () => {
	deckViewMenu.classList.remove('showing');
});

deckSleevesButton.addEventListener('click', () => {
	if (selectedDeck == null) return;
	deckSleevesButtons[selectedDeck.sleeves].checked = true;
	deckSleevesDialog.showModal();
});
deckSleevesForm.addEventListener('submit', e => {
	if (e.submitter == deckSleevesOkButton && selectedDeck != null) {
		let i = 0;
		for (const button of deckSleevesButtons) {
			if (button.checked) {
				selectedDeck.sleeves = i;
				deckButtons.entries[decks.indexOf(selectedDeck)].button.buttonElement.dataset.sleeves = i.toString();
				saveDecks();
				return;
			}
			i++;
		}
	}
});

deckEditButton.addEventListener('click', editDeck);

deckListTestButton.addEventListener('click', () => {
	testStageButtons.deselect();
	testStageSelectionDialog.showModal();
});

function selectDeck() {
	clearChildren(deckCardListView);
	if (selectedDeck == null) return;

	let size = 0;

	deckNameLabel.innerText = selectedDeck.name;
	for (const cardNumber of selectedDeck.cards) {
		if (cardNumber) {
			const card = cardDatabase.get(cardNumber);
			size += card.size;

			const button = new CardButton(card);
			button.buttonElement.disabled = true;
			deckCardListView.appendChild(button.buttonElement);
		}
	}

	deckListTestButton.disabled = false;
	deckExportButton.disabled = false;
	deckCopyButton.disabled = false;
	deckSleevesButton.disabled = selectedDeck.isReadOnly ?? false;
	deckEditButton.disabled = selectedDeck.isReadOnly ?? false;
	deckRenameButton.disabled = selectedDeck.isReadOnly ?? false;
	deckDeleteButton.disabled = selectedDeck.isReadOnly ?? false;
	deckViewSize.innerText = size.toString();
	deckListPage.classList.add('showingDeck');
}

function deselectDeck() {
	selectedDeck = null;
	deckButtons.deselect();
	clearChildren(deckCardListView);
	deckNameLabel.innerText = '\u00a0';
	deckViewSize.innerText = '0';
	deckListTestButton.disabled = true;
	deckExportButton.disabled = true;
	deckCopyButton.disabled = true;
	deckSleevesButton.disabled = true;
	deckEditButton.disabled = true;
	deckRenameButton.disabled = true;
	deckDeleteButton.disabled = true;
	deckListPage.classList.remove('showingDeck');
}

function deckExportJsonReplacer(key: string, value: any) {
	switch (key) {
		case 'isReadOnly':
		case 'number':
		case 'altNumber':
		case 'artFileName':
		case 'imageUrl':
		case 'specialCost':
		case 'size':
		case 'textScale':
		case 'isVariantOf':
		case 'minX':
		case 'minY':
		case 'maxX':
		case 'maxY':
			return undefined;
		case 'line1':
		case 'line2':
			return value ?? undefined;  // Omit null values.
		default:
			return value;
	}
}

function serialiseDecks(decks: SavedDeck[]) {
	let customCards: {[key: number]: Card} | null = null;
	for (const deck of decks) {
		for (const number of deck.cards) {
			if (number <= CUSTOM_CARD_START) {
				customCards ??= { };
				customCards[number] = cardDatabase.customCards[CUSTOM_CARD_START - number];
			}
		}
	}
	return JSON.stringify(customCards != null ? { decks, customCards } : decks, deckExportJsonReplacer);
}

deckExportButton.addEventListener('click', () => {
	if (selectedDeck == null) return;
	const json = serialiseDecks([ selectedDeck ]);
	deckExportTextBox.value = json;
	deckExportCopyButton.innerText = 'Copy';
	deckExportDialog.showModal();
});
deckExportCopyButton.addEventListener('click', () => {
	navigator.clipboard.writeText(deckExportTextBox.value);
	deckExportCopyButton.innerText = 'Copied';
});

deckRenameButton.addEventListener('click', () => {
	if (selectedDeck == null) return;
	const name = prompt(`What will you rename ${selectedDeck.name} to?`, selectedDeck.name)?.trim();
	if (name) {
		selectedDeck.name = name;
		deckNameLabel.innerText = name;
		deckButtons.entries[decks.indexOf(selectedDeck)].button.buttonElement.lastChild!.nodeValue = name;
		saveDecks();
	}
});

deckCopyButton.addEventListener('click', () => {
	if (selectedDeck == null) return;
	importDecks({ decks: [ new SavedDeck(`${selectedDeck.name} - Copy`, selectedDeck.sleeves, Array.from(selectedDeck.cards), Array.from(selectedDeck.upgrades), false) ] });
});

deckDeleteButton.addEventListener('click', () => {
	if (selectedDeck == null) return;
	if (!confirm(`Are you sure you want to delete ${selectedDeck.name}?`)) return;

	const index = decks.indexOf(selectedDeck);
	if (index >= 0) decks.splice(index, 1);
	deckButtons.removeAt(index);
	deselectDeck();
	saveDecks();
});

deckImportTextButton.addEventListener('input', () => {
	deckImportTextSection.hidden = false;
	deckImportScreenshotSection.hidden = true;
});
deckImportScreenshotButton.addEventListener('input', () => {
	deckImportTextSection.hidden = true;
	deckImportScreenshotSection.hidden = false;
});

deckImportScreenshotInstructionsButton.addEventListener('click', () => {
	if (deckImportScreenshotInstructions.hidden) {
		deckImportScreenshotInstructions.hidden = false;
		deckImportScreenshotInstructionsButton.innerText = 'Hide instructions';
	} else {
		deckImportScreenshotInstructions.hidden = true;
		deckImportScreenshotInstructionsButton.innerText = 'Show instructions';
	}
});
deckImportScreenshotInstructionsButtonPC.addEventListener('input', () => {
	deckImportScreenshotInstructionsPC.hidden = false;
	deckImportScreenshotInstructionsMobile.hidden = true;
});
deckImportScreenshotInstructionsButtonMobile.addEventListener('input', () => {
	deckImportScreenshotInstructionsPC.hidden = true;
	deckImportScreenshotInstructionsMobile.hidden = false;
});

deckImportFileBox.addEventListener('change', async () => {
	if (deckImportFileBox.files && deckImportFileBox.files.length > 0) {
		try {
			const bitmaps = await Promise.all(Array.from(deckImportFileBox.files, f => createImageBitmap(f)));
			importDecks({ decks: bitmaps.map(getCardListFromImageBitmap) });
			deckImportDialog.close();
		} catch (ex: any) {
			deckImportErrorBox.innerText = ex.message;
			deckImportErrorBox.hidden = false;
		}
		deckImportFileBox.value = '';
	}
});

deckExportAllButton.addEventListener('click', () => {
	const json = serialiseDecks(decks.filter(d => !d.isReadOnly));
	deckExportTextBox.value = json;
	deckExportCopyButton.innerText = 'Copy';
	deckExportDialog.showModal();
});

if (!canPushState)
	deckListBackButton.href = '#';
