/** A UUID used to identify the client. */
let clientToken = window.localStorage.getItem('clientToken') || '';
/** The data of the current game, or null if not in a game. */
let currentGame: {
	id: string,
	state: GameState,
	/** The list of players in the current game. */
	players: Player[],
	/** The maximum number of players in the game. */
	maxPlayers: number,
	/** The user's player data, or null if they are spectating. */
	me: PlayerData | null,
	turnNumber: number,
	turnTimeLimit: number | null,
	turnTimeLeft: number | null,
	goalWinCount: number | null,
	/** The WebSocket used for receiving game events, or null if not yet connected. */
	webSocket: WebSocket | null
} | null = null;

let enterGameTimeout: number | null = null;
let currentReplay: {
	gameNumber: number,
	games: {
		stage: Stage,
		playerData: {
			deck: Card[],
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
