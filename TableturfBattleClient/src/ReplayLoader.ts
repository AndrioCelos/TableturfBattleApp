function loadReplay(base64: string) {
	if (stageDatabase.stages == null)
		throw new Error('Game data not loaded');

	base64 = base64.replaceAll('-', '+');
	base64 = base64.replaceAll('_', '/');
	const bytes = Base64.base64DecToArr(base64);
	const dataView = new DataView(bytes.buffer);
	const version = dataView.getUint8(0);
	const players = [ ];
	let goalWinCount = null;
	switch (version) {
		case 1: {
			const n = dataView.getUint8(1);
			const stage = stageDatabase.stages[n & 0x1F];
			const numPlayers = n >> 5;

			let pos = 2;
			const playerData = [ ];
			currentReplay = { gameNumber: 0, games: [ ], turns: [ ], placements: [ ], watchingPlayer: 0 };
			for (let i = 0; i < numPlayers; i++) {
				const len = dataView.getUint8(pos + 34);
				const player = {
					name: new TextDecoder().decode(new DataView(bytes.buffer, pos + 35, len)),
					specialPoints: 0,
					isReady: false,
					colour: { r: dataView.getUint8(pos + 0), g: dataView.getUint8(pos + 1), b: dataView.getUint8(pos + 2) },
					specialColour: { r: dataView.getUint8(pos + 3), g: dataView.getUint8(pos + 4), b: dataView.getUint8(pos + 5) },
					specialAccentColour: { r: dataView.getUint8(pos + 6), g: dataView.getUint8(pos + 7), b: dataView.getUint8(pos + 8) },
					uiBaseColourIsSpecialColour: false,
					sleeves: 0,
					totalSpecialPoints: 0,
					passes: 0,
					gamesWon: 0
				};
				players.push(player);

				const cards = [ ];
				const initialDrawOrder = [ ];
				const drawOrder = [ ];
				for (let j = 0; j < 15; j++) {
					cards.push(loadCardFromReplay(dataView, pos + 9 + j));
				}
				for (let j = 0; j < 2; j++) {
					initialDrawOrder.push(dataView.getUint8(pos + 24 + j) & 0xF);
					initialDrawOrder.push(dataView.getUint8(pos + 24 + j) >> 4 & 0xF);
				}
				for (let j = 0; j < 8; j++) {
					drawOrder.push(dataView.getUint8(pos + 26 + j) & 0xF);
					if (j == 7)
						player.uiBaseColourIsSpecialColour = (dataView.getUint8(pos + 26 + j) & 0x80) != 0;
					else
						drawOrder.push(dataView.getUint8(pos + 26 + j) >> 4 & 0xF);
				}
				playerData.push({ deck: new Deck("Deck", 0, cards, new Array(15)), initialDrawOrder, drawOrder, won: false });
				pos += 35 + len;
			}

			const turns = [ ];
			for (let i = 0; i < 12; i++) {
				const turn = [ ];
				for (let j = 0; j < numPlayers; j++) {
					const card = loadCardFromReplay(dataView, pos);
					const b = dataView.getUint8(pos + 1);
					const x = dataView.getInt8(pos + 2);
					const y = dataView.getInt8(pos + 3);
					if (b & 0x80)
						turn.push({ card, isPass: true, isTimeout: (b & 0x20) != 0 });
					else {
						const move: PlayMove = { card, isPass: false, isTimeout: (b & 0x20) != 0, x, y, rotation: b & 0x03, isSpecialAttack: (b & 0x40) != 0 };
						turn.push(move);
					}
					pos += 4;
				}
				turns.push(turn);
			}
			currentReplay.games.push({ stage, playerData, turns });
			break;
		}
		case 2: {
			const n = dataView.getUint8(1);
			const numPlayers = n & 0x0F;
			goalWinCount = n >> 4;
			if (goalWinCount == 0) goalWinCount = null;

			let pos = 2;
			currentReplay = { gameNumber: 0, games: [ ], turns: [ ], placements: [ ], watchingPlayer: 0 };
			for (let i = 0; i < numPlayers; i++) {
				const n2 = dataView.getUint8(pos + 9);
				const len = n2 & 0x7F;
				const player = {
					name: new TextDecoder().decode(new DataView(bytes.buffer, pos + 10, len)),
					specialPoints: 0,
					isReady: false,
					colour: { r: dataView.getUint8(pos + 0), g: dataView.getUint8(pos + 1), b: dataView.getUint8(pos + 2) },
					specialColour: { r: dataView.getUint8(pos + 3), g: dataView.getUint8(pos + 4), b: dataView.getUint8(pos + 5) },
					specialAccentColour: { r: dataView.getUint8(pos + 6), g: dataView.getUint8(pos + 7), b: dataView.getUint8(pos + 8) },
					uiBaseColourIsSpecialColour: (n2 & 0x80) != 0,
					sleeves: 0,
					totalSpecialPoints: 0,
					passes: 0,
					gamesWon: 0
				};
				players.push(player);
				pos += 10 + len;
			}

			while (pos < dataView.byteLength) {
				const stage = stageDatabase.stages[dataView.getUint8(pos + 0)];
				const playerData = [ ];
				pos++;
				for (let i = 0; i < numPlayers; i++) {
					const cards = [ ];
					const initialDrawOrder = [ ];
					const drawOrder = [ ];
					let won = false;
					for (let j = 0; j < 15; j++) {
						cards.push(loadCardFromReplay(dataView, pos + j));
					}
					for (let j = 0; j < 2; j++) {
						initialDrawOrder.push(dataView.getUint8(pos + 15 + j) & 0xF);
						initialDrawOrder.push(dataView.getUint8(pos + 15 + j) >> 4 & 0xF);
					}
					for (let j = 0; j < 8; j++) {
						drawOrder.push(dataView.getUint8(pos + 17 + j) & 0xF);
						if (j == 7)
							won = (dataView.getUint8(pos + 17 + j) & 0x80) != 0;
						else
							drawOrder.push(dataView.getUint8(pos + 17 + j) >> 4 & 0xF);
					}
					playerData.push({ deck: new Deck("Deck", 0, cards, new Array(15)), initialDrawOrder, drawOrder, won });
					pos += 25;
				}
				const turns = replayLoadTurns(dataView, numPlayers, pos);
				pos += 48 * numPlayers;
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
	setUrl(`replay/${encodeToUrlSafeBase64(bytes)}`)
	initReplay();
}

function replayLoadTurns(dataView: DataView, numPlayers: number, pos: number) {
	const turns = [ ];
	for (let i = 0; i < 12; i++) {
		const turn = [ ];
		for (let j = 0; j < numPlayers; j++) {
			const card = loadCardFromReplay(dataView, pos);
			const b = dataView.getUint8(pos + 1);
			const x = dataView.getInt8(pos + 2);
			const y = dataView.getInt8(pos + 3);
			if (b & 0x80)
				turn.push({ card, isPass: true, isTimeout: (b & 0x20) != 0 });
			else {
				const move: PlayMove = { card, isPass: false, isTimeout: (b & 0x20) != 0, x, y, rotation: b & 0x03, isSpecialAttack: (b & 0x40) != 0 };
				turn.push(move);
			}
			pos += 4;
		}
		turns.push(turn);
	}
	return turns;
}

function loadCardFromReplay(dataView: DataView, index: number) { return cardDatabase.get(dataView.getUint8(index) > cardDatabase.lastOfficialCardNumber ? dataView.getInt8(index) : dataView.getUint8(index)); }
