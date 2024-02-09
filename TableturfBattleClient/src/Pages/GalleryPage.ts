const galleryCardList = CardList.fromId<CardDisplay>('galleryCardList', 'gallerySortBox', 'galleryFilterBox');
const galleryBackButton = document.getElementById('galleryBackButton') as HTMLLinkElement;
const galleryCardDialog = document.getElementById('galleryCardDialog') as HTMLDialogElement;
const galleryCardDeleteDialog = document.getElementById('galleryCardDeleteDialog') as HTMLDialogElement;

const galleryNewCustomCardButton = document.getElementById('galleryNewCustomCardButton') as HTMLButtonElement;
const galleryChecklistBox = document.getElementById('galleryChecklistBox') as HTMLInputElement;
const bitsToCompleteField = document.getElementById('bitsToCompleteField') as HTMLElement;

let galleryCardDisplay: CardDisplay | null = null;
let gallerySelectedCardDisplay: CardDisplay | null = null;
const galleryCardEditor = document.getElementById('galleryCardEditor') as HTMLButtonElement;
const galleryCardEditorName = document.getElementById('galleryCardEditorName') as HTMLTextAreaElement;
const galleryCardEditorGridButtons: HTMLButtonElement[][] = [ ];
const galleryCardEditorSpecialCostButtons: HTMLButtonElement[] = [ ];
const galleryCardEditorSpecialCost = document.getElementById('galleryCardEditorSpecialCost') as HTMLElement;
const galleryCardEditorSpecialCostDefaultBox = document.getElementById('galleryCardEditorSpecialCostDefaultBox') as HTMLInputElement;
const galleryCardEditorEditButton = document.getElementById('galleryCardEditorEditButton') as HTMLButtonElement;
const galleryCardEditorSubmitButton = document.getElementById('galleryCardEditorSubmitButton') as HTMLButtonElement;
const galleryCardEditorDeleteButton = document.getElementById('galleryCardEditorDeleteButton') as HTMLButtonElement;
const galleryCardEditorCancelButton = document.getElementById('galleryCardEditorCancelButton') as HTMLButtonElement;
const galleryCardEditorDeleteYesButton = document.getElementById('galleryCardEditorDeleteYesButton') as HTMLButtonElement;

const ownedCards: {[key: number]: number} = { 6: 0, 34: 0, 159: 0, 13: 0, 45: 0, 137: 0, 22: 0, 52: 0, 141: 0, 28: 0, 55: 0, 103: 0, 40: 0, 56: 0, 92: 0 };
let lastGridButton: HTMLButtonElement | null = null;
let customCardSize = 0;
let customCardSpecialCost = 0;

function showCardList() {
	showPage('gallery');
}

function galleryInitCardDatabase(cards: Card[]) {
	for (const card of cards.concat(cardDatabase.customCards)) {
		addCardToGallery(card);
	}
	updateBitsToComplete();
}

function addCardToGallery(card: Card) {
	const display = createGalleryCardDisplay(card);
	galleryCardList.add(display);
}

function createGalleryCardDisplay(card: Card) {
	const display = new CardDisplay(card, 1, 'button');

	const cardNumber = document.createElement('div');
	cardNumber.className = 'cardNumber';
	cardNumber.innerText = card.number >= 0 ? `No. ${card.number}` : card.isCustom ? 'Custom' : 'Upcoming';
	display.element.insertBefore(cardNumber, display.element.firstChild);

	display.element.addEventListener('click', () => {
		if (galleryChecklistBox.checked) {
			if (card.number <= 0) return;
			if (card.number in ownedCards) {
				delete ownedCards[card.number];
				display.element.classList.add('unowned');
			} else {
				ownedCards[card.number] = 0;
				display.element.classList.remove('unowned');
			}
			updateBitsToComplete();
			saveChecklist();
		} else {
			gallerySelectedCardDisplay = display;
			openGalleryCardView(card);
		}
	});

	return display;
}

function updateCardInGallery(card: Card) {
	const display = createGalleryCardDisplay(card);
	galleryCardList.update(display, card);
}

function openGalleryCardView(card: Card) {
	const existingEl = galleryCardDialog.firstElementChild;
	if (existingEl && existingEl.tagName != 'FORM')
		galleryCardDialog.removeChild(existingEl);
	const display = new CardDisplay(card, 1);
	galleryCardDisplay = display;
	galleryCardDialog.insertBefore(display.element, galleryCardDialog.firstChild);

	galleryCardEditor.parentElement?.removeChild(galleryCardEditor);
	display.element.appendChild(galleryCardEditor);
	galleryCardEditor.hidden = true;
	display.element.classList.remove('editing');
	galleryCardEditorEditButton.hidden = !card.isCustom;
	galleryCardEditorDeleteButton.hidden = !card.isCustom;
	galleryCardEditorSubmitButton.hidden = true;
	galleryCardEditorCancelButton.innerText = 'Close';

	galleryCardEditorName.value = card.line2 == null ? card.name : `${card.line1}\n${card.line2}`;
	for (let y = 0; y < 8; y++) {
		for (let x = 0; x < 8; x++) {
			galleryCardEditorGridButtons[y][x].dataset.state = card.grid[y][x].toString();
		}
	}
	updateCustomCardSize();

	galleryCardDialog.showModal();
}

function startEditingCustomCard() {
	galleryCardEditor.hidden = false;
	galleryCardDisplay?.element.classList.add('editing');
	galleryCardEditorEditButton.hidden = true;
	galleryCardEditorDeleteButton.hidden = true;
	galleryCardEditorSubmitButton.hidden = false;
	galleryCardEditorCancelButton.innerText = 'Cancel';
}

galleryBackButton.addEventListener('click', e => {
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

galleryChecklistBox.addEventListener('change', () => {
	if (galleryChecklistBox.checked) {
		for (const cardDisplay of galleryCardList.cardButtons) {
			if (cardDisplay.card.number in ownedCards)
				cardDisplay.element.classList.remove('unowned');
			else
				cardDisplay.element.classList.add('unowned');
		}
	} else {
		for (const cardDisplay of galleryCardList.cardButtons)
			cardDisplay.element.classList.remove('unowned');
	}
});

function updateBitsToComplete() {
	if (!cardDatabase.cards) throw new Error('Card database not loaded');
	let bitsRequired = 0;
	for (const card of cardDatabase.cards) {
		if (card.number in ownedCards) continue;
		switch (card.rarity) {
			case Rarity.Fresh: bitsRequired += 40; break;
			case Rarity.Rare: bitsRequired += 15; break;
			default: bitsRequired += 5; break;
		}
	}
	bitsToCompleteField.innerText = bitsRequired.toString();
}

{
	for (let x = 0; x < 8; x++) {
		const row = [ ];
		for (let y = 0; y < 8; y++) {
			const button = document.createElement('button');
			button.type = 'button';
			button.dataset.state = Space.Empty.toString();
			button.dataset.x = x.toString();
			button.dataset.y = y.toString();
			button.addEventListener('click', () => {
				const state = parseInt(button.dataset.state ?? '0');
				switch (state) {
					case Space.Empty:
						button.dataset.state = Space.Ink1.toString();
						break;
					case Space.Ink1:
						if (lastGridButton == button) {
							// When a space is pressed twice, move the special space there.
							for (const row of galleryCardEditorGridButtons) {
								for (const button2 of row) {
									if (button2 == button)
										button2.dataset.state = Space.SpecialInactive1.toString();
									else if (button2.dataset.state == Space.SpecialInactive1.toString())
										button2.dataset.state = Space.Ink1.toString();
								}
							}
						} else
							button.dataset.state = Space.Empty.toString();
						break;
					default:
						button.dataset.state = Space.Empty.toString();
						break;
				}
				lastGridButton = button;

				updateCustomCardSize();
			});
			row.push(button);
		}
		galleryCardEditorGridButtons.push(row);
	}

	const galleryCardEditorGrid = document.getElementById('galleryCardEditorGrid')!;
	for (let y = 0; y < 8; y++) {
		for (let x = 0; x < 8; x++) {
			galleryCardEditorGrid.appendChild(galleryCardEditorGridButtons[x][y]);
		}
	}

	// Load the saved checklist and custom cards.
	const checklistString = localStorage.getItem('checklist');
	if (checklistString) {
		const cards = JSON.parse(checklistString);
		Object.assign(ownedCards, cards);
	}

	const customCardsString = localStorage.getItem('customCards');
	if (customCardsString) {
		for (const cardJson of JSON.parse(customCardsString)) {
			cardDatabase.customCards.push(Card.fromJson(cardJson));
		}
		cardDatabase.customCardsModified = cardDatabase.customCards.length > 0;
	}
}

for (let i = 0; i < 10; i++) {
	const button = document.createElement('button');
	const n = i < 5 ? i + 6 : i - 4;
	button.dataset.value = n.toString();
	galleryCardEditorSpecialCost.appendChild(button);
	galleryCardEditorSpecialCostButtons.push(button);
	button.addEventListener('click', () => {
		customCardSpecialCost = n;
		galleryCardEditorSpecialCostDefaultBox.checked = false;
		updateCustomCardSpecialCost();
	});
}

function updateCustomCardSize() {
	let size = 0, hasSpecialSpace = false;
	for (const row of galleryCardEditorGridButtons) {
		for (const button2 of row) {
			switch (parseInt(button2.dataset.state!)) {
				case Space.Ink1:
					size++;
					break;
				case Space.SpecialInactive1:
					size++;
					hasSpecialSpace = true;
					break;
			}
		}
	}

	customCardSize = size;
	galleryCardDisplay!.setSize(size);
	if (galleryCardEditorSpecialCostDefaultBox.checked) {
		customCardSpecialCost =
			size <= 3 ? 1
				: size <= 5 ? 2
					: size <= 8 ? 3
						: size <= 11 ? 4
							: size <= 15 ? 5
								: 6;
		if (!hasSpecialSpace && customCardSpecialCost > 3)
			customCardSpecialCost = 3;
		updateCustomCardSpecialCost();
	}
}

function updateCustomCardSpecialCost() {
	galleryCardDisplay?.setSpecialCost(customCardSpecialCost);
	for (let i = 0; i < galleryCardEditorSpecialCostButtons.length; i++) {
		const button = galleryCardEditorSpecialCostButtons[i];
		if (parseInt(button.dataset.value!) <= customCardSpecialCost)
			button.classList.add('active');
		else
			button.classList.remove('active');
	}
}

galleryCardEditorSpecialCostDefaultBox.addEventListener('change', () => {
	if (galleryCardEditorSpecialCostDefaultBox.checked)
		updateCustomCardSize();
});

galleryCardEditorEditButton.addEventListener('click', () => startEditingCustomCard());

galleryNewCustomCardButton.addEventListener('click', () => {
	const card = new Card(UNSAVED_CUSTOM_CARD_INDEX, 'New card', 'New card', null, Card.DEFAULT_INK_COLOUR_1, Card.DEFAULT_INK_COLOUR_2, Rarity.Common, 1, Array.from({ length: 8 }, () => [ 0, 0, 0, 0, 0, 0, 0, 0]) );
	openGalleryCardView(card);
	startEditingCustomCard();
});

galleryCardEditorSubmitButton.addEventListener('click', () => {
	const isNew = galleryCardDisplay!.card.number == UNSAVED_CUSTOM_CARD_INDEX;
	const number = isNew ? CUSTOM_CARD_START - cardDatabase.customCards.length : galleryCardDisplay!.card.number;
	const lines = Card.wrapName(galleryCardEditorName.value);
	const card = new Card(number, galleryCardEditorName.value.replaceAll('\n', ' '), lines[0], lines[1], Card.DEFAULT_INK_COLOUR_1, Card.DEFAULT_INK_COLOUR_2,
		Rarity.Common, customCardSpecialCost, Array.from(galleryCardEditorGridButtons, r => Array.from(r, b => parseInt(b.dataset.state!))));
	if (isNew) {
		cardDatabase.customCards.push(card);
		addCardToGallery(card);
	} else {
		cardDatabase.customCards[CUSTOM_CARD_START - number] = card;
		updateCardInGallery(card);
	}
	cardDatabase.customCardsModified = true;
	saveCustomCards();
});

galleryCardEditorDeleteButton.addEventListener('click', () => {
	const label = galleryCardDeleteDialog.firstElementChild as HTMLElement;
	label.innerText = `Are you sure you want to delete the custom card ${galleryCardDisplay!.card.name}?\nThis cannot be undone!`;
	galleryCardDeleteDialog.showModal();
});

galleryCardEditorDeleteYesButton.addEventListener('click', () => {
	const card = galleryCardDisplay!.card;
	galleryCardList.remove(card);
	galleryCardDialog.close();

	let i = cardDatabase.customCards.indexOf(card);
	if (i < 0) return;

	// Remove the card from decks and update other custom card numbers.
	for (const deck of decks) {
		for (let i = 0; i < deck.cards.length; i++) {
			if (deck.cards[i] == card.number)
				deck.cards[i] = 0;
			else if (deck.cards[i] < card.number)
				deck.cards[i]++;
		}
	}

	// Update the custom cards list.
	cardDatabase.customCards.splice(i, 1);
	for (; i < cardDatabase.customCards.length; i++)
		cardDatabase.customCards[i].number++;

	saveCustomCards();
	saveDecks();
});
