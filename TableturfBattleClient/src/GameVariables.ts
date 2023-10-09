interface Game {
	state: GameState,
	/** The list of players in the current game. */
	players: Player[],
	/** The maximum number of players in the game. */
	maxPlayers: number,
	/** The current one-based turn number, or 0 if redraw decisions are being made. */
	turnNumber: number,
	/** The total turn time limit in seconds. */
	turnTimeLimit: number | null,
	/** The time remaining in the current turn in seconds. */
	turnTimeLeft: number | null,
	/** The number of game wins needed to win the set, or null if no goal win count is set. */
	goalWinCount: number | null,
}

/** A UUID used to identify the client. */
let clientToken = window.localStorage.getItem('clientToken') || '';
/** The data of the current game, or null if not in a game. */
let currentGame: {
	id: string,
	game: Game,
	/** The user's player data, or null if they are spectating. */
	me: PlayerData | null,
	/** The WebSocket used for receiving game events, or null if not yet connected. */
	webSocket: WebSocket | null
} | null = null;

let enterGameTimeout: number | null = null;
let currentReplay: {
	gameNumber: number,
	games: {
		stage: Stage,
		playerData: {
			deck: Deck,
			initialDrawOrder: number[],
			drawOrder: number[],
			won: boolean
		}[],
		turns: Move[][],
	}[],
	turns: Move[][],
	placements: PlacementResults[],
	watchingPlayer: number
} | null = null;

const playerList = document.getElementById('playerList')!;
const playerListItems: HTMLElement[] = [ ];

const canPlayCard = [ false, false, false, false ];
const canPlayCardAsSpecialAttack = [ false, false, false, false ];
