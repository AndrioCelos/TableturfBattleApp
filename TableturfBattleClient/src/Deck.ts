class Deck {
	name: string;
	cards: number[];
	isReadOnly: boolean;

	constructor(name: string, cards: number[], isReadOnly: boolean) {
		this.name = name;
		this.cards = cards;
		this.isReadOnly = isReadOnly;
	}

	get isValid() {
		if (!cardDatabase.cards) throw new Error('Card database must be loaded to validate decks.');
		if (this.cards.length != 15) return false;
		for (let i = 0; i < 15; i++) {
			if (this.cards[i] <= 0 || this.cards[i] > cardDatabase.cards.length) return false;
			if (this.cards.indexOf(this.cards[i], i + 1) >= 0) return false;  // Duplicate cards
		}
		return true;
	}
}
