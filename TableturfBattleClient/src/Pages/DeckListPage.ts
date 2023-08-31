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

const deckButtons = new CheckButtonGroup<Deck>(deckList);

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
});

function saveDecks() {
	const json = JSON.stringify(decks.filter(d => !d.isReadOnly), [ 'name', 'cards' ]);
	localStorage.setItem('decks', json);
}

{
	const decksString = localStorage.getItem('decks');
	if (decksString) {
		for (const deck of JSON.parse(decksString)) {
			decks.push(new Deck(deck.name, deck.cards, false));
		}
	} else {
		const lastDeckString = localStorage.getItem('lastDeck');
		const lastDeck = lastDeckString?.split(/\+/)?.map(s => parseInt(s));
		if (lastDeck && lastDeck.length == 15) {
			decks.push(new Deck('Custom Deck', lastDeck, false));
			saveDecks();
		}
		localStorage.removeItem('lastDeck');
	}

	for (let i = 0; i < decks.length; i++) {
		createDeckButton(decks[i]);
	}
}

function createDeckButton(deck: Deck) {
	const buttonElement = document.createElement('button');
	buttonElement.type = 'button';
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
		e.dataTransfer.setData('text/plain', JSON.stringify(deck, [ 'name', 'cards' ]));
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
	const indexString = e.dataTransfer.getData('application/tableturf-deck-index');
	if (indexString != '' && draggingDeckButton != null) {
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
	} else if (e.dataTransfer.getData('text/plain'))
		e.dataTransfer.dropEffect = 'copy';
}

function deckButton_drop(e: DragEvent) {
	e.preventDefault();
	if (e.dataTransfer == null) return;
	const indexString = e.dataTransfer.getData('application/tableturf-deck-index');
	if (indexString) {
		const index = parseInt(indexString);
		let newIndex = 0;
		for (let el = deckList.firstElementChild; el != null; el = el.nextElementSibling) {
			if (el == draggingDeckButton) break;
			newIndex++;
		}
		if (newIndex == index) return;
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
		const data = JSON.parse(text);
		const decks = (data instanceof Array ? data : [ data ]) as Deck[];
		importDecks(decks);
	}
}

function importDecks(decksToImport: (Deck | number[])[]) {
	let newSelectedDeck: Deck | null = null;
	for (const el of decksToImport) {
		let deck;
		if (el instanceof Array)
			deck = new Deck(`Imported Deck ${decks.length + 1}`, el, false);
		else {
			deck = el;
			if (!deck.name) deck.name = `Imported Deck ${decks.length + 1}`;
		}
		createDeckButton(deck);
		decks.push(deck);
		newSelectedDeck ??= deck;
	}
	if (newSelectedDeck) {
		selectedDeck = newSelectedDeck;
		deckButtons.deselect();
		deckButtons.entries.find(e => e.value == newSelectedDeck)!.button.checked = true;
		selectDeck();
		saveDecks();
	}
}

newDeckButton.addEventListener('click', () => {
	selectedDeck = new Deck(`Deck ${decks.length + 1}`, [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ], false);
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
			const data = JSON.parse(deckImportTextBox.value);
			const decks = (data instanceof Array ? data : [ data ]) as Deck[];
			for (const deck of decks) {
				if (typeof(deck) != 'object' || !Array.isArray(deck.cards) || deck.cards.length != 15 || deck.cards.find(i => !cardDatabase.isValidCardNumber(i)))
					throw new SyntaxError('Invalid JSON deck');
			}
			importDecks(decks);
		} catch (ex: any) {
			e.preventDefault();
			deckImportErrorBox.innerText = ex.message;
			deckImportErrorBox.hidden = false;
			deckImportTextBox.focus();
		}
	}
});

deckEditButton.addEventListener('click', editDeck);

deckListTestButton.addEventListener('click', _ => {
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
	deckEditButton.disabled = selectedDeck.isReadOnly;
	deckRenameButton.disabled = selectedDeck.isReadOnly;
	deckDeleteButton.disabled = selectedDeck.isReadOnly;
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
	deckEditButton.disabled = true;
	deckRenameButton.disabled = true;
	deckDeleteButton.disabled = true;
	deckListPage.classList.remove('showingDeck');
}

deckExportButton.addEventListener('click', () => {
	if (selectedDeck == null) return;
	const json = JSON.stringify(selectedDeck, [ 'name', 'cards' ]);
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
	importDecks([ new Deck(`${selectedDeck.name} - Copy`, Array.from(selectedDeck.cards), false) ]);
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
			importDecks(bitmaps.map(getCardListFromImageBitmap));
			deckImportDialog.close();
		} catch (ex: any) {
			deckImportErrorBox.innerText = ex.message;
			deckImportErrorBox.hidden = false;
		}
		deckImportFileBox.value = '';
	}
});

deckExportAllButton.addEventListener('click', () => {
	const json = JSON.stringify(decks.filter(d => !d.isReadOnly), [ 'name', 'cards' ]);
	deckExportTextBox.value = json;
	deckExportCopyButton.innerText = 'Copy';
	deckExportDialog.showModal();
});

if (!canPushState)
	deckListBackButton.href = '#';
