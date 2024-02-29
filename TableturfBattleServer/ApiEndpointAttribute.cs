namespace TableturfBattleServer;
[AttributeUsage(AttributeTargets.Method, AllowMultiple = true)]
internal class ApiEndpointAttribute(ApiEndpointNamespace endpointNamespace, string path, string allowedMethod) : Attribute {
	public ApiEndpointNamespace Namespace { get; } = endpointNamespace;
	public string Path { get; } = path;
	public string AllowedMethod { get; } = allowedMethod;

	public ApiEndpointAttribute(string path, string allowedMethod) : this(ApiEndpointNamespace.ApiRoot, path, allowedMethod) { }
}

internal enum ApiEndpointNamespace {
	ApiRoot,
	Game
}