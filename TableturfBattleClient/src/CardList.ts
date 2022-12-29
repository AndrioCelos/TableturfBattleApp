class CardList {
	readonly listElement: HTMLElement;
	readonly sortBox: HTMLSelectElement;
	readonly cardButtons: CardButton[] = [ ];

	static readonly cardSortOrders: { [key: string]: ((a: Card, b: Card) => number) | undefined } = {
		'number': (a, b) => a.number - b.number,
		'name': (a, b) => a.name.localeCompare(b.name),
		'size': (a, b) => a.size != b.size ? a.size - b.size : a.number - b.number,
		'rarity': (a, b) => a.rarity != b.rarity ? a.rarity - b.rarity : a.number - b.number,
	}

	constructor(listElement: HTMLElement, sortBox: HTMLSelectElement) {
		this.listElement = listElement;
		this.sortBox = sortBox;

		sortBox.addEventListener('change', () => {
			const sortOrder = CardList.cardSortOrders[sortBox.value];
			if (sortOrder) {
				clearChildren(listElement);
				this.cardButtons.sort((a, b) => sortOrder(a.card, b.card));
				for (const button of this.cardButtons)
					listElement.appendChild(button.element);
			}
		});

		for (const label in CardList.cardSortOrders) {
			const option = document.createElement('option');
			option.value = label;
			option.innerText = label;
			sortBox.appendChild(option);
		}
	}

	static fromId(id: string, sortBoxId: string) { return new CardList(document.getElementById(id)!, document.getElementById(sortBoxId) as HTMLSelectElement); }

	add(button: CardButton) {
		this.cardButtons.push(button);
		this.listElement.appendChild(button.element);
	}
}
