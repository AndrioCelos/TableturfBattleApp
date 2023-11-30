class Board {
	table: HTMLTableElement;
	grid: Space[][] = [ ];
	cells: HTMLTableCellElement[][] = [ ];

	playerIndex: number | null = 0;
	cardRotation = 0;
	_specialAttack = false;

	private _cardPlaying: Card | null = null;
	private mouseOffset: Point = { x: 3.5, y: 3.5 };
	private rotationOffsets: Point[] | null = null;

	autoHighlight = true;
	flip = false;

	highlightX = NaN;
	highlightY = NaN;
	private highlightedCells: Point[] = [ ];
	private animatedCells: Point[] = [ ];
	private specialAnimatedCells: [point: Point, elements: HTMLElement[]][] = [ ];
	private touch: [index: number, x: number, y: number, highlightX: number, highlightY: number] | null = null;

	startSpaces: Point[] = [ ];

	onsubmit: ((x: number, y: number) => void) | null = null;
	oncancel: (() => void) | null = null;
	onhighlightchange: ((dScores: number[] | null) => void) | null = null;

	constructor(table: HTMLTableElement) {
		this.table = table;
		table.addEventListener('mouseleave', _ => {
			if (this.autoHighlight) this.clearHighlight()
		});
		table.addEventListener('keydown', e => {
			if (this.autoHighlight) {
				switch (e.key) {
					case 'r':
						this.rotateClockwise(true);
						break;
					case 'R':
						this.rotateAnticlockwise(true);
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
						if (this.onsubmit)
							this.onsubmit(this.highlightX, this.highlightY);
						break;
					case 'Escape': case 'Backspace':
						if (this.oncancel)
							this.oncancel();
						break;
				}
			}
		});
		table.addEventListener('touchstart', e => {
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
					e.preventDefault();
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

	private get rotatedMouseOffset() {
		switch ((this.cardRotation % 4 + 4) % 4) {
			case 0: return this.mouseOffset;
			case 1: return { x: 7 - this.mouseOffset.y, y: this.mouseOffset.x };
			case 2: return { x: 7 - this.mouseOffset.x, y: 7 - this.mouseOffset.y };
			default: return { x: this.mouseOffset.y, y: 7 - this.mouseOffset.x };
		}
	}

	get cardPlaying(): Card | null { return this._cardPlaying; }
	set cardPlaying(value: Card | null) {
		this._cardPlaying = value;
		if (!value) {
			this.rotationOffsets = null;
			return;
		}
		// Figure out the centre point for rotating the card.
		// If the ink pattern's width and height are both even or both odd, it rotates around the centre (either the centre of an ink space or a corner).
		// If the width is even, it rotates around the left of the two central spaces.
		// If the height is even, it rotates around the lower of the two central spaces.
		const size = value.inkAreaDimensions;
		if (size.x % 2 == 0 && size.y % 2 == 0) {
			this.mouseOffset = { x: 3.5, y: 3.5 };
			this.rotationOffsets = null;
		} else if (size.y % 2 != 0){
			this.mouseOffset = { x: 3, y: 3 };
			this.rotationOffsets = [ { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 } ];
		} else {
			this.mouseOffset = { x: 3, y: 4 };
			this.rotationOffsets = [ { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 } ];
		}
	}

	get specialAttack() { return this._specialAttack; }
	set specialAttack(value: boolean) {
		this._specialAttack = value;
		if (value)
			this.table.classList.add('specialAttackVisual');
		else
			this.table.classList.remove('specialAttackVisual');
	}

	moveHighlight(move: (x: number, y: number, r: number) => [number, number, number], clamp: boolean) {
		if (this.playerIndex == null) return;
		if (this.highlightedCells.length == 0 || isNaN(this.highlightX) || isNaN(this.highlightY) || isNaN(this.cardRotation)) {
			const startSpace = this.startSpaces[this.playerIndex];
			[this.highlightX, this.highlightY, this.cardRotation] = [startSpace.x - (this.flip ? 4 : 3), startSpace.y + (this.flip ? 4 : 3), 0];
		} else {
			let [x, y, r] = move(this.highlightX, this.highlightY, this.cardRotation);
			let clampedPosition = clamp
				? this.cardPlaying!.clampPosition(x, y, this.grid.length, this.grid[0].length, r)
				: { x, y };
			[this.highlightX, this.highlightY, this.cardRotation] = [clampedPosition.x, clampedPosition.y, r];
		}
		this.refreshHighlight();
	}

	rotateClockwise(clamp: boolean) {
		if (this.rotationOffsets) {
			const offset = this.rotationOffsets[((this.cardRotation) % 4 + 4) % 4];
			this.moveHighlight((x, y, r) => [x + offset.x, y + offset.y, r + 1], clamp);
		} else {
			this.moveHighlight((x, y, r) => [x, y, r + 1], clamp);
			this.refreshHighlight();
		}
	}

	rotateAnticlockwise(clamp: boolean) {
		if (this.rotationOffsets) {
			const offset = this.rotationOffsets[((this.cardRotation + 1) % 4 + 4) % 4];
			this.moveHighlight((x, y, r) => [x + offset.x, y + offset.y, r - 1], clamp);
		} else {
			this.moveHighlight((x, y, r) => [x, y, r - 1], clamp);
			this.refreshHighlight();
		}
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
					return 'It cannot be over a wall.';  // Out of bounds.
				const space = this.grid[x2][y2];
				if (space == Space.Wall || space == Space.OutOfBounds)
					return 'It cannot be over a wall.';
				if (space >= Space.SpecialInactive1)
					return `It cannot be over${' <div class="playHintSpecial" aria-label="Special space">&nbsp;</div>'.repeat(Math.max(currentGame?.game.players.length ?? 0, 2))}.`;
				if (space != Space.Empty && !isSpecialAttack)
					return 'It cannot be over inked spaces.';
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
		return isAnchored ? null : (isSpecialAttack ? 'It\'s not next to <div class="playHintSpecial">&nbsp;</div>.' : 'It\'s not touching your colour of ink.');
	}

	refreshHighlight() {
		let legal = this.playerIndex == null || this.cardPlaying == null ? false
			: this.checkMoveLegality(this.playerIndex, this.cardPlaying, this.highlightX, this.highlightY, this.cardRotation, this.specialAttack) == null;

		this.internalClearHighlight();
		const dScores = legal ? [ 0, 0, 0, 0 ] : null;
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
						if (dScores) {
							const existingSpace = this.grid[x2][y2];
							if (existingSpace >= Space.Ink1)
								dScores[existingSpace & 3]--;
							dScores[this.playerIndex]++;
						}
						const cell = this.cells[x2][y2];
						cell.classList.add('hover');
						if (!legal)
							cell.classList.add('hoverillegal');
						if (space == Space.SpecialInactive1)
							cell.classList.add('hoverspecial');
						this.highlightedCells.push({ x: x2, y: y2 });
					}
				}
			}
			if (this.onhighlightchange)
				this.onhighlightchange(dScores);
		}
	}

	clearHighlight() {
		this.internalClearHighlight();
		if (this.onhighlightchange)
			this.onhighlightchange(null);
	}

	private internalClearHighlight() {
		for (const s of this.highlightedCells) {
			this.cells[s.x][s.y].classList.remove('hover', 'hoverillegal', 'hoverspecial');
		}
		this.highlightedCells.splice(0);
	}

	setTestHighlight(x: number, y: number, highlight: boolean) {
		if (highlight)
			this.cells[x][y].classList.add('testHighlight');
		else
			this.cells[x][y].classList.remove('testHighlight');
	}

	clearTestHighlight() {
		for (let x = 0; x < this.grid.length; x++) {
			for (let y = 0; y < this.grid[x].length; y++) {
				this.cells[x][y].classList.remove('testHighlight');
			}
		}
	}

	enableInkAnimations() {
		this.table.classList.add('enableInkAnimation');
	}

	showInkAnimation(x: number, y: number) {
		this.animatedCells.push({ x, y });
		this.cells[x][y].classList.add('inkAnimation');
	}

	clearInkAnimations() {
		for (const s of this.animatedCells)
			this.cells[s.x][s.y].classList.remove('inkAnimation');
		this.animatedCells.splice(0);
		this.table.classList.remove('enableInkAnimation');
	}

	showSubmitAnimation() {
		for (const s of this.highlightedCells)
			this.cells[s.x][s.y].classList.add('submitted');
	}

	private showSpecialAnimation(x: number, y: number) {
		if ((this.grid[x][y] & Space.SpecialActive1) != Space.SpecialActive1 || this.specialAnimatedCells.find(el => el[0].x == x && el[0].y == y))
			return;

		const parent = this.cells[x][y];
		const els = [ ];
		els.push(this.createSpecialAnimationElement(parent));
		els.push(this.createSpecialAnimationElement(parent));
		els.push(this.createSpecialAnimationElement(parent));
		els.push(this.createSpecialAnimationElement(parent));
		els.push(this.createSpecialAnimationElement(parent));
		els.push(this.createSpecialAnimationElement(parent));
		els.push(this.createSpecialAnimationElement(parent));
		els.push(this.createSpecialAnimationElement(parent));
		els.push(this.createSpecialAnimationElement(parent));
		els.push(this.createSpecialAnimationElement(parent));
		this.specialAnimatedCells.push([{ x, y }, els]);
	}

	private createSpecialAnimationElement(parent: Element) {
		const el = document.createElement('div');
		parent.appendChild(el);
		return el;
	}

	private clearSpecialAnimation(x: number, y: number) {
		const i = this.specialAnimatedCells.findIndex(el => el[0].x == x && el[0].y == y);
		if (i < 0) return;

		for (const el of this.specialAnimatedCells[i][1])
			el.parentElement!.removeChild(el);
		this.specialAnimatedCells.splice(i, 1);
	}

	clearAllSpecialAnimations() {
		for (const entry of this.specialAnimatedCells) {
			for (const el of entry[1])
				el.parentElement!.removeChild(el);
		}
		this.specialAnimatedCells.splice(0);
	}

	resize(grid?: Space[][]) {
		if (grid) this.grid = grid;

		clearChildren(this.table);
		this.cells.splice(0);
		this.highlightedCells.splice(0);
		this.animatedCells.splice(0);
		this.specialAnimatedCells.splice(0);

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
				td.addEventListener('click', () => {
					if (this.autoHighlight && this.cardPlaying != null && this.onsubmit && !isNaN(this.highlightX) && !isNaN(this.highlightY)) {
						if (this.onsubmit)
							this.onsubmit(this.highlightX, this.highlightY);
					}
				});
				td.addEventListener('contextmenu', e => e.preventDefault());
				td.addEventListener('pointermove', e => {
					if (e.pointerType != 'touch') {
						if (this.autoHighlight && this.cardPlaying != null) {
							const offset = this.rotatedMouseOffset;
							const x = parseInt((e.currentTarget as HTMLTableCellElement).dataset.x!) - (this.flip ? Math.ceil(offset.x) : Math.floor(offset.x));
							const y = parseInt((e.currentTarget as HTMLTableCellElement).dataset.y!) - (this.flip ? Math.ceil(offset.y) : Math.floor(offset.y));
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
							this.rotateClockwise(false);
						}
					}
				});
				td.addEventListener('wheel', e => {
					if (this.autoHighlight && this.cardPlaying != null) {
						e.preventDefault();
						if (e.deltaY > 0) this.rotateClockwise(false);
						else if (e.deltaY < 0) this.rotateAnticlockwise(false);
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
		this.clearInkAnimations();
		for (let x = 0; x < this.grid.length; x++) {
			for (let y = 0; y < this.grid[x].length; y++) {
				this.setDisplayedSpace(x, y, this.grid[x][y]);
			}
		}
	}

	setDisplayedSpace(x: number, y: number, newState: Space) {
		const isTestHighlight = this.cells[x][y].classList.contains('testHighlight');
		this.cells[x][y].setAttribute('class', Space[newState]);
		if (isTestHighlight) this.cells[x][y].classList.add('testHighlight');
		if (this.cells[x][y].childNodes.length > 0) {
			if ((newState & Space.SpecialActive1) != Space.SpecialActive1)
				this.clearSpecialAnimation(x, y);
		} else
			this.showSpecialAnimation(x, y);
	}

	getScores() {
		const scores = [ 0, 0, 0, 0 ];
		for (let x = 0; x < this.grid.length; x++) {
			for (let y = 0; y < this.grid[x].length; y++) {
				const space = this.grid[x][y];
				if (space >= Space.Ink1)
					scores[space & 3]++;
			}
		}
		return scores;
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
