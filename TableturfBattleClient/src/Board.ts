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
	flip = false;

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
						this.moveHighlight((x, y, r) => [x, y + (this.flip ? 1 : -1), r], true);
						break;
					case 'ArrowDown':
						this.moveHighlight((x, y, r) => [x, y + (this.flip ? -1 : 1), r], true);
						break;
					case 'ArrowLeft':
						this.moveHighlight((x, y, r) => [x + (this.flip ? 1 : -1), y, r], true);
						break;
					case 'ArrowRight':
						this.moveHighlight((x, y, r) => [x + (this.flip ? -1 : 1), y, r], true);
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
					this.highlightX = startSpace.x - (this.flip ? 4 : 3);
					this.highlightY = startSpace.y - (this.flip ? 4 : 3);
					this.cardRotation = this.flip ? 2 : 0;
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
					const x2 = this.touch[3] + (this.flip ? -dx : dx);
					const y2 = this.touch[4] + (this.flip ? -dy : dy);
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
			[this.highlightX, this.highlightY, this.cardRotation] = [startSpace.x - (this.flip ? 4 : 3), startSpace.y - (this.flip ? 4 : 3), 0];
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
					if (y2 < 0 || y2 >= this.grid[x2].length)
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

	resize(grid?: Space[][]) {
		if (grid) this.grid = grid;

		clearChildren(this.table);
		this.cells.splice(0);
		this.highlightedCells.splice(0);

		const boardWidth = this.grid.length;
		const boardHeight = this.grid[0].length;

		this.table.style.setProperty('--board-width', boardWidth.toString());
		this.table.style.setProperty('--board-height', boardHeight.toString());

		for (let x = 0; x < boardWidth; x++) {
			const col: HTMLTableCellElement[] = [ ];
			for (let y = 0; y < this.grid[x].length; y++) {
				const td = document.createElement('td');
				td.dataset.x = x.toString();
				td.dataset.y = y.toString();
				col.push(td);
				td.addEventListener('click', e => {
					if (this.autoHighlight && this.cardPlaying != null && this.onclick) {
						if (this.touchscreenMode) {
							this.onclick(this.highlightX, this.highlightY);
						} else {
							const x = parseInt((e.target as HTMLTableCellElement).dataset.x!) - (this.flip ? 4 : 3);
							const y = parseInt((e.target as HTMLTableCellElement).dataset.y!) - (this.flip ? 4 : 3);
							this.onclick(x, y);
						}
					}
				});
				td.addEventListener('contextmenu', e => e.preventDefault());
				td.addEventListener('mousemove', e => {
					if (e.buttons == 0)
						this.touchscreenMode = false;
					if (!this.touchscreenMode) {
						if (this.autoHighlight && this.cardPlaying != null) {
							const x = parseInt((e.target as HTMLTableCellElement).dataset.x!) - (this.flip ? 4 : 3);
							const y = parseInt((e.target as HTMLTableCellElement).dataset.y!) - (this.flip ? 4 : 3);
							if (x != this.highlightX || y != this.highlightY) {
								this.highlightX = x;
								this.highlightY = y;
								this.refreshHighlight();
							}
						}
					}
				});
				td.addEventListener('mouseup', e => {
					if (this.autoHighlight && this.cardPlaying != null) {
						if (e.button == 2) {
							this.cardRotation++;
							this.refreshHighlight();
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

		const trs: HTMLTableRowElement[] = [ ];
		for (let y = 0; y < boardHeight; y++) {
			const tr = document.createElement('tr');
			trs.push(tr);
			this.table.appendChild(tr);
		}
		if (this.flip) trs.reverse();

		for (let y = 0; y < boardHeight; y++) {
			if (this.flip) {
				for (let x = boardWidth - 1; x >= 0; x--) {
					trs[y].appendChild(this.cells[x][y]);
				}
			} else {
				for (let x = 0; x < boardWidth; x++) {
					trs[y].appendChild(this.cells[x][y]);
				}
			}
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

	setDisplayedSpace(x: number, y: number, newState: Space) {
		this.cells[x][y].setAttribute('class', Space[newState]);
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

	/**
	 * Calculates and makes moves resulting from players playing the specified cards, for replays and test placements.
	 */
	makePlacements(moves: Move[]) {
		var playerIndices = Array.from({ length: moves.length }, (_, i) => i);
		playerIndices.sort((a, b) => moves[b].card.size - moves[a].card.size);

		const placements = [ ];
		let placementData: { placement: Placement, cardSize: number } | null = null;
		for (const i of playerIndices) {
			if (!moves[i] || moves[i].isPass) continue;

			const move = moves[i] as PlayMove;
			if (placementData == null) {
				placementData = { placement: { players: [ ], spacesAffected: [ ] }, cardSize: move.card.size };
			} else if (move.card.size != placementData.cardSize) {
				placements.push(placementData.placement);
				placementData = { placement: { players: [ ], spacesAffected: [ ] }, cardSize: move.card.size };
			}

			const placement = placementData.placement;
			placement.players.push(i);
			for (let dy = 0; dy < 8; dy++) {
				const y = move.y + dy;
				for (let dx = 0; dx < 8; dx++) {
					const x = move.x + dx;
					const point = { x, y }
					switch (move.card.getSpace(dx, dy, move.rotation)) {
						case Space.Ink1: {
							const e = placement.spacesAffected.find(s => s.space.x == point.x && s.space.y == point.y)
							if (e) {
								if (e.newState < Space.SpecialInactive1) {
									// Two ink spaces overlapped; create a wall there.
									e.newState = this.grid[x][y] = Space.Wall;
								}
							} else {
								if (this.grid[x][y] < Space.SpecialInactive1)  // Ink spaces can't overlap special spaces from larger cards.
									placement.spacesAffected.push({ space: point, oldState: this.grid[x][y], newState: this.grid[x][y] = (Space.Ink1 | i) });
							}
							break;
						}
						case Space.SpecialInactive1: {
							const e = placement.spacesAffected.find(s => s.space.x == point.x && s.space.y == point.y)
							if (e) {
								if (e.newState >= Space.SpecialInactive1)
									// Two special spaces overlapped; create a wall there.
									e.newState = this.grid[x][y] = Space.Wall;
								else
									// If a special space overlaps an ink space, overwrite it.
									e.newState = this.grid[x][y] = (Space.SpecialInactive1 | i);
							} else
								placement.spacesAffected.push({ space: point, oldState: this.grid[x][y], newState: this.grid[x][y] = (Space.SpecialInactive1 | i) });
							break;
						}
					}
				}
			}
		}
		if (placementData != null)
			placements.push(placementData.placement);

		// Activate special spaces.
		const specialSpacesActivated: Point[] = [ ];
		for (let x = 0; x < this.grid.length; x++) {
			for (let y = 0; y < this.grid[x].length; y++) {
				const space = this.grid[x][y];
				if ((space & Space.SpecialActive1) == Space.SpecialInactive1) {
					let anyEmptySpace = false;
					for (let dy = -1; !anyEmptySpace && dy <= 1; dy++) {
						for (let dx = -1; dx <= 1; dx++) {
							const x2 = x + dx;
							const y2 = y + dy;
							if (x2 >= 0 && x2 < this.grid.length && y2 >= 0 && y2 < this.grid[x2].length
								&& this.grid[x2][y2] == Space.Empty) {
								anyEmptySpace = true;
								break;
							}
						}
					}
					if (!anyEmptySpace) {
						this.grid[x][y] |= Space.SpecialActive1;
						specialSpacesActivated.push({ x, y });
					}
				}
			}
		}

		return { placements, specialSpacesActivated };
	}
}
