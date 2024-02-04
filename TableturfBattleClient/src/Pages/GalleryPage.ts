const galleryCardList = CardList.fromId<CardDisplay>('galleryCardList', 'gallerySortBox', 'galleryFilterBox');
const galleryBackButton = document.getElementById('galleryBackButton') as HTMLLinkElement;
const galleryCardDialog = document.getElementById('galleryCardDialog') as HTMLDialogElement;

const galleryNewCustomCardButton = document.getElementById('galleryNewCustomCardButton') as HTMLButtonElement;
const galleryChecklistBox = document.getElementById('galleryChecklistBox') as HTMLInputElement;
const bitsToCompleteField = document.getElementById('bitsToCompleteField') as HTMLElement;

let galleryCardDisplay: CardDisplay | null = null;
const galleryCardEditor = document.getElementById('galleryCardEditor') as HTMLButtonElement;
const galleryCardEditorGridButtons: HTMLButtonElement[][] = [ ];
const galleryCardEditorSpecialCostButtons: HTMLButtonElement[] = [ ];
const galleryCardEditorSpecialCost = document.getElementById('galleryCardEditorSpecialCost') as HTMLElement;
const galleryCardEditorSpecialCostDefaultBox = document.getElementById('galleryCardEditorSpecialCostDefaultBox') as HTMLInputElement;
const galleryCardEditorEditButton = document.getElementById('galleryCardEditorEditButton') as HTMLButtonElement;
const galleryCardEditorSubmitButton = document.getElementById('galleryCardEditorSubmitButton') as HTMLButtonElement;
const galleryCardEditorCancelButton = document.getElementById('galleryCardEditorCancelButton') as HTMLButtonElement;

const ownedCards: {[key: number]: number} = { 6: 0, 34: 0, 159: 0, 13: 0, 45: 0, 137: 0, 22: 0, 52: 0, 141: 0, 28: 0, 55: 0, 103: 0, 40: 0, 56: 0, 92: 0 };
let lastGridButton: HTMLButtonElement | null = null;
let customCardSpecialCost = 0;

function showCardList() {
	showPage('gallery');
}

function galleryInitCardDatabase(cards: Card[]) {
	for (const card of cards.concat(customCards)) {
		const display = new CardDisplay(card, 1, 'button');

		const cardNumber = document.createElement('div');
		cardNumber.className = 'cardNumber';
		cardNumber.innerText = card.number >= 0 ? `No. ${card.number}` : 'Upcoming';
		display.element.insertBefore(cardNumber, display.element.firstChild);

		galleryCardList.add(display);

		display.element.addEventListener('click', () => {
			if (galleryChecklistBox.checked) {
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
				galleryCardEditorEditButton.hidden = false;
				galleryCardEditorSubmitButton.hidden = true;
				galleryCardEditorCancelButton.innerText = 'Close';

				galleryCardDialog.showModal();
			}
		});
	}
	updateBitsToComplete();
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
	const customCardsString = localStorage.getItem('customCards');
	if (customCardsString) {
		for (const card of JSON.parse(customCardsString)) {
			customCards.push(Card.fromJson(card));
		}
	}

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

	// Load the saved checklist.
	const checklistString = localStorage.getItem('checklist');
	if (checklistString) {
		const cards = JSON.parse(checklistString);
		Object.assign(ownedCards, cards);
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

galleryCardEditorEditButton.addEventListener('click', () => {
	galleryCardEditor.hidden = false;
	galleryCardDisplay?.element.classList.add('editing');
	galleryCardEditorEditButton.hidden = true;
	galleryCardEditorSubmitButton.hidden = false;
	galleryCardEditorCancelButton.innerText = 'Cancel';
});
