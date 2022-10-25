const stageDatabase = {
	stages: null as Stage[] | null,
	loadAsync() {
		return new Promise<Stage[]>((resolve, reject) => {
			if (stageDatabase.stages != null) {
				resolve(stageDatabase.stages);
				return;
			}
			const stageListRequest = new XMLHttpRequest();
			stageListRequest.open('GET', `${config.apiBaseUrl}/stages`);
			stageListRequest.addEventListener('load', e => {
				const stages = [ ];
				if (stageListRequest.status == 200) {
					const s = stageListRequest.responseText;
					const response = JSON.parse(s) as object[];
					for (const o of response) {
						stages.push(Stage.fromJson(o));
					}
					stageDatabase.stages = stages;
					resolve(stages);
				} else {
					reject(new Error(`Error downloading stage database: response was ${stageListRequest.status}`));
				}
			});
			stageListRequest.addEventListener('error', e => {
				reject(new Error('Error downloading stage database: no further information.'))
			});
			stageListRequest.send();
		});
	}
}
