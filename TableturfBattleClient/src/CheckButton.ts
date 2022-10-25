class CheckButton {
	readonly input: HTMLInputElement;
	readonly label: HTMLLabelElement;

	constructor(input: HTMLInputElement) {
		this.input = input;
		this.label = input.labels![0];
		this.input.addEventListener('input', () => {
			this.checked = this.input.checked;
		});
	}

	static fromId(id: string) { return new CheckButton(document.getElementById(id) as HTMLInputElement); }

	get enabled() { return !this.input.disabled; }
	set enabled(value: boolean) {
		this.input.disabled = !value;
		if (value)
			this.label.classList.remove('disabled');
		else
			this.label.classList.add('disabled');
	}

	get checked() { return this.input.checked; }
	set checked(value: boolean) {
		this.input.checked = value;
		if (this.input.checked)
			this.label.classList.add('checked');
		else
			this.label.classList.remove('checked');
	}
}