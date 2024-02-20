class Card {
	number: number;
	altNumber?: number | null;
	readonly name: string;
	readonly line1: string | null;
	readonly line2: string | null;
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
	private static textScaleCalculationContext: OffscreenCanvasRenderingContext2D | null = null;

	private static getTextScaleCalculationContext() {
		if (this.textScaleCalculationContext == null) {
			const canvas = new OffscreenCanvas(256, 256);
			this.textScaleCalculationContext = canvas.getContext("2d")!;
			this.textScaleCalculationContext.font = 'bold 72pt "Splatoon 1"';
		}
		return this.textScaleCalculationContext;
	}

	static wrapName(name: string): [line1: string | null, line2: string | null] {
		// If the user has entered manual line breaks, use those instead of auto-wrapping.
		const pos = name.indexOf('\n');
		if (pos >= 0)
			return [ name.substring(0, pos), name.substring(pos + 1) ];

		const ctx = Card.getTextScaleCalculationContext();
		const line1Width = ctx.measureText(name).width;
		if (line1Width <= 700)
			return [ null, null ];

		// We're going to break the line.
		let bestPos = 0; let bestWidth = Infinity;
		for (const m of name.matchAll(/[-\s]/g)) {
			const pos = m.index! + 1;
			const width = Math.max(ctx.measureText(name.substring(0, m[0] == ' ' ? pos - 1 : pos)).width, ctx.measureText(name.substring(pos)).width);
			if (width < bestWidth) {
				bestPos = pos;
				bestWidth = width;
			}
		}

		return bestPos > 0
			? [ name.substring(0, bestPos).trimEnd(), name.substring(bestPos) ]
			: [ null, null ];
	}

	constructor(number: number, name: string, line1: string | null, line2: string | null, inkColour1: Colour, inkColour2: Colour, rarity: Rarity, specialCost: number, grid: Space[][]) {
		this.number = number;
		this.name = name;
		this.line1 = line1;
		this.line2 = line2;
		this.inkColour1 = inkColour1;
		this.inkColour2 = inkColour2;
		this.rarity = rarity;
		this.specialCost = specialCost;
		this.grid = grid;

		let size = 0, minX = 3, minY = 3, maxX = 3, maxY = 3, hasSpecialSpace = false;
		for (let y = 0; y < 8; y++) {
			for (let x = 0; x < 8; x++) {
				if (grid[x][y] != Space.Empty) {
					size++;
					minX = Math.min(minX, x);
					minY = Math.min(minY, y);
					maxX = Math.max(maxX, x);
					maxY = Math.max(maxY, y);
					if (grid[x][y] == Space.SpecialInactive1)
						hasSpecialSpace = true;
				}
			}
		}
		this.size = size;
		this.minX = minX;
		this.minY = minY;
		this.maxX = maxX;
		this.maxY = maxY;
		if (!specialCost) {
			this.specialCost =
				size <= 3 ? 1
					: size <= 5 ? 2
						: size <= 8 ? 3
							: size <= 11 ? 4
								: size <= 15 ? 5
									: 6;
			if (!hasSpecialSpace && this.specialCost > 3)
				this.specialCost = 3;
		}

		const ctx = Card.getTextScaleCalculationContext();
		const line1Width = ctx.measureText(line1 ?? name).width;
		const line2Width = line2 != null ? ctx.measureText(line2).width : 0;
		const width = Math.max(line1Width, line2Width);
		this.textScale = width <= 700 ? 1 : 700 / width;
	}

	static fromJson(obj: any) {
		if (cardDatabase.cards && cardDatabase.isValidCardNumber(obj.number)) return cardDatabase.get(obj.number);
		const card = new Card(obj.number, obj.name, obj.line1, obj.line2, obj.inkColour1 ?? this.DEFAULT_INK_COLOUR_1, obj.inkColour2 ?? this.DEFAULT_INK_COLOUR_2, obj.rarity, obj.specialCost, obj.grid);
		card.altNumber = obj.altNumber ?? null;
		card.artFileName = obj.artFileName ?? null;
		card.imageUrl = obj.imageUrl ?? null;
		card.isVariantOf = obj.isVariantOf ?? null;
		return card;
	}

	isTheSameAs(jsonCard: Card) {
		if (this.name != jsonCard.name) return false;
		for (let x = 0; x < 8; x++) {
			for (let y = 0; y < 8; y++) {
				if (this.grid[x][y] != jsonCard.grid[x][y]) return false;
			}
		}
		return true;
	}

	get isCustom() { return this.number <= UNSAVED_CUSTOM_CARD_INDEX; }
	get isUpcoming() { return this.number < 0 && !this.isCustom; }
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
