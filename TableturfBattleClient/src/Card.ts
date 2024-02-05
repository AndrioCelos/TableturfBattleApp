class Card {
	number: number;
	altNumber?: number | null;
	name: string;
	line1?: string | null;
	line2?: string | null;
	artFileName?: string | null;
	imageUrl?: string;
	textScale: number;
	inkColour1: Colour;
	inkColour2: Colour;
	rarity: Rarity;
	specialCost: number;
	grid: Space[][];
	size: number;
	isVariantOf?: number | null;

	private minX: number;
	private minY: number;
	private maxX: number;
	private maxY: number;

	static DEFAULT_INK_COLOUR_1: Colour = { r: 116, g: 96, b: 240 };
	static DEFAULT_INK_COLOUR_2: Colour = { r: 224, g: 242, b: 104 };
	constructor(number: number, name: string, textScale: number, inkColour1: Colour, inkColour2: Colour, rarity: Rarity, specialCost: number, grid: Space[][]) {
		this.number = number;
		this.name = name;
		this.textScale = textScale;
		this.inkColour1 = inkColour1;
		this.inkColour2 = inkColour2;
		this.rarity = rarity;
		this.specialCost = specialCost;
		this.grid = grid;

		let size = 0, minX = 3, minY = 3, maxX = 3, maxY = 3;
		for (let y = 0; y < 8; y++) {
			for (let x = 0; x < 8; x++) {
				if (grid[x][y] != Space.Empty) {
					size++;
					minX = Math.min(minX, x);
					minY = Math.min(minY, y);
					maxX = Math.max(maxX, x);
					maxY = Math.max(maxY, y);
				}
			}
		}
		this.size = size;
		this.minX = minX;
		this.minY = minY;
		this.maxX = maxX;
		this.maxY = maxY;
	}

	static fromJson(obj: any) {
		if (cardDatabase.cards && cardDatabase.isValidCardNumber(obj.number)) return cardDatabase.get(obj.number);
		const card = new Card(obj.number, obj.name, obj.textScale ?? 1, obj.inkColour1 ?? this.DEFAULT_INK_COLOUR_1, obj.inkColour2 ?? this.DEFAULT_INK_COLOUR_2, obj.rarity, obj.specialCost, obj.grid);
		card.altNumber = obj.altNumber ?? null;
		card.line1 = obj.line1 ?? null;
		card.line2 = obj.line2 ?? null;
		card.artFileName = obj.artFileName ?? null;
		card.imageUrl = obj.imageUrl ?? null;
		card.isVariantOf = obj.isVariantOf ?? null;
		return card;
	}

	get isUpcoming() { return this.number < 0; }
	get isSpecialWeapon() { return this.specialCost == 3 && this.size == 12 };

	getSpace(x: number, y: number, rotation: number) {
		switch (rotation & 3) {
			case 0: return this.grid[x][y];
			case 1: return this.grid[y][7 - x];
			case 2: return this.grid[7 - x][7 - y];
			default: return this.grid[7 - y][x];
		}
	}

	clampPosition(x: number, y: number, boardWidth: number, boardHeight: number, rotation: number): Point {
		let x1, y1, x2, y2;
		switch (rotation & 3) {
			case 0: x1 = this.minX; y1 = this.minY; x2 = this.maxX; y2 = this.maxY; break;
			case 1: x1 = 7 - this.maxY; y1 = this.minX; x2 = 7 - this.minY; y2 = this.maxX; break;
			case 2: x1 = 7 - this.maxX; y1 = 7 - this.maxY; x2 = 7 - this.minX; y2 = 7 - this.minY; break;
			default: x1 = this.minY; y1 = 7 - this.maxX; x2 = this.maxY; y2 = 7 - this.minX; break;
		}
		x = Math.min(Math.max(x, -x1), boardWidth - 1 - x2);
		y = Math.min(Math.max(y, -y1), boardHeight - 1 - y2);
		return { x, y };
	}

	get inkAreaDimensions() { return { x: this.maxX - this.minX + 1, y: this.maxY - this.minY + 1 }; }
}
