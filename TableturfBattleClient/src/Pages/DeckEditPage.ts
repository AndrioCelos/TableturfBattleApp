/// <reference path="../CardList.ts"/>

const deckNameLabel2 = document.getElementById('deckName2')!;
const deckEditSize = document.getElementById('deckEditSize')!;
const deckCardListEdit = document.getElementById('deckCardListEdit')!;
const cardList = CardList.fromId('cardList', 'cardListSortBox');
const deckTestButton = document.getElementById('deckTestButton') as HTMLButtonElement;
const deckSaveButton = document.getElementById('deckSaveButton') as HTMLButtonElement;
const deckCancelButton = document.getElementById('deckCancelButton') as HTMLButtonElement;
const deckCardListBackButton = document.getElementById('deckCardListBackButton') as HTMLLinkElement;
const cardListSortBox = document.getElementById('cardListSortBox') as HTMLSelectElement;
const testStageSelectionList = document.getElementById('testStageSelectionList')!;
const testStageButtons: StageButton[] = [ ];
const testStageSelectionDialog = document.getElementById('testStageSelectionDialog') as HTMLDialogElement;

const deckEditCardButtons: (CardButton | HTMLLabelElement)[] = [ ];

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
	showPage('deckEdit');
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
			for (const button2 of cardList.cardButtons) {
				button2.checked = button2.card.number == card;
			}
			cardList.listElement.parentElement!.classList.add('selecting');
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
			for (const button2 of cardList.cardButtons) {
				button2.checked = false;
			}
			cardList.listElement.parentElement!.classList.add('selecting');
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
		cardList.add(button);
		button.inputElement.addEventListener('input', () => {
			if (button.inputElement.checked) {
				for (const button2 of cardList.cardButtons) {
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

				cardList.listElement.parentElement!.classList.remove('selecting');
				if (!deckModified) {
					deckModified = true;
					window.addEventListener('beforeunload', onBeforeUnload_deckEditor);
				}
			}
		});
		addTestCard(card);
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
	cardList.listElement.parentElement!.classList.remove('selecting');
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

function addTestStage(stage: Stage) {
	const button = new StageButton(stage);
	testStageButtons.push(button);
	button.inputElement.name = 'stage';
	button.inputElement.addEventListener('input', () => {
		if (button.inputElement.checked) {
			stageRandomLabel.classList.remove('checked');
			for (const button2 of testStageButtons) {
				if (button2 != button)
					button2.element.classList.remove('checked');
			}

			clearChildren(testDeckList);
			testDeckCardButtons.splice(0);

			for (const el of deckEditCardButtons) {
				const card = (el as CardButton).card;
				if (card) {
					addTestDeckCard(card);
				}
			}

			testStageSelectionDialog.close();
			initTest(stage);
		}
	});
	button.setStartSpaces(2);
	testStageSelectionList.appendChild(button.element);
}

deckTestButton.addEventListener('click', _ => {
	for (const button of testStageButtons)
		button.checked = false;
	testStageSelectionDialog.showModal();
});
