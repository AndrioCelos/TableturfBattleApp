const deckNameLabel2 = document.getElementById('deckName2')!;
const deckEditSize = document.getElementById('deckEditSize')!;
const deckCardListEdit = document.getElementById('deckCardListEdit')!;
const cardList = document.getElementById('cardList')!;
const deckTestButton = document.getElementById('deckTestButton') as HTMLButtonElement;
const deckSaveButton = document.getElementById('deckSaveButton') as HTMLButtonElement;
const deckCancelButton = document.getElementById('deckCancelButton') as HTMLButtonElement;
const deckCardListBackButton = document.getElementById('deckCardListBackButton') as HTMLLinkElement;
const cardListSortBox = document.getElementById('cardListSortBox') as HTMLSelectElement;

const cardButtons: CardButton[] = [ ];
const deckEditCardButtons: (CardButton | HTMLLabelElement)[] = [ ];

let deckModified = false;
let selectedDeckCardIndex: number | null = null;

function editDeck() {
	if (selectedDeck == null) return;

	deckNameLabel2.innerText = selectedDeck.name;

	clearChildren(deckCardListEdit);
	deckEditCardButtons.splice(0);
	selectedDeckCardIndex = null;

	for (let i = 0; i < 15; i++) {
		if (selectedDeck.cards[i]) {
			const button = createDeckEditCardButton(i, selectedDeck.cards[i]);
			deckCardListEdit.appendChild(button.element);
			deckEditCardButtons.push(button);
		} else {
			const element = createDeckEditEmptySlotButton(i);
			deckCardListEdit.appendChild(element);
			deckEditCardButtons.push(element);
		}
	}

	deckEditUpdateSize();
	showSection('deckEdit');
}

function createDeckEditCardButton(index: number, card: number) {
	const button = new CardButton('radio', cardDatabase.cards![card - 1]);
	button.inputElement.name = 'deckEditorSelectedCard'
	deckCardListEdit.appendChild(button.element);
	button.inputElement.addEventListener('input', () => {
		if (button.inputElement.checked) {
			for (const o of deckEditCardButtons) {
				if (o != button) {
					if ((o as CardButton).card)
						(o as CardButton).element.classList.remove('checked');
					else
						(o as HTMLElement).classList.remove('checked');
				}
			}

			selectedDeckCardIndex = index;
			for (const button2 of cardButtons) {
				button2.checked = button2.card.number == card;
			}
			cardList.parentElement!.classList.add('selecting');
		}
	});
	return button;
}

function createDeckEditEmptySlotButton(index: number) {
	const element = document.createElement('label');
	element.className = 'card emptySlot';

	const input = document.createElement('input');
	input.type = 'radio';
	input.name = 'deckEditorSelectedCard'
	input.addEventListener('input', () => {
		if (input.checked) {
			for (const o of deckEditCardButtons) {
				if (o != element) {
					if ((o as CardButton).card)
						(o as CardButton).element.classList.remove('checked');
					else
						(o as HTMLElement).classList.remove('checked');
				}
			}

			selectedDeckCardIndex = index;
			for (const button2 of cardButtons) {
				button2.checked = false;
			}
			cardList.parentElement!.classList.add('selecting');
		}
	});
	element.appendChild(input);

	return element;
}

deckSaveButton.addEventListener('click', () => {
	if (selectedDeck == null) return;
	selectedDeck.cards = deckEditCardButtons.map(o => (o as CardButton).card?.number ?? 0);
	saveDecks();
	selectDeck();
	stopEditingDeck();
	showSection('deckList');
});

deckCancelButton.addEventListener('click', () => {
	if (selectedDeck == null) return;
	if (!confirm('Are you sure you want to stop editing this deck without saving?')) return;
	stopEditingDeck();
	showSection('deckList');
});

function deckEditUpdateSize() {
	let size = 0;
	for (const o of deckEditCardButtons) {
		const card = (o as CardButton).card;
		if (card) size += card.size;
	}
	deckEditSize.innerText = size.toString();
}

function initCardDatabase(cards: Card[]) {
	for (const card of cards) {
		const button = new CardButton('radio', card);
		button.inputElement.name = 'deckEditorCardList';
		cardButtons.push(button);
		button.inputElement.addEventListener('input', () => {
			if (button.inputElement.checked) {
				for (const button2 of cardButtons) {
					if (button2 != button)
						button2.checked = false;
				}

				if (selectedDeckCardIndex == null) return;
				const oldButton = deckEditCardButtons[selectedDeckCardIndex];

				const button3 = createDeckEditCardButton(selectedDeckCardIndex, card.number);
				button3.checked = true;

				const oldElement = (oldButton as CardButton).element ?? (oldButton as Element);
				deckCardListEdit.insertBefore(button3.element, oldElement);
				deckCardListEdit.removeChild(oldElement);

				deckEditCardButtons[selectedDeckCardIndex] = button3;
				deckEditUpdateSize();

				cardList.parentElement!.classList.remove('selecting');
				if (!deckModified) {
					deckModified = true;
					window.addEventListener('beforeunload', onBeforeUnload_deckEditor);
				}
			}
		});
		cardList.appendChild(button.element);
	}
}

deckCardListBackButton.addEventListener('click', e => {
	e.preventDefault();
	for (const o of deckEditCardButtons) {
		if ((o as CardButton).card)
			(o as CardButton).checked = false;
		else {
			(o as HTMLElement).getElementsByTagName('input')[0].checked = false;
			(o as HTMLElement).classList.remove('checked');
		}
	}
	cardList.parentElement!.classList.remove('selecting');
});

const cardSortOrders: { [key: string]: ((a: Card, b: Card) => number) | undefined } = {
	'number': (a, b) => a.number - b.number,
	'name': (a, b) => a.name.localeCompare(b.name),
	'size': (a, b) => a.size != b.size ? a.size - b.size : a.number - b.number,
	'rarity': (a, b) => a.rarity != b.rarity ? a.rarity - b.rarity : a.number - b.number,
}

cardListSortBox.addEventListener('change', () => {
	const sortOrder = cardSortOrders[cardListSortBox.value];
	if (sortOrder) {
		clearChildren(cardList);
		cardButtons.sort((a, b) => sortOrder(a.card, b.card));
		for (const button of cardButtons)
			cardList.appendChild(button.element);
	}
});

function stopEditingDeck() {
	if (deckModified) {
		deckModified = false;
		window.removeEventListener('beforeunload', onBeforeUnload_deckEditor);
	}
}

function onBeforeUnload_deckEditor(e: BeforeUnloadEvent) {
	e.preventDefault();
	return 'You have unsaved changes to your deck that will be lost. Are you sure you want to continue?';
}
