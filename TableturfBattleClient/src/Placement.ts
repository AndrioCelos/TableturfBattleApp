interface Placement {
	players: number[],
	spacesAffected: { space: Point, newState: Space, oldState?: Space }[]
}

interface PlacementResults {
	placements: Placement[],
	specialSpacesActivated: Point[]
}
