const deckListBackButton = document.getElementById('deckListBackButton') as HTMLLinkElement;
const deckEditorDeckViewSection = document.getElementById('deckEditorDeckViewSection')!;
const deckNameLabel = document.getElementById('deckName')!;
const deckViewSize = document.getElementById('deckViewSize')!;
const deckList = document.getElementById('deckList')!;
const deckCardListView = document.getElementById('deckCardListView')!;
const newDeckButton = document.getElementById('newDeckButton') as HTMLButtonElement;
const deckEditButton = document.getElementById('deckEditButton') as HTMLButtonElement;
const deckRenameButton = document.getElementById('deckRenameButton') as HTMLButtonElement;
const deckCopyButton = document.getElementById('deckCopyButton') as HTMLButtonElement;
const deckDeleteButton = document.getElementById('deckDeleteButton') as HTMLButtonElement;

function showDeckList() {
	showSection('deckList');
	selectedDeck = null;
	for (const el of deckList.getElementsByTagName('input')) {
		(el as HTMLInputElement).checked = false;
	}
}

deckListBackButton.addEventListener('click', e => {
	e.preventDefault();
	showSection('preGame');

	if (canPushState) {
		try {
			history.pushState(null, '', '..');
		} catch {
			canPushState = false;
		}
	}
	if (location.hash)
		location.hash = '';
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
	const label = document.createElement('label');

	const button = document.createElement('input');
	button.name = 'selectedDeck';
	button.type = 'radio';
	button.dataset.index = index.toString();
	button.addEventListener('click', e => {
		selectedDeck = decks[parseInt((e.target as HTMLInputElement).dataset.index!)];
		selectDeck();
	});
	label.appendChild(button);

	label.appendChild(document.createTextNode(deck.name));

	deckList.insertBefore(label, newDeckButton);
	return label;
}

newDeckButton.addEventListener('click', () => {
	selectedDeck = new Deck(`Deck ${decks.length}`, [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ], false);
	createDeckButton(decks.length, selectedDeck);
	decks.push(selectedDeck);
	editDeck();
});

deckEditButton.addEventListener('click', editDeck);

function selectDeck() {
	clearChildren(deckCardListView);
	if (selectedDeck == null) return;

	let size = 0;

	deckNameLabel.innerText = selectedDeck.name;
	for (const cardNumber of selectedDeck.cards) {
		if (cardNumber) {
			const card = cardDatabase.cards![cardNumber - 1];
			size += card.size;

			const button = new CardButton('radio', card);
			button.inputElement.disabled = true;
			button.inputElement.hidden = true;
			deckCardListView.appendChild(button.element);
		}
	}

	deckEditButton.disabled = selectedDeck.isReadOnly;
	deckRenameButton.disabled = selectedDeck.isReadOnly;
	deckCopyButton.disabled = false;
	deckDeleteButton.disabled = selectedDeck.isReadOnly;
	deckViewSize.innerText = size.toString();
	deckEditorDeckViewSection.hidden = false;
}

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
	selectedDeck = new Deck(selectedDeck.name, Array.from(selectedDeck.cards), false);
	const button = createDeckButton(decks.length, selectedDeck);
	decks.push(selectedDeck);
	(button.getElementsByTagName('input')[0] as HTMLInputElement).checked = true;
	selectDeck();
	saveDecks();
});

deckDeleteButton.addEventListener('click', () => {
	if (selectedDeck == null) return;
	const index = decks.indexOf(selectedDeck);
	if (index < 0) return;
	if (!confirm(`Are you sure you want to delete ${selectedDeck.name}?`)) return;

	decks.splice(index, 1);

	let removed = false;
	for (const el of Array.from(deckList.getElementsByTagName('label'))) {
		const input = el.getElementsByTagName('input')[0];
		if (removed) {
			input.dataset.index = (parseInt(input.dataset.index!) - 1).toString();
		} else if (parseInt(input.dataset.index!) == index) {
			deckList.removeChild(el);
			removed = true;
		}
	}

	selectedDeck = null;
	deckEditorDeckViewSection.hidden = true;
	saveDecks();
});

if (!canPushState)
	deckListBackButton.href = '#';
