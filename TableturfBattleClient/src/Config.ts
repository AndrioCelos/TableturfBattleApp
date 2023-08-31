interface Config {
	apiBaseUrl: string,
	qrCodeGameUrl: string | null | undefined,
	qrCodeCorrectionLevel: QRCode.CorrectLevel | keyof typeof QRCode.CorrectLevel | undefined,
	discordUrl?: string,
	discordTitle?: string
}

declare var config: Config;
declare var polyfillActive: boolean;
