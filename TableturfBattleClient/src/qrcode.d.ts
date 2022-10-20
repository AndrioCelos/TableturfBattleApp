declare class QRCode {
	constructor(el: HTMLElement | string, vOption: string | {
		text: string,
		width?: number,
		height?: number,
		colorDark?: string,
		colorLight?: string,
		correctLevel?: QRCode.CorrectLevel
	});

	makeCode(sText: string) : void;
	clear() : void;

}

declare namespace QRCode {
	enum CorrectLevel { L = 1, M = 0, Q = 3, H = 2 }
}
