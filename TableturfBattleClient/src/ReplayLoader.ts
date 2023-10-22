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
						cards.push(this.readCard());
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

				const turns = this.readTurns(numPlayers);
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
							cards.push(this.readCard());
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
					const turns = this.readTurns(numPlayers);
					currentReplay.games.push({ stage, playerData, turns });
				}
				break;
			}
			case 3: {
				const n = this.readUint8();
				const numPlayers = n & 0x0F;
				goalWinCount = n >> 4;
				if (goalWinCount == 0) goalWinCount = null;

				currentReplay = { gameNumber: 0, decks: [ ], games: [ ], turns: [ ], placements: [ ], watchingPlayer: 0 };
				this.readPlayers(numPlayers, players);

				// Decks
				const decks = [ ];
				const numDecks = this.read7BitEncodedInt();
				for (let i = 0; i < numDecks; i++) {
					const name = this.readString();
					const sleeves = this.readUint8();
					const cards = [ ];
					for (let i = 0; i < 15; i++) cards.push(this.readCard());
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
					const turns = this.readTurns(numPlayers);
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
				goalWinCount: goalWinCount
			},
			me: null,
			webSocket: null
		};

		loadPlayers(players);
		setUrl(`replay/${encodeToUrlSafeBase64(this.byteArray)}`)
		initReplay();
	}

	private readUint8() { return this.dataView.getUint8(this.pos++); }
	private readInt8() { return this.dataView.getInt8(this.pos++); }
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

	private readTurns(numPlayers: number) {
		const turns = [ ];
		for (let i = 0; i < 12; i++) {
			const turn = [ ];
			for (let j = 0; j < numPlayers; j++) {
				const card = this.readCard();
				const b = this.readUint8();
				const x = this.readInt8();
				const y = this.readInt8();
				if (b & 0x80)
					turn.push({ card, isPass: true, isTimeout: (b & 0x20) != 0 });
				else {
					const move: PlayMove = { card, isPass: false, isTimeout: (b & 0x20) != 0, x, y, rotation: b & 0x03, isSpecialAttack: (b & 0x40) != 0 };
					turn.push(move);
				}
			}
			turns.push(turn);
		}
		return turns;
	}

	private readCard() {
		const num = this.readUint8();
		return cardDatabase.get(num > cardDatabase.lastOfficialCardNumber ? num - 256 : num);
	}
}
