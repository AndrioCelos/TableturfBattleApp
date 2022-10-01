const cardDatabase = {
	cards: null as Card[] | null,
	loadAsync() {
		return new Promise<Card[]>((resolve, reject) => {
			if (cardDatabase.cards != null) {
				resolve(cardDatabase.cards);
				return;
			}
			const cardListRequest = new XMLHttpRequest();
			cardListRequest.open('GET', 'http://localhost:3333/api/cards');
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
