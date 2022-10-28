interface Player {
	name: string;
	specialPoints: number;
	isReady: boolean;
	colour: Colour;
	specialColour: Colour;
	specialAccentColour: Colour;
	uiBaseColourIsSpecialColour?: boolean;
	totalSpecialPoints: number;
	passes: number;
}

interface Colour {
	r: number;
	g: number;
	b: number;
}
