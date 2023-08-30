class CardList {
	readonly listElement: HTMLElement;
	readonly sortBox: HTMLSelectElement;
	readonly filterBox: HTMLInputElement;
	readonly cardButtons: CardButton[] = [ ];

	static readonly cardSortOrders: { [key: string]: (a: Card, b: Card) => number } = {
		'number': (a, b) => compareCardNumbers(a.number, b.number),
		'name': (a, b) => a.name.localeCompare(b.name),
		'size': (a, b) => a.size != b.size ? a.size - b.size : compareCardNumbers(a.number, b.number),
		'rarity': (a, b) => a.rarity != b.rarity ? a.rarity - b.rarity : compareCardNumbers(a.number, b.number),
	}

	constructor(listElement: HTMLElement, sortBox: HTMLSelectElement, filterBox: HTMLInputElement) {
		this.listElement = listElement;
		this.sortBox = sortBox;
		this.filterBox = filterBox;

		sortBox.addEventListener('change', () => {
			const sortOrder = CardList.cardSortOrders[sortBox.value];
			if (sortOrder) {
				clearChildren(listElement);
				this.cardButtons.sort((a, b) => sortOrder(a.card, b.card));
				for (const button of this.cardButtons)
					listElement.appendChild(button.buttonElement);
			}
		});

		filterBox.addEventListener('input', () => {
			const s = filterBox.value.toLowerCase();
			for (const button of this.cardButtons)
				button.buttonElement.hidden = s != '' && !button.card.name.toLowerCase().includes(s);
		});

		for (const label in CardList.cardSortOrders) {
			const option = document.createElement('option');
			option.value = label;
			option.innerText = label;
			sortBox.appendChild(option);
		}
	}

	static fromId(id: string, sortBoxId: string, filterBoxId: string) {
		return new CardList(document.getElementById(id)!, document.getElementById(sortBoxId) as HTMLSelectElement, document.getElementById(filterBoxId) as HTMLInputElement);
	}

	add(button: CardButton) {
		this.cardButtons.push(button);
		this.listElement.appendChild(button.buttonElement);
	}

	clearFilter() {
		this.filterBox.value = '';
		for (const button of this.cardButtons)
			button.buttonElement.hidden = false;
	}
}

function compareCardNumbers(a: number, b: number) {
	// Sort upcoming cards after released cards.
	return a >= 0 ? (b >= 0 ? a - b : -1) : (b >= 0 ? 1 : b - a);
}
