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

const deckButtons = new CheckButtonGroup<Deck>();

function showDeckList() {
	showPage('deckList');
	deselectDeck();
	deckButtons.deselect();
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
	deckEditorDeckViewSection.hidden = true;
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
		createDeckButton(i, decks[i]);
	}
}

function createDeckButton(index: number, deck: Deck) {
	const buttonElement = document.createElement('button');
	buttonElement.type = 'button';
	const button = new CheckButton(buttonElement);
	deckButtons.add(button, deck);
	buttonElement.addEventListener('click', () => {
		selectedDeck = deckButtons.value;
		selectDeck();
	});
	buttonElement.innerText = deck.name;

	deckList.insertBefore(buttonElement, addDeckControls);
	return button;
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
		createDeckButton(decks.length, deck);
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
	createDeckButton(decks.length, selectedDeck);
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
				if (typeof(deck) != 'object' || !Array.isArray(deck.cards) || deck.cards.length != 15 || deck.cards.find(i => i < 0 || i > cardDatabase.cards!.length))
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
			const card = cardDatabase.cards![cardNumber - 1];
			size += card.size;

			const button = new CardButton(card);
			button.buttonElement.disabled = true;
			deckCardListView.appendChild(button.buttonElement);
		}
	}

	deckEditButton.disabled = selectedDeck.isReadOnly;
	deckRenameButton.disabled = selectedDeck.isReadOnly;
	deckCopyButton.disabled = false;
	deckDeleteButton.disabled = selectedDeck.isReadOnly;
	deckViewSize.innerText = size.toString();
	deckEditorDeckViewSection.hidden = false;
}

function deselectDeck() {
	selectedDeck = null;
	deckEditButton.disabled = true;
	deckRenameButton.disabled = true;
	deckCopyButton.disabled = true;
	deckDeleteButton.disabled = true;
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
		deckNameLabel.innerText = selectedDeck.name;
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

	for (const el of deckButtons.entries) {
		if (el.value == selectedDeck) {
			deckList.removeChild(el.button.buttonElement);
			break;
		}
	}

	const index = decks.indexOf(selectedDeck);
	if (index >= 0) decks.splice(index, 1);
	deckButtons.entries.splice(index, 1);
	deckButtons.deselect();
	selectedDeck = null;
	deckEditorDeckViewSection.hidden = true;
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
		} catch (ex: any) {
			deckImportErrorBox.innerText = ex.message;
			deckImportErrorBox.hidden = false;
		}
		deckImportFileBox.value = '';
		deckImportDialog.close();
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
