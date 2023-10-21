class TurnNumberLabel {
	containerElement: HTMLElement;
	element: HTMLElement;

	private _turnNumber: number | null = null;
	private _absoluteMode = userConfig.absoluteTurnNumber;

	constructor(conatinerElement: HTMLElement, element: HTMLElement) {
		this.containerElement = conatinerElement;
		this.element = element;
		conatinerElement.addEventListener('click', () => {
			this.absoluteMode = !this.absoluteMode;
		});
	}

	get turnNumber() { return this._turnNumber; }
	set turnNumber(value: number | null) {
		this._turnNumber = value;
		if (value == null)
			this.containerElement.hidden = true;
		else {
			this.containerElement.hidden = false;
			this.element.innerText = (this._absoluteMode ? value : 13 - value).toString();
			if (value >= 10)
				this.element.classList.add('nowOrNever');
			else
				this.element.classList.remove('nowOrNever');
		}
	}

	get absoluteMode() { return this._absoluteMode; }
	set absoluteMode(value: boolean) {
		this._absoluteMode = value;
		this.containerElement.getElementsByTagName('p')[0].innerText = value ? 'Turn' : 'Turns left';
		if (this.turnNumber != null)
			this.element.innerText = (value ? this.turnNumber : 13 - this.turnNumber).toString();
		userConfig.absoluteTurnNumber = value;
		saveSettings();
	}
}
