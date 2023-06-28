function getCardListFromImageBitmap(bitmap: ImageBitmap) {
	if (!cardDatabase.cards) throw new Error('Card database is not yet initialised.');

	const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
	const ctx = canvas.getContext('2d')!;
	ctx.drawImage(bitmap, 0, 0);
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

	function getR(x: number, y: number) { return imageData.data[(y * imageData.width + x) * 4]; }
	function getG(x: number, y: number) { return imageData.data[(y * imageData.width + x) * 4 + 1]; }
	function getB(x: number, y: number) { return imageData.data[(y * imageData.width + x) * 4 + 2]; }
	function getA(x: number, y: number) { return imageData.data[(y * imageData.width + x) * 4 + 3]; }

	const cards = [ ];
	for (let i = 0; i < 15; i++) {
		const cx = i % 3, cy = Math.floor(i / 3);
		const grid: Space[][] = [ ];
		for (let x = 0; x < 8; x++) {
			const col = [ ];
			for (let y = 0; y < 8; y++) {
				const px = Math.round(imageData.width * (0.0760416667 + 0.0623372396 * cx + 0.0065476190 * x));
				const py = Math.round(imageData.height * (0.2342592593 + 0.1521122685 * cy + 0.0116931217 * y));
				if (getR(px, py) >= 224)
					col.push(getG(px, py) >= 224 ? Space.Ink1 : Space.SpecialInactive1);
				else
					col.push(Space.Empty);
			}
			grid.push(col);
		}

		// Find the card with this pattern.
		function cardMatches(card: Card) {
			for (let x = 0; x < 8; x++) {
				for (let y = 0; y < 8; y++) {
					if (card.grid[x][y] != grid[x][y]) return false;
				}
			}
			return true;
		}
		const card = cardDatabase.cards.find(cardMatches);
		if (!card) throw new Error(`Card number ${i + 1} is unknown.`);
		cards.push(card.number);
	}
	return cards;
}
