interface AppConfig {
	apiBaseUrl: string,
	qrCodeGameUrl: string | null | undefined,
	qrCodeCorrectionLevel: QRCode.CorrectLevel | keyof typeof QRCode.CorrectLevel | undefined,
	discordUrl?: string,
	discordTitle?: string
}

class Config {
	name: string | null = null;
	colourLock = true;
	absoluteTurnNumber = false;
}

declare var config: AppConfig;
declare var polyfillActive: boolean;

let userConfig = new Config();

{
	const configString = localStorage.getItem('settings');
	if (configString) {
		const configDict = JSON.parse(configString);
		for (const k in configDict)
			(userConfig as any)[k] = configDict[k];
	}
}

function saveSettings() {
	localStorage.setItem('settings', JSON.stringify(userConfig));
}
