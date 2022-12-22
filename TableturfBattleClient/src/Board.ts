class Board {
	table: HTMLTableElement;
	grid: Space[][] = [ ];
	cells: HTMLTableCellElement[][] = [ ];

	playerIndex: number | null = 0;
	cardPlaying: Card | null = null;
	cardRotation = 0;
	specialAttack = false;

	autoHighlight = true;
	touchscreenMode = false;

	highlightX = NaN;
	highlightY = NaN;
	private highlightedCells: [x: number, y: number][] = [ ];
	private touch: [index: number, x: number, y: number, highlightX: number, highlightY: number] | null = null;

	startSpaces: { x: number, y: number }[] = [ ];

	onclick: ((x: number, y: number) => void) | null = null;
	oncancel: (() => void) | null = null;

	constructor(table: HTMLTableElement) {
		const boardSection = table.parentElement;

		this.table = table;
		table.addEventListener('mouseleave', _ => {
			if (this.autoHighlight) this.clearHighlight()
		});
		table.addEventListener('keydown', e => {
			if (this.autoHighlight) {
				switch (e.key) {
					case 'r':
						this.moveHighlight((x, y, r) => [x, y, r + 1], false);
						break;
					case 'R':
						this.moveHighlight((x, y, r) => [x, y, r - 1], false);
						break;
					case 'ArrowUp':
						this.moveHighlight((x, y, r) => [x, y - 1, r], true);
						break;
					case 'ArrowDown':
						this.moveHighlight((x, y, r) => [x, y + 1, r], true);
						break;
					case 'ArrowLeft':
						this.moveHighlight((x, y, r) => [x - 1, y, r], true);
						break;
					case 'ArrowRight':
						this.moveHighlight((x, y, r) => [x + 1, y, r], true);
						break;
					case 'Enter': case ' ':
						if (this.onclick)
							this.onclick(this.highlightX, this.highlightY);
						break;
					case 'Escape': case 'Backspace':
						if (this.oncancel)
							this.oncancel();
						break;
				}
			}
		});
		table.addEventListener('touchstart', e => {
			this.touchscreenMode = true;
			if (this.playerIndex == null) return;
			if (this.touch == null) {
				const touch = e.changedTouches[0];
				if (isNaN(this.highlightX) || isNaN(this.highlightY) || isNaN(this.cardRotation)) {
					const startSpace = this.startSpaces[this.playerIndex];
					this.highlightX = startSpace.x - 3;
					this.highlightY = startSpace.y - 3;
					this.cardRotation = 0;
					this.refreshHighlight();
				}
				this.touch = [touch.identifier, touch.pageX, touch.pageY, this.highlightX, this.highlightY];
			}
		});
		table.addEventListener('touchmove', e => {
			if (this.playerIndex == null) return;
			if (this.touch != null) {
				const touch = Array.from(e.changedTouches).find(t => t.identifier == this.touch![0]);
				if (touch) {
					const dx = Math.round((touch.pageX - this.touch[1]) / 20);
					const dy = Math.round((touch.pageY - this.touch[2]) / 20);
					const x2 = this.touch[3] + dx;
					const y2 = this.touch[4] + dy;
					if (this.highlightX != x2 || this.highlightY != y2) {
						this.moveHighlight((x, y, r) => [x2, y2, r], true);
					}
					this.refreshHighlight();
				}
			}
		});
		table.addEventListener('touchend', e => {
			if (this.touch != null && Array.from(e.changedTouches).find(t => t.identifier == this.touch![0]))
				this.touch = null;
		});
		table.addEventListener('touchcancel', e => {
			if (this.touch != null && Array.from(e.changedTouches).find(t => t.identifier == this.touch![0]))
				this.touch = null;
		});
	}

	moveHighlight(move: (x: number, y: number, r: number) => [number, number, number], clamp: boolean) {
		if (this.playerIndex == null) return;
		if (this.highlightedCells.length == 0 || isNaN(this.highlightX) || isNaN(this.highlightY) || isNaN(this.cardRotation)) {
			const startSpace = this.startSpaces[this.playerIndex];
			[this.highlightX, this.highlightY, this.cardRotation] = [startSpace.x - 3, startSpace.y - 3, 0];
		} else {
			let [x, y, r] = move(this.highlightX, this.highlightY, this.cardRotation);
			let clampedPosition = clamp
				? this.cardPlaying!.clampPosition(x, y, this.grid.length, this.grid[0].length, r)
				: { x, y };
			[this.highlightX, this.highlightY, this.cardRotation] = [clampedPosition.x, clampedPosition.y, r];
		}
		this.refreshHighlight();
	}

	checkMoveLegality(playerIndex: number, card: Card, x: number, y: number, rotation: number, isSpecialAttack: boolean): string | null {
		let isAnchored = false;
		for (let dx = 0; dx < 8; dx++) {
			for (let dy = 0; dy < 8; dy++) {
				if (card.getSpace(dx, dy, rotation) == Space.Empty)
					continue;
				var x2 = x + dx;
				var y2 = y + dy;
				if (x2 < 0 || x2 >= this.grid.length || y2 < 0 || y2 >= this.grid[x2].length)
					return "It cannot overlap a wall or out of bounds.";  // Out of bounds.
				const space = this.grid[x2][y2];
				if (space == Space.Wall || space == Space.OutOfBounds)
					return "It cannot overlap a wall or out of bounds.";
				if (space >= Space.SpecialInactive1)
					return "It cannot overlap a special space."
				if (space != Space.Empty && !isSpecialAttack)
					return "It cannot overlap existing ink without a special attack.";
				if (!isAnchored) {
					// A normal play must be adjacent to ink of the player's colour.
					// A special attack must be adjacent to a special space of theirs.
					for (let dy2 = -1; dy2 <= 1; dy2++) {
						for (let dx2 = -1; dx2 <= 1; dx2++) {
							if (dx2 == 0 && dy2 == 0) continue;
							var x3 = x2 + dx2;
							var y3 = y2 + dy2;
							if (x3 < 0 || x3 >= this.grid.length || y3 < 0 || y3 >= this.grid[x3].length)
								continue;
							if (this.grid[x3][y3] >= (isSpecialAttack ? Space.SpecialInactive1 : Space.Ink1)
								&& ((this.grid[x3][y3]) & 3) == playerIndex) {
								isAnchored = true;
								break;
							}
						}
					}
				}
			}
		}
		return isAnchored ? null : (isSpecialAttack ? "It must be next to one of your special spaces." : "It must be next to your turf.");
	}

	refreshHighlight() {
		let legal = this.playerIndex == null || this.cardPlaying == null ? false
			: this.checkMoveLegality(this.playerIndex, this.cardPlaying, this.highlightX, this.highlightY, this.cardRotation, this.specialAttack) == null;

		this.clearHighlight();
		if (this.cardPlaying != null && this.playerIndex != null) {
			for (let dx = 0; dx < 8; dx++) {
				const x2 = this.highlightX + dx;
				if (x2 < 0 || x2 >= this.grid.length)
					continue;
				for (let dy = 0; dy < 8; dy++) {
					const y2 = this.highlightY + dy;
					if (y2 < 0 || y2 >= this.grid[x2].length || this.grid[x2][y2] == Space.OutOfBounds)
						continue;
					const space = this.cardPlaying.getSpace(dx, dy, this.cardRotation);
					if (space != Space.Empty) {
						const cell = this.cells[x2][y2];
						cell.classList.add('hover');
						cell.classList.add(`hover${this.playerIndex + 1}`);
						if (!legal)
							cell.classList.add('hoverillegal');
						if (space == Space.SpecialInactive1)
							cell.classList.add('hoverspecial');
						this.highlightedCells.push([x2, y2]);
					}
				}
			}
		}
	}

	clearHighlight() {
		for (const [x, y] of this.highlightedCells) {
			this.cells[x][y].setAttribute('class', Space[this.grid[x][y]] );
		}
		this.highlightedCells.splice(0);
	}

	resize(grid: Space[][]) {
		if (grid.length == 0)
			throw new Error('Grid must not be empty.');

		this.grid = grid || this.grid;

		clearChildren(this.table);
		this.cells.splice(0);
		this.highlightedCells.splice(0);

		const boardWidth = grid.length;
		const boardHeight = grid[0].length;

		this.table.style.setProperty('--board-width', boardWidth.toString());
		this.table.style.setProperty('--board-height', boardHeight.toString());

		const trs: HTMLTableRowElement[] = [ ];
		for (let y = 0; y < boardHeight; y++) {
			const tr = document.createElement('tr');
			trs.push(tr);
			this.table.appendChild(tr);
		}

		for (let x = 0; x < boardWidth; x++) {
			const col: HTMLTableCellElement[] = [ ];
			for (let y = 0; y < grid[x].length; y++) {
				const td = document.createElement('td');
				td.dataset.x = x.toString();
				td.dataset.y = y.toString();
				trs[y].appendChild(td);
				col.push(td);
				td.addEventListener('mousemove', e => {
					if (e.buttons == 0)
						this.touchscreenMode = false;
					if (!this.touchscreenMode) {
						if (this.autoHighlight && this.cardPlaying != null) {
							const x = parseInt((e.target as HTMLTableCellElement).dataset.x!) - 3;
							const y = parseInt((e.target as HTMLTableCellElement).dataset.y!) - 3;
							if (x != this.highlightX || y != this.highlightY) {
								this.highlightX = x;
								this.highlightY = y;
								this.refreshHighlight();
							}
						}
					}
				});
				td.addEventListener('click', e => {
					if (this.autoHighlight && this.cardPlaying != null && this.onclick) {
						if (this.touchscreenMode) {
							this.onclick(this.highlightX, this.highlightY);
						} else {
							const x = parseInt((e.target as HTMLTableCellElement).dataset.x!) - 3;
							const y = parseInt((e.target as HTMLTableCellElement).dataset.y!) - 3;
							this.onclick(x, y);
						}
					}
				});
				td.addEventListener('wheel', e => {
					if (this.autoHighlight && this.cardPlaying != null) {
						e.preventDefault();
						if (e.deltaY > 0) this.cardRotation++;
						else if (e.deltaY < 0) this.cardRotation--;
						this.refreshHighlight();
					}
				});
			}
			this.cells.push(col);
		}

		this.refresh();
	}

	refresh() {
		this.clearHighlight();
		for (let x = 0; x < this.grid.length; x++) {
			for (let y = 0; y < this.grid[x].length; y++) {
				this.cells[x][y].setAttribute('class', Space[this.grid[x][y]] );
			}
		}
	}

	getScore(playerIndex: number) {
		let count = 0;
		for (let x = 0; x < this.grid.length; x++) {
			for (let y = 0; y < this.grid[x].length; y++) {
				const space = this.grid[x][y];
				if (space >= Space.Ink1 && (space & 3) == playerIndex)
					count++;
			}
		}
		return count;
	}

	/**
	 * Returns a value indicating whether a specified player can play the specified card anywhere.
	 */
	canPlayCard(playerIndex: number, card: Card, isSpecialAttack: boolean) {
		for (let rotation = 0; rotation < 4; rotation++) {
			for (let x = -4; x < this.grid.length - 3; x++) {
				for (let y = -4; y < this.grid[0].length - 3; y++) {
					if (this.checkMoveLegality(playerIndex, card, x, y, rotation, isSpecialAttack) == null)
						return true;
				}
			}
		}
		return false;
	}
}
