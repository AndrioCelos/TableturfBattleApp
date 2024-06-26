class ReplayLoader {
	private readonly byteArray: Uint8Array;
	private readonly dataView: DataView;
	private pos = 0;

	constructor(base64: string) {
		base64 = base64.replaceAll('-', '+');
		base64 = base64.replaceAll('_', '/');
		this.byteArray = Base64.base64DecToArr(base64);
		this.dataView = new DataView(this.byteArray.buffer);
	}

	loadReplay() {
		if (stageDatabase.stages == null)
			throw new Error('Game data not loaded');

		const version = this.readUint8();
		const players: Player[] = [ ];
		const customCards: Card[] = [ ];
		let goalWinCount = null;
		switch (version) {
			case 1: {
				const n = this.readUint8();
				const stage = stageDatabase.stages[n & 0x1F];
				const numPlayers = n >> 5;

				const playerData = [ ];
				currentReplay = { gameNumber: 0, decks: [ ], games: [ ], turns: [ ], placements: [ ], watchingPlayer: 0 };
				for (let i = 0; i < numPlayers; i++) {
					const colour = this.readColour();
					const specialColour = this.readColour();
					const specialAccentColour = this.readColour();
					let uiBaseColourIsSpecialColour = false;

					const cards = [ ];
					const initialDrawOrder = [ ];
					const drawOrder = [ ];
					for (let j = 0; j < 15; j++) {
						cards.push(this.readCard(version, customCards));
					}
					for (let j = 0; j < 2; j++) {
						const n = this.readUint8();
						initialDrawOrder.push(n & 0xF);
						initialDrawOrder.push(n >> 4 & 0xF);
					}
					for (let j = 0; j < 8; j++) {
						const n = this.readUint8();
						drawOrder.push(n & 0xF);
						if (j == 7)
							uiBaseColourIsSpecialColour = (n & 0x80) != 0;
						else
							drawOrder.push(n >> 4 & 0xF);
					}

					const player = {
						name: this.readString(),
						specialPoints: 0,
						isReady: false,
						isOnline: true,
						colour,
						specialColour,
						specialAccentColour,
						uiBaseColourIsSpecialColour,
						sleeves: 0,
						totalSpecialPoints: 0,
						passes: 0,
						gamesWon: 0
					};
					players.push(player);
					playerData.push({ deck: new Deck("Deck", 0, cards, new Array(15).fill(1)), initialDrawOrder, drawOrder, won: false });
				}

				const turns = this.readTurns(numPlayers, version, customCards);
				currentReplay.games.push({ stage, playerData, turns });
				break;
			}
			case 2: {
				const n = this.readUint8();
				const numPlayers = n & 0x0F;
				goalWinCount = n >> 4;
				if (goalWinCount == 0) goalWinCount = null;

				currentReplay = { gameNumber: 0, decks: [ ], games: [ ], turns: [ ], placements: [ ], watchingPlayer: 0 };
				this.readPlayers(numPlayers, players);

				while (this.pos < this.dataView.byteLength) {
					const stage = stageDatabase.stages[this.readUint8()];
					const playerData = [ ];
					for (let i = 0; i < numPlayers; i++) {
						const cards = [ ];
						const initialDrawOrder = [ ];
						const drawOrder = [ ];
						let won = false;
						for (let j = 0; j < 15; j++) {
							cards.push(this.readCard(version, customCards));
						}
						for (let j = 0; j < 2; j++) {
							const n = this.readUint8();
							initialDrawOrder.push(n & 0xF);
							initialDrawOrder.push(n >> 4 & 0xF);
						}
						for (let j = 0; j < 8; j++) {
							const n = this.readUint8();
							drawOrder.push(n & 0xF);
							if (j == 7)
								won = (n & 0x80) != 0;
							else
								drawOrder.push(n >> 4 & 0xF);
						}
						playerData.push({ deck: new Deck("Deck", 0, cards, new Array(15).fill(1)), initialDrawOrder, drawOrder, won });
					}
					const turns = this.readTurns(numPlayers, version, customCards);
					currentReplay.games.push({ stage, playerData, turns });
				}
				break;
			}
			case 3: case 4: case 5: {
				const n = this.readUint8();
				const numPlayers = n & 0x0F;
				goalWinCount = n >> 4;
				if (goalWinCount == 0) goalWinCount = null;

				currentReplay = { gameNumber: 0, decks: [ ], games: [ ], turns: [ ], placements: [ ], watchingPlayer: 0 };
				this.readPlayers(numPlayers, players);

				// Custom cards
				if (version >= 4) {
					const numCustomCards = this.read7BitEncodedInt();
					for (let i = 0; i < numCustomCards; i++) {
						const line1 = this.readString();
						const line2 = this.readString();
						const name = line2 != '' ? `${line1} ${line2}` : line1;
						const b = this.readUint8();
						const rarity = <Rarity> b;
						const specialCost = this.readUint8();
						const inkColour1 = this.readColour();
						const inkColour2 = this.readColour();
						const grid = [ ];
						for (let x = 0; x < 8; x++) {
							const row = [ ];
							for (let y = 0; y < 8; y += 4) {
								const b = this.readUint8();
								row.push(<Space> ((b & 0x03) << 2));
								row.push(<Space> (b & 0x0c));
								row.push(<Space> ((b & 0x30) >> 2));
								row.push(<Space> ((b & 0xc0) >> 4));
							}
							grid.push(row);
						}
						const card = new Card(RECEIVED_CUSTOM_CARD_START - i, name, line1, line2 == '' ? null : line2, inkColour1, inkColour2, rarity, specialCost, grid);
						customCards.push(card);
					}
				}

				// Decks
				const decks = [ ];
				const numDecks = this.read7BitEncodedInt();
				for (let i = 0; i < numDecks; i++) {
					const name = this.readString();
					const sleeves = this.readUint8();
					const cards = [ ];
					for (let i = 0; i < 15; i++) cards.push(this.readCard(version, customCards));
					const upgrades = [ ];
					for (let i = 0; i < 4; i++) {
						const b = this.readUint8();
						upgrades.push(b & 3);
						upgrades.push(b >> 2 & 3);
						upgrades.push(b >> 4 & 3);
						if (i < 3) upgrades.push(b >> 6 & 3);
					}
					decks.push(new Deck(name, sleeves, cards, upgrades));
				}

				// Games
				while (this.pos < this.dataView.byteLength) {
					const stage = stageDatabase.stages[this.readUint8()];
					const playerData = [ ];
					for (let i = 0; i < numPlayers; i++) {
						const deck = decks[this.read7BitEncodedInt()];
						const initialDrawOrder = [ ];
						const drawOrder = [ ];
						let won = false;
						for (let j = 0; j < 2; j++) {
							const n = this.readUint8();
							initialDrawOrder.push(n & 0xF);
							initialDrawOrder.push(n >> 4 & 0xF);
						}
						for (let j = 0; j < 8; j++) {
							const n = this.readUint8();
							drawOrder.push(n & 0xF);
							if (j == 7)
								won = (n & 0x80) != 0;
							else
								drawOrder.push(n >> 4 & 0xF);
						}
						playerData.push({ deck, initialDrawOrder, drawOrder, won });
					}
					const turns = this.readTurns(numPlayers, version, customCards);
					currentReplay.games.push({ stage, playerData, turns });
				}
				break;
			}
			default:
				throw new RangeError('Unknown replay data version');
		}

		currentGame = {
			id: 'replay',
			game: {
				state: GameState.Redraw,
				players: players,
				maxPlayers: players.length,
				turnNumber: 0,
				turnTimeLimit: null,
				turnTimeLeft: null,
				goalWinCount: goalWinCount,
				allowUpcomingCards: true,
				allowCustomCards: true
			},
			me: null,
			isHost: false,
			webSocket: null
		};

		loadPlayers(players);
		setUrl(`replay/${encodeToUrlSafeBase64(this.byteArray)}`)
		initReplay();
	}

	private readUint8() { return this.dataView.getUint8(this.pos++); }
	private readInt8() { return this.dataView.getInt8(this.pos++); }
	private readInt16() {
		const v = this.dataView.getInt16(this.pos, true);
		this.pos += 2;
		return v;
	}
	private readColour(): Colour { return { r: this.readUint8(), g: this.readUint8(), b: this.readUint8() }; }
	private readString(length?: number) {
		length ??= this.read7BitEncodedInt();
		const s = new TextDecoder().decode(new DataView(this.byteArray.buffer, this.pos, length));
		this.pos += length;
		return s;
	}

	private read7BitEncodedInt() {
		let n = 0, shiftValue = 0;
		while (true) {
			const b = this.dataView.getUint8(this.pos);
			this.pos++;
			n += (b & 0x7F) << shiftValue;
			if ((b & 0x80) == 0) break;
			shiftValue += 7;
		}
		return n;
	}

	private readPlayers(numPlayers: number, players: Player[]) {
		for (let i = 0; i < numPlayers; i++) {
			const colour = this.readColour();
			const specialColour = this.readColour();
			const specialAccentColour = this.readColour();
			const n2 = this.readUint8();
			const len = n2 & 0x7F;
			const player = {
				name: this.readString(len),
				specialPoints: 0,
				isReady: false,
				isOnline: true,
				colour,
				specialColour,
				specialAccentColour,
				uiBaseColourIsSpecialColour: (n2 & 0x80) != 0,
				sleeves: 0,
				totalSpecialPoints: 0,
				passes: 0,
				gamesWon: 0
			};
			players.push(player);
		}
	}

	private readTurns(numPlayers: number, version: number, customCards: Card[]) {
		const turns = [ ];
		for (let i = 0; i < 12; i++) {
			const turn = [ ];
			for (let j = 0; j < numPlayers; j++) {
				const card = this.readCard(version, customCards);
				const b = this.readUint8();
				const x = this.readInt8();
				const y = this.readInt8();
				if (b & 0x80)
					turn.push({ card, isPass: true, isTimeout: (b & 0x20) != 0 });
				else {
					const move: PlayMove = { card, isPass: false, isTimeout: (b & 0x20) != 0, x, y, rotation: b & 0x03, isSpecialAttack: (b & 0x40) != 0 };
					if (version < 5 && card.number == 217) {
						// Heavy Edit Splatling: originally had the ink pattern transposed down one space
						switch (move.rotation) {
							case 0: move.y++; break;
							case 1: move.x--; break;
							case 2: move.y--; break;
							default: move.x++; break;
						}
					}
					turn.push(move);
				}
			}
			turns.push(turn);
		}
		return turns;
	}

	private readCard(version: number, customCards: Card[]) {
		if (version >= 4) {
			const num = this.readInt16();
			return num <= RECEIVED_CUSTOM_CARD_START ? customCards[RECEIVED_CUSTOM_CARD_START - num] : cardDatabase.get(num);
		} else {
			const num = this.readUint8();
			return cardDatabase.get(num > cardDatabase.lastOfficialCardNumber ? num - 256 : num);
		}
	}
}
