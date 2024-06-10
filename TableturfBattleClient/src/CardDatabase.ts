const cardDatabase = {
	/** The list of official cards, or null if the database has not yet been loaded. */
	cards: null as Card[] | null,
	/** The list of custom cards added by the user. */
	customCards: [ ] as Card[],
	/** The list of custom cards used in the current game that were not added by the user. */
	receivedCustomCards: [ ] as Card[],
	customCardsModified: false,
	/** The number of official cards, and the highest card number among official cards. */
	lastOfficialCardNumber: 0,

	_byAltNumber: [ ] as Card[],

	// Upcoming cards are identified with a negative number, as their actual numbers aren't known until their release.
	// The placeholder numbers will be kept as alternate numbers then, to avoid breaking replay and saved deck data that uses them.
	get(number: number) {
		if (cardDatabase.cards == null) throw new Error('Card database not loaded');
		if (number > 0) {
			number--;
			if (number < cardDatabase.lastOfficialCardNumber) return cardDatabase.cards[number];
		} else if (number <= RECEIVED_CUSTOM_CARD_START) {
			const card = cardDatabase.receivedCustomCards[RECEIVED_CUSTOM_CARD_START - number];
			if (card) return card;
		} else if (number <= CUSTOM_CARD_START) {
			const card = cardDatabase.customCards[CUSTOM_CARD_START - number];
			if (card) return card;
		} else if (number < 0) {
			const card = cardDatabase._byAltNumber[-number];
			if (card) return card;
		}
		throw new RangeError(`No card with number ${number}`);
	},
	isValidOfficialCardNumber(number: number) {
		return number > 0 ? number <= cardDatabase.lastOfficialCardNumber : cardDatabase._byAltNumber[-number] != undefined;
	},
	isValidCardNumber(number: number) {
		return number > 0 ? number <= cardDatabase.lastOfficialCardNumber
			: number <= RECEIVED_CUSTOM_CARD_START ? RECEIVED_CUSTOM_CARD_START - number < cardDatabase.receivedCustomCards.length
			: number <= CUSTOM_CARD_START ? CUSTOM_CARD_START - number < cardDatabase.customCards.length
			: cardDatabase._byAltNumber[-number] != undefined;
	},
	loadAsync() {
		return new Promise<Card[]>((resolve, reject) => {
			function afterFontLoaded() {
				if (cardDatabase.cards != null) {
					resolve(cardDatabase.cards);
					return;
				}
				const cardListRequest = new XMLHttpRequest();
				cardListRequest.open('GET', `${config.apiBaseUrl}/cards`);
				cardListRequest.addEventListener('load', e => {
					const cards: Card[] = [ ];
					if (cardListRequest.status == 200) {
						const s = cardListRequest.responseText;
						const response = JSON.parse(s) as object[];
						for (const o of response) {
							const card = Card.fromJson(o);
							cards.push(card);
							cardDatabase.lastOfficialCardNumber = Math.max(cardDatabase.lastOfficialCardNumber, card.number);
							if (card.number < 0) cardDatabase._byAltNumber[-card.number] = card;
							else if (card.altNumber != null && card.altNumber < 0) cardDatabase._byAltNumber[-card.altNumber] = card;
						}
						cardDatabase.cards = cards;

						if (window.location.protocol == 'file:') {
							// If debugging locally, just read the files from the assets directory.
							for (const card of cardDatabase.cards!) {
								card.imageUrl = `assets/external/card/${card.artFileName}.webp`
							}
							resolve(cards);
							return;
						}
						// Otherwise, download and extract card images from a .tar package.
						const imagesRequest = new XMLHttpRequest();
						imagesRequest.responseType = 'arraybuffer';
						imagesRequest.open('GET', 'assets/external/card.tar');
						imagesRequest.addEventListener('load', () => {
							if (imagesRequest.status == 200 && imagesRequest.response) {
								const buffer = imagesRequest.response as ArrayBuffer;
								untar(buffer).then(files => {
									for (const tarFile of files) {
										const card = cardDatabase.cards!.find(c => tarFile.name == `${c.artFileName}.webp`);
										if (!card) continue;
										card.imageUrl = tarFile.getBlobUrl();
									}
									resolve(cards);
								});
							} else {
								reject(new Error(`Error downloading card images: response was ${imagesRequest.status}`));
							}
						});
						imagesRequest.addEventListener('error', () => {
							reject(new Error('Error downloading card images: no further information.'))
						});
						imagesRequest.send();
					} else {
						reject(new Error(`Error downloading card database: response was ${cardListRequest.status}`));
					}
				});
				cardListRequest.addEventListener('error', e => {
					reject(new Error('Error downloading card database: no further information.'))
				});
				cardListRequest.send();
			}

			// Preload the font first; calculating text scale depends on this.
			const link = document.createElement('link');
			link.rel = 'preload';
			link.href = 'assets/external/splatoon1.woff2';
			link.as = 'font';
			link.type = 'font/woff';
			link.crossOrigin = '';
			link.addEventListener('load', afterFontLoaded);
			link.addEventListener('error', afterFontLoaded);
			document.head.appendChild(link);
		});
	}
}
