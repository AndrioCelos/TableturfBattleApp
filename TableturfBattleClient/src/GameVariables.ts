/** A UUID used to identify the client. */
let clientToken = window.localStorage.getItem('clientToken') || '';
/** The data of the current game, or null if not in a game. */
let currentGame: {
	id: string,
	/** The list of players in the current game. */
	players: Player[],
	/** The maximum number of players in the game. */
	maxPlayers: number,
	/** The user's player data, or null if they are spectating. */
	me: PlayerData | null,
	turnNumber: number,
	/** The WebSocket used for receiving game events, or null if not yet connected. */
	webSocket: WebSocket | null
} | null = null;

let enterGameTimeout: number | null = null;
let currentReplay: {
	turns: Move[][],
	placements: { placements: Placement[], specialSpacesActivated: Point[] }[],
	initialDrawOrder: number[][],
	drawOrder: number[][]
} | null = null;

const playerList = document.getElementById('playerList')!;
const playerListItems: HTMLElement[] = [ ];

const canPlayCard = [ false, false, false, false ];
const canPlayCardAsSpecialAttack = [ false, false, false, false ];
