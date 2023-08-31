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

let draggingCardButton: Element | null = null;

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

			const index = deckEditCardButtons.entries.findIndex(el => el.button.checked);
			if (index < 0) return;
			const oldEntry = deckEditCardButtons.entries[index];
			const oldCardNumber = oldEntry.value;

			if (oldCardNumber != 0)
				cardListButtonGroup.entries.find(e => e.value.number == oldCardNumber)!.button.enabled = true;
			cardListButtonGroup.entries.find(e => e.value.number == card.number)!.button.enabled = false;

			const button3 = createDeckEditCardButton(card.number);
			button3.checked = true;

			deckEditCardButtons.replace(index, button3, card.number);
			deckEditUpdateSize();

			cardList.listElement.parentElement!.classList.remove('selecting');
			if (!deckModified) {
				deckModified = true;
				window.addEventListener('beforeunload', onBeforeUnload_deckEditor);
			}
			selectFirstEmptySlot();
		});
		addTestCard(card);
	}
	cardList.setSortOrder('size');
	testAllCardsList.setSortOrder('size');
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
	selectFirstEmptySlot();
}

function selectFirstEmptySlot() {
	let found = false;
	for (const el of deckEditCardButtons.entries) {
		if (!found && el.value == 0) {
			for (const el2 of deckEditCardButtons.entries) {
				if (el2 == el) break;
				el2.button.checked = false;
			}
			found = true;
			el.button.checked = true;
			deckEditCardButtons.value = 0;
		} else if (found)
			el.button.checked = false;
	}
}

function createDeckEditCardButton(cardNumber: number) {
	const button = new CardButton(cardDatabase.get(cardNumber));
	button.buttonElement.addEventListener('click', () => {
		for (const button2 of cardList.cardButtons) {
			button2.checked = button2.card.number == cardNumber;
		}
		cardList.listElement.parentElement!.classList.add('selecting');
	});
	button.buttonElement.addEventListener('dragstart', e => {
		if (e.dataTransfer == null) return;
		const index = deckEditCardButtons.entries.findIndex(el => el.button.buttonElement == e.currentTarget);
		draggingCardButton = button.buttonElement;
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('application/tableturf-card-index', index.toString());
		button.buttonElement.classList.add('dragging');
	});
	button.buttonElement.addEventListener('dragend', e => {
		button.buttonElement.classList.remove('dragging');
		if (draggingCardButton != null && e.currentTarget == draggingCardButton) {
			const index = deckEditCardButtons.entries.findIndex(el => el.button.buttonElement == e.currentTarget) + 1;
			deckCardListEdit.insertBefore(draggingCardButton, index >= deckEditCardButtons.entries.length ? null : deckEditCardButtons.entries[index].button.buttonElement);
			draggingCardButton = null;
		}
	});
	button.buttonElement.addEventListener('dragenter', e => e.preventDefault());
	button.buttonElement.addEventListener('dragover', deckEditCardButton_dragover);
	button.buttonElement.addEventListener('drop', deckEditCardButton_drop);

	const handle = document.createElement('div');
	handle.className = 'handle';
	button.buttonElement.insertBefore(handle, button.buttonElement.firstChild);
	if (deckListTouchMode) {
		handle.draggable = true;
		(button.buttonElement.getElementsByClassName('cardHeader')[0] as HTMLElement).draggable = true;
	} else
		button.buttonElement.draggable = true;

	return button;
}

function deckEditCardButton_dragover(e: DragEvent) {
	e.preventDefault();
	if (e.dataTransfer == null) return;
	const indexString = e.dataTransfer.getData('application/tableturf-card-index');
	if (indexString != '' && draggingCardButton != null) {
		e.dataTransfer.dropEffect = 'move';
		if (e.currentTarget != draggingCardButton && e.currentTarget != deckCardListEdit) {
			// Move the card being dragged into the new position as a preview.
			for (let el = draggingCardButton.nextElementSibling; el != null; el = el.nextElementSibling) {
				if (el == e.currentTarget) {
					deckCardListEdit.insertBefore(draggingCardButton, el.nextElementSibling);
					return;
				}
			}
			deckCardListEdit.insertBefore(draggingCardButton, e.currentTarget as Node);
		}
	} else if (e.dataTransfer.getData('text/plain'))
		e.dataTransfer.dropEffect = 'copy';
}

function deckEditCardButton_drop(e: DragEvent) {
	e.preventDefault();
	if (e.dataTransfer == null) return;
	const indexString = e.dataTransfer.getData('application/tableturf-card-index');
	if (indexString) {
		const index = parseInt(indexString);
		let newIndex = 0;
		for (let el = deckCardListEdit.firstElementChild; el != null; el = el.nextElementSibling) {
			if (el == draggingCardButton) break;
			newIndex++;
		}
		if (newIndex == index) return;
		console.log(`Moving card ${index} to ${newIndex}.`);

		deckEditCardButtons.move(index, newIndex);
		draggingCardButton = null;
	}
}

function createDeckEditEmptySlotButton() {
	const buttonElement = document.createElement('button');
	const button = new CheckButton(buttonElement);
	buttonElement.type = 'button';
	buttonElement.className = 'card emptySlot';
	buttonElement.addEventListener('click', () => {
		for (const button2 of cardList.cardButtons)
			button2.checked = false;
		cardList.listElement.parentElement!.classList.add('selecting');
	});
	buttonElement.addEventListener('dragenter', e => e.preventDefault());
	buttonElement.addEventListener('dragover', deckEditCardButton_dragover);
	buttonElement.addEventListener('drop', deckEditCardButton_drop);
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
