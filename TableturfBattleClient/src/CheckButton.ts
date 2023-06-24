class CheckButton {
	readonly buttonElement: HTMLButtonElement;

	private _enabled = true;
	private _checked = false;

	constructor(buttonElement: HTMLButtonElement) {
		this.buttonElement = buttonElement;
	}

	static fromId(id: string) { return new CheckButton(document.getElementById(id) as HTMLButtonElement); }

	get enabled() { return this._enabled; }
	set enabled(value: boolean) {
		this._enabled = value;
		this.buttonElement.ariaDisabled = (!value).toString();
		if (value)
			this.buttonElement.classList.remove('disabled');
		else
			this.buttonElement.classList.add('disabled');
	}

	get checked() { return this._checked; }
	set checked(value: boolean) {
		this._checked = value;
		this.buttonElement.ariaChecked = value.toString();
		if (value)
			this.buttonElement.classList.add('checked');
		else
			this.buttonElement.classList.remove('checked');
	}
}
