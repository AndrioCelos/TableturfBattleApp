class SavedDeck {
	name: string;
	sleeves: number;
	cards: number[];
	upgrades: number[];
	isReadOnly?: boolean;

	constructor(name: string, sleeves: number, cards: number[], upgrades: number[], isReadOnly: boolean) {
		this.name = name;
		this.sleeves = sleeves;
		this.cards = cards;
		this.upgrades = upgrades;
		this.isReadOnly = isReadOnly;
	}

	get isValid() {
		if (!cardDatabase.cards) throw new Error('Card database must be loaded to validate decks.');
		if (this.cards.length != 15) return false;
		for (let i = 0; i < 15; i++) {
			if (!cardDatabase.isValidCardNumber(this.cards[i])) return false;
			if (this.cards.indexOf(this.cards[i], i + 1) >= 0) return false;  // Duplicate cards
		}
		return true;
	}
}

class Deck {
	name: string;
	sleeves: number;
	cards: Card[];
	upgrades: number[];

	constructor(name: string, sleeves: number, cards: Card[], upgrades: number[]) {
		this.name = name;
		this.sleeves = sleeves;
		this.cards = cards;
		this.upgrades = upgrades;
	}
}
