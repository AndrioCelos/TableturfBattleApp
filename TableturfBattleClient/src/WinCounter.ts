class WinCounter {
	readonly parent: HTMLElement;
	private _wins: number = 0;

	constructor(element: HTMLDivElement) {
		this.parent = element;
	}

	get wins() { return this._wins; }
	set wins(value: number) {
		this._wins = value;
		clearChildren(this.parent);
		if (value) {
			if (value < 5) {
				for (let i = 0; i < value; i++) {
					this.parent.appendChild(document.createElement('div'));
				}
			}
			const el = document.createElement('div');
			el.classList.add('winCount');
			el.innerText = value.toString();
			this.parent.appendChild(el);
		}
	}
}
