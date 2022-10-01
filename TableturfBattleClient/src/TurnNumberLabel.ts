class TurnNumberLabel {
	containerElement: HTMLElement;
	element: HTMLElement;

	constructor(conatinerElement: HTMLElement, element: HTMLElement) {
		this.containerElement = conatinerElement;
		this.element = element;
	}

	setTurnNumber(value: number | null) {
		if (value == null)
			this.containerElement.hidden = true;
		else {
			this.containerElement.hidden = false;
			this.element.innerText = (13 - value).toString();
			if (value >= 10)
				this.element.classList.add('nowOrNever');
			else
				this.element.classList.remove('nowOrNever');
		}
	}
}
