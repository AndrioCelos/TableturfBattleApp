class CardList<T extends ICardElement> {
	readonly listElement: HTMLElement;
	readonly sortBox: HTMLSelectElement;
	readonly filterBox: HTMLInputElement;
	readonly cardButtons: T[] = [ ];

	static readonly cardSortOrders: { [key: string]: (a: Card, b: Card) => number } = {
		'number': (a, b) => CardList.compareByNumber(a, b),
		'name': (a, b) => CardList.compareByName(a, b),
		'size': (a, b) => CardList.compareBySize(a, b),
		'rarity': (a, b) => CardList.compareByRarity(a, b),
	}

	static compareCardNumbers(a: number, b: number) {
		// Sort upcoming cards after released cards.
		return a >= 0 ? (b >= 0 ? a - b : -1) : (b >= 0 ? 1 : b - a);
	}

	static compareByInGameSecondaryOrder(a: Card, b: Card) {
		// Keep variants and special weapons together.
		// TODO: There may be a better way to do this than hard-coding the first special weapon card number.
		const baseA = a.isVariantOf ?? (a.isSpecialWeapon ? 70 : a.number);
		const baseB = b.isVariantOf ?? (b.isSpecialWeapon ? 70 : b.number);
		if (baseA != baseB) return CardList.compareCardNumbers(baseA, baseB);

		// Sort by card number within each category.
		return CardList.compareCardNumbers(a.number, b.number);
	}

	static compareByNumber(a: Card, b: Card) { return CardList.compareCardNumbers(a.number, b.number); }
	static compareByName(a: Card, b: Card) { return a.name.localeCompare(b.name); }
	static compareBySize(a: Card, b: Card) { return a.size != b.size ? a.size - b.size : CardList.compareByInGameSecondaryOrder(a, b); }
	static compareByRarity(a: Card, b: Card) { return a.rarity != b.rarity ? b.rarity - a.rarity : CardList.compareByInGameSecondaryOrder(a, b); }

	constructor(listElement: HTMLElement, sortBox: HTMLSelectElement, filterBox: HTMLInputElement) {
		this.listElement = listElement;
		this.sortBox = sortBox;
		this.filterBox = filterBox;

		sortBox.addEventListener('change', this.updateSort.bind(this));

		filterBox.addEventListener('input', () => {
			const s = filterBox.value.toLowerCase();
			for (const button of this.cardButtons)
				button.element.hidden = s != '' && !button.card.name.toLowerCase().includes(s);
		});

		for (const label in CardList.cardSortOrders) {
			const option = document.createElement('option');
			option.value = label;
			option.innerText = label;
			sortBox.appendChild(option);
		}
	}

	private updateSort() {
		const sortOrder = CardList.cardSortOrders[this.sortBox.value];
		if (sortOrder) {
			clearChildren(this.listElement);
			this.cardButtons.sort((a, b) => sortOrder(a.card, b.card));
			for (const button of this.cardButtons)
				this.listElement.appendChild(button.element);
		}
	}

	static fromId<T extends ICardElement>(id: string, sortBoxId: string, filterBoxId: string) {
		return new CardList<T>(document.getElementById(id)!, document.getElementById(sortBoxId) as HTMLSelectElement, document.getElementById(filterBoxId) as HTMLInputElement);
	}

	add(button: T) {
		this.cardButtons.push(button);
		this.listElement.appendChild(button.element);
	}

	update(button: T, card: Card) {
		const i = this.cardButtons.findIndex(c => c.card.number == card.number);
		if (i < 0) throw new Error('The card to update was not found in the list.');
		const existingButton = this.cardButtons[i];
		this.cardButtons.splice(i, 1, button);
		this.listElement.replaceChild(button.element, existingButton.element);
	}

	remove(card: Card) {
		const i = this.cardButtons.findIndex(b => b.card.number == card.number);
		if (i < 0) return;
		this.listElement.removeChild(this.cardButtons[i].element);
		this.cardButtons.splice(i, 1);
	}

	removeAllCustomCards() {
		for (let i = this.cardButtons.length - 1; i >= 0; i--) {
			const button = this.cardButtons[i];
			if (button.card.number <= CUSTOM_CARD_START) {
				this.listElement.removeChild(button.element);
				this.cardButtons.splice(i, 1);
			}
		}
	}

	setSortOrder(sortOrder: string) {
		this.sortBox.value = sortOrder;
		this.updateSort();
	}

	clearFilter() {
		this.filterBox.value = '';
		for (const button of this.cardButtons)
			button.element.hidden = false;
	}
}
