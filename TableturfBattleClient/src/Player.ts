interface Player {
	name: string;
	specialPoints: number;
	isReady: boolean;
	colour: Colour;
	specialColour: Colour;
	specialAccentColour: Colour;
	uiBaseColourIsSpecialColour?: boolean;
	sleeves: number;
	totalSpecialPoints: number;
	passes: number;
	gamesWon: number;
}

interface Colour {
	r: number;
	g: number;
	b: number;
}
