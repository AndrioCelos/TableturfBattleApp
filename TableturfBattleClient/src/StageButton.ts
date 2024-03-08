class StageButton extends CheckButton {
	private static idNumber = 0;

	readonly stage: Stage;
	readonly cells: (SVGRectElement | null)[][];
	private readonly startCells: [SVGRectElement, SVGImageElement][] = [ ];

	constructor(stage: Stage) {
		let button = document.createElement('button');
		button.type = 'button';
		button.classList.add('stage');
		super(button);

		const gridSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		gridSvg.classList.add('stageGrid');
		gridSvg.setAttribute('viewBox', `0 0 ${stage.grid.length * 100} 3000`);

		const offset = (3000 - stage.grid[0].length * 100) / 2;

		this.stage = stage;

		const cols = [ ];
		for (var x = 0; x < stage.grid.length; x++) {
			let col = [ ];
			for (var y = 0; y < stage.grid[x].length; y++) {
				if (stage.grid[x][y] == Space.OutOfBounds)
					col.push(null);
				else {
					const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
					rect.classList.add(Space[stage.grid[x][y]].toString());
					rect.setAttribute('x', (100 * x).toString());
					rect.setAttribute('y', (100 * y + offset).toString());
					rect.setAttribute('width', '100');
					rect.setAttribute('height', '100');
					gridSvg.appendChild(rect);
					col.push(rect);

					if (stage.grid[x][y] & Space.SpecialInactive1) {
						const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
						image.setAttribute('href', 'assets/SpecialOverlay.webp');
						image.setAttribute('x', rect.getAttribute('x')!);
						image.setAttribute('y', rect.getAttribute('y')!);
						image.setAttribute('width', rect.getAttribute('width')!);
						image.setAttribute('height', rect.getAttribute('height')!);
						gridSvg.appendChild(image);
					} else if (stage.grid[x][y] & Space.Ink1) {
						const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
						image.setAttribute('href', 'assets/InkOverlay.webp');
						image.setAttribute('x', rect.getAttribute('x')!);
						image.setAttribute('y', rect.getAttribute('y')!);
						image.setAttribute('width', rect.getAttribute('width')!);
						image.setAttribute('height', rect.getAttribute('height')!);
						gridSvg.appendChild(image);
					}
				}
			}
			cols.push(col);
		}
		this.cells = cols;

		let el = document.createElement('div');
		el.classList.add('stageName');
		el.innerText = stage.name;
		button.appendChild(el);
		button.appendChild(gridSvg);

		StageButton.idNumber++;
	}

	setStartSpaces(numPlayers: number) {
		for (const el of this.startCells) {
			el[0].setAttribute('class', 'Empty');
			el[1].parentElement!.removeChild(el[1]);
		}
		this.startCells.splice(0);

		const startSpaces = this.stage.getStartSpaces(numPlayers);
		if (startSpaces == null) return;
		for (let i = 0; i < numPlayers; i++) {
			const space = startSpaces[i];
			const cell = this.cells[space.x][space.y]!;
			cell.setAttribute('class', `SpecialInactive${i + 1}`);

			const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
			image.setAttribute('href', 'assets/SpecialOverlay.webp');
			image.setAttribute('x', cell.getAttribute('x')!);
			image.setAttribute('y', cell.getAttribute('y')!);
			image.setAttribute('width', cell.getAttribute('width')!);
			image.setAttribute('height', cell.getAttribute('height')!);
			cell.parentElement!.appendChild(image);

			this.startCells.push([cell, image]);
		}
	}
}
