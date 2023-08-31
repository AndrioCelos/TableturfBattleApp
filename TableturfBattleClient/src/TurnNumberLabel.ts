class TurnNumberLabel {
	containerElement: HTMLElement;
	element: HTMLElement;

	private _turnNumber: number | null = null;
	private absoluteMode = false;

	constructor(conatinerElement: HTMLElement, element: HTMLElement) {
		this.containerElement = conatinerElement;
		this.element = element;
		conatinerElement.addEventListener('click', () => {
			this.absoluteMode = !this.absoluteMode;
			this.containerElement.getElementsByTagName('p')[0].innerText = this.absoluteMode ? 'Turn' : 'Turns left';
			if (this.turnNumber != null)
				this.element.innerText = (this.absoluteMode ? this.turnNumber : 13 - this.turnNumber).toString();
		});
	}

	get turnNumber() { return this._turnNumber; }
	set turnNumber(value: number | null) {
		this._turnNumber = value;
		if (value == null)
			this.containerElement.hidden = true;
		else {
			this.containerElement.hidden = false;
			this.element.innerText = (this.absoluteMode ? value : 13 - value).toString();
			if (value >= 10)
				this.element.classList.add('nowOrNever');
			else
				this.element.classList.remove('nowOrNever');
		}
	}
}
