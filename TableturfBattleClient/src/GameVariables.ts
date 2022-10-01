/** A UUID used to identify the client. */
let clientToken = window.localStorage.getItem('clientToken') || '';
/** The data of the current game, or null if not in a game. */
let currentGame: {
	id: string,
	/** The list of players in the current game. May have empty slots. */
	players: (Player | null)[],
	/** The user's player data, or null if they are spectating. */
	me: {
		playerIndex: number,
		hand: Card[] | null,
		deck: Card[] | null,
		cardsUsed: number[]
	} | null,
	/** The WebSocket used for receiving game events, or null if not yet connected. */
	webSocket: WebSocket
} | null;

const playerList = document.getElementById('playerList')!;
const playerListItems: HTMLElement[] = [ ];

const canPlayCard = [ false, false, false, false ];
const canPlayCardAsSpecialAttack = [ false, false, false, false ];
