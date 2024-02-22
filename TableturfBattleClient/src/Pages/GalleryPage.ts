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
const galleryCardEditorImageFile = document.getElementById('galleryCardEditorImageFile') as HTMLInputElement;
const galleryCardEditorImageSelectButton = document.getElementById('galleryCardEditorImageSelectButton') as HTMLButtonElement;
const galleryCardEditorImageClearButton = document.getElementById('galleryCardEditorImageClearButton') as HTMLButtonElement;
const galleryCardEditorRarityBox = document.getElementById('galleryCardEditorRarityBox') as HTMLSelectElement;
const galleryCardEditorColour1 = document.getElementById('galleryCardEditorColour1') as HTMLInputElement;
const galleryCardEditorColour2 = document.getElementById('galleryCardEditorColour2') as HTMLInputElement;
const galleryCardEditorColourPresetBox = document.getElementById('galleryCardEditorColourPresetBox') as HTMLSelectElement;
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

const colourPresets: {[key: string]: [ Colour, Colour ]} = {
	"Default": [ Card.DEFAULT_INK_COLOUR_1, Card.DEFAULT_INK_COLOUR_2 ],
	"Octarian": [ { r: 166, g: 105, b: 169 }, { r: 121, g: 111, b: 174 } ],
	"Salmonid": [ { r: 84, g: 142, b: 122 }, { r: 193, g: 111, b: 98 } ],
};

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

	if (card.isCustom) {
		galleryCardEditorRarityBox.value = card.rarity.toString();
		galleryCardEditorColour1.value = `#${card.inkColour1.r.toString(16).padStart(2, '0')}${card.inkColour1.g.toString(16).padStart(2, '0')}${card.inkColour1.b.toString(16).padStart(2, '0')}`;
		galleryCardEditorColour2.value = `#${card.inkColour2.r.toString(16).padStart(2, '0')}${card.inkColour2.g.toString(16).padStart(2, '0')}${card.inkColour2.b.toString(16).padStart(2, '0')}`;
		updateSelectedPreset([card.inkColour1, card.inkColour2]);

		galleryCardEditorName.value = card.line2 == null ? card.name : `${card.line1}\n${card.line2}`;
		for (let y = 0; y < 8; y++) {
			for (let x = 0; x < 8; x++) {
				galleryCardEditorGridButtons[y][x].dataset.state = card.grid[y][x].toString();
			}
		}
		updateCustomCardSize();
	}

	galleryCardDialog.showModal();
}

function updateSelectedPreset(selectedColours: Colour[]) {
	for (const key in colourPresets) {
		const colours = colourPresets[key];
		if (selectedColours[0].r == colours[0].r && selectedColours[0].g == colours[0].g && selectedColours[0].b == colours[0].b
			&& selectedColours[1].r == colours[1].r && selectedColours[1].g == colours[1].g && selectedColours[1].b == colours[1].b) {
			galleryCardEditorColourPresetBox.value = key;
			return;
		}
	}
	galleryCardEditorColourPresetBox.value = 'Custom';
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
		if (card.isUpcoming || card.number in ownedCards) continue;
		switch (card.rarity) {
			case Rarity.Fresh: bitsRequired += 40; break;
			case Rarity.Rare: bitsRequired += 15; break;
			default: bitsRequired += 5; break;
		}
	}
	bitsToCompleteField.innerText = bitsRequired.toString();
}

{
	for (var i = 0; ; i++) {
		if (!(i in Rarity)) break;
		const option = document.createElement('option');
		option.value = i.toString();
		option.innerText = Rarity[i];
		galleryCardEditorRarityBox.appendChild(option);
	}

	for (const k in colourPresets) {
		const option = document.createElement('option');
		option.innerText = k;
		galleryCardEditorColourPresetBox.appendChild(option);
	}
	const optionCustom = document.createElement('option');
	optionCustom.innerText = 'Custom';
	galleryCardEditorColourPresetBox.appendChild(optionCustom);

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

galleryCardEditorImageSelectButton.addEventListener('click', () => galleryCardEditorImageFile.click());

galleryCardEditorImageFile.addEventListener('change', async () => {
	if (galleryCardEditorImageFile.files?.length != 1) return;
	const originalImage = await createImageBitmap(galleryCardEditorImageFile.files[0]);
	var blob = <Blob> galleryCardEditorImageFile.files[0];
	if (originalImage.width > 635 || originalImage.height > 885) {
		// The entire image will be stored in local storage as a data URI, so downscale larger images.
		var width = originalImage.width, height = originalImage.height;
		const ratio1 = 635 / width, ratio2 = 885 / height;
		if (ratio1 < ratio2) {
			width = 635;
			height *= ratio1;
		} else {
			height = 885;
			width *= ratio2;
		}
		const canvas = new OffscreenCanvas(width, height);
		const ctx = canvas.getContext('2d')!;
		ctx.drawImage(originalImage, 0, 0, width, height);
		blob = await canvas.convertToBlob({ type: 'image/webp' });
	}

	// Load image data from the original file or rescaled blob and store it in a data URI.
	const url = await new Promise<string>((resolve, _) => {
		const reader = new FileReader();
		reader.onloadend = () => resolve(<string> reader.result);
		reader.readAsDataURL(blob);
	});

	const display = galleryCardDisplay!;
	var image = (<SVGImageElement | undefined> display.element.getElementsByClassName('cardArt')[0]);
	if (!image) {
		const grid = display.svg.getElementsByClassName('cardGrid')[0];

		image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
		image.setAttribute('class', 'cardArt');
		image.setAttribute('width', '100%');
		image.setAttribute('height', '100%');
		display.svg.insertBefore(image, grid);
	}
	image.setAttribute('href', url);
});

galleryCardEditorImageClearButton.addEventListener('click', async () => {
	const display = galleryCardDisplay!;
	const image = <SVGImageElement | undefined> display.svg.getElementsByClassName('cardArt')[0];
	if (image) display.svg.removeChild(image);
});


galleryCardEditorRarityBox.addEventListener('change', () => {
	const display = galleryCardDisplay!;
	display.element.classList.remove('common');
	display.element.classList.remove('rare');
	display.element.classList.remove('fresh');
	display.element.classList.add(Rarity[parseInt(galleryCardEditorRarityBox.value)].toLowerCase());

	const sizeImage = <SVGImageElement> display.svg.getElementsByClassName('cardSizeBackground')[0];
	sizeImage.setAttribute('href', `assets/external/Game Assets/CardCost_0${galleryCardEditorRarityBox.value}.png`);

	const backgroundImage = <SVGImageElement> display.svg.getElementsByClassName('cardDisplayBackground')[0];
	backgroundImage.setAttribute('href', `assets/external/CardBackground-custom-${galleryCardEditorRarityBox.value}-1.webp`);
});

galleryCardEditorColour1.addEventListener('change', galleryCardEditorColour_change);
galleryCardEditorColour2.addEventListener('change', galleryCardEditorColour_change);

function galleryCardEditorColour_change() {
	const display = galleryCardDisplay!;
	const filters = display.svg.getElementsByClassName('inkFilter');
	const selectedColours = [];

	for (let i = 0; i < 2; i++) {
		const value = [galleryCardEditorColour1, galleryCardEditorColour2][i].value;
		const colour = { r: parseInt(value.substring(1, 3), 16), g: parseInt(value.substring(3, 5), 16), b: parseInt(value.substring(5, 7), 16) };
		selectedColours.push(colour);
		filters[i].getElementsByTagName('feColorMatrix')[0].setAttribute('values', `${colour.r / 255} 0 0 0 0 0 ${colour.g / 255} 0 0 0 0 0 ${colour.b / 255} 0 0 0 0 0 0.88 0`)
	}
	updateSelectedPreset(selectedColours);
}

galleryCardEditorColourPresetBox.addEventListener('change', () => {
	const preset = colourPresets[galleryCardEditorColourPresetBox.value];
	if (!preset) return;

	galleryCardEditorColour1.value = `#${preset[0].r.toString(16).padStart(2, '0')}${preset[0].g.toString(16).padStart(2, '0')}${preset[0].b.toString(16).padStart(2, '0')}`;
	galleryCardEditorColour2.value = `#${preset[1].r.toString(16).padStart(2, '0')}${preset[1].g.toString(16).padStart(2, '0')}${preset[1].b.toString(16).padStart(2, '0')}`;
	galleryCardEditorColour_change();
});

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
	function parseColour(value: string) { return { r: parseInt(value.substring(1, 3), 16), g: parseInt(value.substring(3, 5), 16), b: parseInt(value.substring(5, 7), 16) }; }

	const isNew = galleryCardDisplay!.card.number == UNSAVED_CUSTOM_CARD_INDEX;
	const number = isNew ? CUSTOM_CARD_START - cardDatabase.customCards.length : galleryCardDisplay!.card.number;
	const lines = Card.wrapName(galleryCardEditorName.value);
	const card = new Card(number, galleryCardEditorName.value.replaceAll('\n', ' '), lines[0], lines[1], parseColour(galleryCardEditorColour1.value), parseColour(galleryCardEditorColour2.value),
		<Rarity> parseInt(galleryCardEditorRarityBox.value), customCardSpecialCost, Array.from(galleryCardEditorGridButtons, r => Array.from(r, b => parseInt(b.dataset.state!))));

	const image = <SVGImageElement | undefined> galleryCardDisplay!.svg.getElementsByClassName('cardArt')[0];
	if (image) card.imageUrl = image.href.baseVal;

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
