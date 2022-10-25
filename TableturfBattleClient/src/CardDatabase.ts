const cardDatabase = {
	cards: null as Card[] | null,
	get(number: number) {
		if (cardDatabase.cards == null) throw new Error('Card database not loaded');
		if (number <= 0 || number > cardDatabase.cards.length) throw new RangeError(`No card with number ${number}`);
		return cardDatabase.cards[number - 1];
	},
	loadAsync() {
		return new Promise<Card[]>((resolve, reject) => {
			if (cardDatabase.cards != null) {
				resolve(cardDatabase.cards);
				return;
			}
			const cardListRequest = new XMLHttpRequest();
			cardListRequest.open('GET', `${config.apiBaseUrl}/cards`);
			cardListRequest.addEventListener('load', e => {
				const cards = [ ];
				if (cardListRequest.status == 200) {
					const s = cardListRequest.responseText;
					const response = JSON.parse(s) as object[];
					for (const o of response) {
						cards.push(Card.fromJson(o));
					}
					cardDatabase.cards = cards;
					resolve(cards);
				} else {
					reject(new Error(`Error downloading card database: response was ${cardListRequest.status}`));
				}
			});
			cardListRequest.addEventListener('error', e => {
				reject(new Error('Error downloading card database: no further information.'))
			});
			cardListRequest.send();
		});
	}
}
