/// <reference path="../CheckButtonGroup.ts"/>

const deckNameLabel2 = document.getElementById('deckName2')!;
const deckEditSize = document.getElementById('deckEditSize')!;
const deckCardListEdit = document.getElementById('deckCardListEdit')!;
const cardList = CardList.fromId('cardList', 'cardListSortBox', 'cardListFilterBox');
const cardListButtonGroup = new CheckButtonGroup<Card>();
const deckSortButton = document.getElementById('deckSortButton') as HTMLButtonElement;
const deckTestButton = document.getElementById('deckTestButton') as HTMLButtonElement;
const deckSaveButton = document.getElementById('deckSaveButton') as HTMLButtonElement;
const deckCancelButton = document.getElementById('deckCancelButton') as HTMLButtonElement;
const deckCardListBackButton = document.getElementById('deckCardListBackButton') as HTMLLinkElement;
const cardListFilterBox = document.getElementById('cardListFilterBox') as HTMLSelectElement;
const testStageSelectionList = document.getElementById('testStageSelectionList')!;
const testStageButtons = new CheckButtonGroup<Stage>(testStageSelectionList);
const testStageSelectionDialog = document.getElementById('testStageSelectionDialog') as HTMLDialogElement;

const deckEditCardButtons = new CheckButtonGroup<number>(deckCardListEdit);

let selectedDeckCardIndex: number | null = null;

function deckEditInitCardDatabase(cards: Card[]) {
	for (const card of cards) {
		const button = new CardButton(card);
		cardList.add(button);
		cardListButtonGroup.add(button, card);
		button.buttonElement.addEventListener('click', () => {
			if (!button.enabled) return;

			for (const button2 of cardList.cardButtons) {
				if (button2 != button)
					button2.checked = false;
			}

			if (selectedDeckCardIndex == null) return;
			const oldEntry = deckEditCardButtons.entries[selectedDeckCardIndex];
			const oldCardNumber = oldEntry.value;

			if (oldCardNumber != 0)
				cardListButtonGroup.entries.find(e => e.value.number == oldCardNumber)!.button.enabled = true;
			cardListButtonGroup.entries.find(e => e.value.number == card.number)!.button.enabled = false;

			const button3 = createDeckEditCardButton(card.number);
			button3.checked = true;

			const oldElement = oldEntry.button.buttonElement;
			deckCardListEdit.insertBefore(button3.buttonElement, oldElement);
			deckCardListEdit.removeChild(oldElement);

			deckEditCardButtons.replace(selectedDeckCardIndex, button3, card.number);
			deckEditUpdateSize();

			cardList.listElement.parentElement!.classList.remove('selecting');
			if (!deckModified) {
				deckModified = true;
				window.addEventListener('beforeunload', onBeforeUnload_deckEditor);
			}
		});
		addTestCard(card);
	}
}

function deckEditInitStageDatabase(stages: Stage[]) {
	for (const stage of stages) {
		const button = new StageButton(stage);
		testStageButtons.add(button, stage);
		button.buttonElement.addEventListener('click', () => {
			clearChildren(testDeckList);
			testDeckCardButtons.splice(0);

			if (editingDeck) {
				for (const el of deckEditCardButtons.buttons) {
					const card = (el as CardButton).card;
					if (card)
						addTestDeckCard(card);
				}
			} else if (selectedDeck) {
				for (const cardNumber of selectedDeck.cards) {
					if (cardDatabase.isValidCardNumber(cardNumber))
						addTestDeckCard(cardDatabase.get(cardNumber));
				}
			}

			testStageSelectionDialog.close();
			initTest(stage);
		});
		button.setStartSpaces(2);
	}
}

function editDeck() {
	if (selectedDeck == null) return;

	deckNameLabel2.innerText = selectedDeck.name;

	deckEditCardButtons.clear();
	selectedDeckCardIndex = null;

	for (let i = 0; i < 15; i++) {
		if (selectedDeck.cards[i]) {
			const button = createDeckEditCardButton(selectedDeck.cards[i]);
			deckEditCardButtons.add(button, selectedDeck.cards[i]);
		} else {
			const element = createDeckEditEmptySlotButton();
			deckEditCardButtons.add(element, 0);
		}
	}

	for (const entry of cardListButtonGroup.entries)
		entry.button.enabled = !selectedDeck.cards.includes(entry.value.number);

	deckEditUpdateSize();
	cardList.clearFilter();
	editingDeck = true;
	showPage('deckEdit');
}

function createDeckEditCardButton(cardNumber: number) {
	const button = new CardButton(cardDatabase.get(cardNumber));
	button.buttonElement.addEventListener('click', () => {
		selectedDeckCardIndex = deckEditCardButtons.entries.findIndex(e => e.button == button);
		for (const button2 of cardList.cardButtons) {
			button2.checked = button2.card.number == cardNumber;
		}
		cardList.listElement.parentElement!.classList.add('selecting');
	});
	return button;
}

function createDeckEditEmptySlotButton() {
	const buttonElement = document.createElement('button');
	const button = new CheckButton(buttonElement);
	buttonElement.type = 'button';
	buttonElement.className = 'card emptySlot';
	buttonElement.addEventListener('click', () => {
		selectedDeckCardIndex = deckEditCardButtons.entries.findIndex(e => e.button == button);
		for (const button2 of cardList.cardButtons)
			button2.checked = false;
		cardList.listElement.parentElement!.classList.add('selecting');
	});
	return button;
}

deckSortButton.addEventListener('click', _ => {
	let isSorted = true;
	let lastCardNumber = deckEditCardButtons.entries[0].value;
	for (let i = 1; i < deckEditCardButtons.entries.length; i++) {
		const entry = deckEditCardButtons.entries[i];
		if (lastCardNumber == 0 ? entry.value != 0 : (entry.value != 0 && cardDatabase.get(entry.value).size < cardDatabase.get(lastCardNumber).size)) {
			isSorted = false;
			break;
		}
		lastCardNumber = entry.value;
	}
	const comparer = CardList.cardSortOrders['size'];
	if (isSorted)
		// If the deck is already sorted, reverse the order.
		deckEditCardButtons.entries.sort((a, b) => a.value == 0 ? (b.value == 0 ? 0 : 1) : (b.value == 0 ? -1 : comparer(cardDatabase.get(b.value), cardDatabase.get(a.value))));
	else
		deckEditCardButtons.entries.sort((a, b) => a.value == 0 ? (b.value == 0 ? 0 : 1) : (b.value == 0 ? -1 : comparer(cardDatabase.get(a.value), cardDatabase.get(b.value))));

	clearChildren(deckCardListEdit);
	for (const button of deckEditCardButtons.buttons)
		deckCardListEdit.appendChild(button.buttonElement);
});

deckSaveButton.addEventListener('click', () => {
	if (selectedDeck == null) return;
	selectedDeck.cards = deckEditCardButtons.entries.map(e => e.value);
	saveDecks();
	selectDeck();
	stopEditingDeck();
	showPage('deckList');
});

deckCancelButton.addEventListener('click', () => {
	if (selectedDeck == null) return;
	if (!confirm('Are you sure you want to stop editing this deck without saving?')) return;
	stopEditingDeck();
	showPage('deckList');
});

function deckEditUpdateSize() {
	let size = 0;
	for (const o of deckEditCardButtons.buttons) {
		const card = (o as CardButton).card;
		if (card) size += card.size;
	}
	deckEditSize.innerText = size.toString();
}

deckCardListBackButton.addEventListener('click', e => {
	e.preventDefault();
	deckEditCardButtons.deselect();
	cardList.listElement.parentElement!.classList.remove('selecting');
});

function stopEditingDeck() {
	if (deckModified) {
		deckModified = false;
		window.removeEventListener('beforeunload', onBeforeUnload_deckEditor);
	}
	editingDeck = false;
}

function onBeforeUnload_deckEditor(e: BeforeUnloadEvent) {
	e.preventDefault();
	return 'You have unsaved changes to your deck that will be lost.';
}

deckTestButton.addEventListener('click', _ => {
	testStageButtons.deselect();
	testStageSelectionDialog.showModal();
});
