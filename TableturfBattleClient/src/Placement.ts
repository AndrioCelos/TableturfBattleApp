interface Placement {
	players: number[],
	spacesAffected: { space: Point, newState: Space, oldState?: Space }[]
}
