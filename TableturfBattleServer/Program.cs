using System.Net;
using System.Reflection;
using System.Web;
using WebSocketSharp.Server;
using HttpListenerRequest = WebSocketSharp.Net.HttpListenerRequest;
using HttpListenerResponse = WebSocketSharp.Net.HttpListenerResponse;

namespace TableturfBattleServer;

internal delegate void ApiEndpointGlobalHandler(HttpListenerRequest request, HttpListenerResponse response);
internal delegate void ApiEndpointGameHandler(Game game, HttpListenerRequest request, HttpListenerResponse response);

internal partial class Program {
	internal static HttpServer? httpServer;

	private static readonly Dictionary<string, (ApiEndpointAttribute attribute, ApiEndpointGlobalHandler handler)> apiGlobalHandlers = [];
	private static readonly Dictionary<string, (ApiEndpointAttribute attribute, ApiEndpointGameHandler handler)> apiGameHandlers = [];
	private static readonly HashSet<string> spaPaths = [ "/",  "/deckeditor", "/cardlist", "/game" , "/replay" ];

	private static string? GetClientRootPath() {
		var directory = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
		while (true) {
			if (directory == null) return null;
			var directory2 = Path.Combine(directory, "TableturfBattleClient");
			if (Directory.Exists(directory2)) return directory2;
			directory = Path.GetDirectoryName(directory);
		}
	}

	internal static void Main(string[] args) {
		foreach (var method in typeof(ApiEndpoints).GetMethods(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static)) {
			var attribute = method.GetCustomAttribute<ApiEndpointAttribute>();
			if (attribute == null) continue;
			if (attribute.Namespace == ApiEndpointNamespace.ApiRoot)
				apiGlobalHandlers[attribute.Path] = (attribute, method.CreateDelegate<ApiEndpointGlobalHandler>());
			else
				apiGameHandlers[attribute.Path] = (attribute, method.CreateDelegate<ApiEndpointGameHandler>());
		}

		httpServer = new(args.Contains("--open") ? IPAddress.Any : IPAddress.Loopback, 3333) { DocumentRootPath = GetClientRootPath() };

		httpServer.AddWebSocketService<TableturfWebSocketBehaviour>("/api/websocket");
		httpServer.OnGet += HttpServer_OnRequest;
		httpServer.OnPost += HttpServer_OnRequest;
		httpServer.Start();
		Console.WriteLine($"Listening on http://{httpServer.Address}:{httpServer.Port}");
		if (httpServer.DocumentRootPath != null)
			Console.WriteLine($"Serving client files from {httpServer.DocumentRootPath}");
		else
			Console.WriteLine($"Client files were not found.");

		while (true) {
			var s = Console.ReadLine();
			if (s == null)
				Thread.Sleep(Timeout.Infinite);
			else {
				s = s.Trim().ToLower();
				if (s == "update") {
					if (Server.Instance.games.Count == 0)
						Environment.Exit(2);
					Server.Instance.Lockdown = true;
					Console.WriteLine("Locking server for update.");
				}
			}
		}
	}

	private static void HttpServer_OnRequest(object? sender, HttpRequestEventArgs e) {
		e.Response.AppendHeader("Access-Control-Allow-Origin", "*");
		if (!e.Request.RawUrl.StartsWith('/')) {
			e.Response.SetErrorResponse(new(HttpStatusCode.BadRequest, "InvalidRequestUrl", "Invalid request URL."));
			return;
		}

		if (!e.Request.RawUrl.StartsWith("/api/")) {
			// Static files
			if (e.Request.HttpMethod is not ("GET" or "HEAD")) {
				e.Response.AddHeader("Allow", "GET, HEAD");
				e.Response.SetErrorResponse(new(HttpStatusCode.MethodNotAllowed, "MethodNotAllowed", "Invalid request method for this endpoint."));
				return;
			}
			var pos = e.Request.RawUrl.IndexOf('/', 1);
			var topLevelFileName = pos < 0 ? e.Request.RawUrl : e.Request.RawUrl[..pos];
			var path = spaPaths.Contains(topLevelFileName) ? "index.html" : HttpUtility.UrlDecode(e.Request.RawUrl[1..]);
			if (e.TryReadFile(path, out var bytes))
				e.Response.SetResponse(HttpStatusCode.OK, Path.GetExtension(path) switch {
					".html" or ".htm" => "text/html",
					".css" => "text/css",
					".js" => "text/javascript",
					".png" => "image/png",
					".tar" => "application/x-tar",
					".webp" => "image/webp",
					".woff" or ".woff2" => "font/woff",
					_ => "application/octet-stream"
				}, bytes);
			else
				e.Response.SetErrorResponse(new(HttpStatusCode.NotFound, "NotFound", "File not found."));
		} else {
			var pos = e.Request.RawUrl.IndexOf('?', 5);
			var path = pos < 0 ? e.Request.RawUrl[4..] : e.Request.RawUrl[4..pos];
			if (apiGlobalHandlers.TryGetValue(path, out var entry)) {
				if ((e.Request.HttpMethod == "HEAD" ? "GET" : e.Request.HttpMethod) != entry.attribute.AllowedMethod) {
					e.Response.AddHeader("Allow", entry.attribute.AllowedMethod == "GET" ? "GET, HEAD" : entry.attribute.AllowedMethod);
					e.Response.SetErrorResponse(new(HttpStatusCode.MethodNotAllowed, "MethodNotAllowed", "Invalid request method for this endpoint."));
					return;
				}
				if (e.Request.ContentLength64 >= 65536) {
					e.Response.SetErrorResponse(new(HttpStatusCode.RequestEntityTooLarge, "ContentTooLarge", "Request content is too large."));
					return;
				}
				entry.handler(e.Request, e.Response);
			} else {
				if (!path.StartsWith("/games/")) {
					e.Response.SetErrorResponse(new(HttpStatusCode.NotFound, "NotFound", "Endpoint not found."));
					return;
				}
				pos = path.IndexOf('/', 7);
				var gameIdString = path[7..(pos < 0 ? ^0 : pos)];
				path = pos < 0 ? "/" : path[pos..];
				if (!Guid.TryParse(gameIdString, out var gameID)) {
					e.Response.SetErrorResponse(new(HttpStatusCode.BadRequest, "InvalidGameID", "Invalid game ID."));
					return;
				}

				lock (Server.Instance.games) {
					if (!Server.Instance.TryGetGame(gameID, out var game)) {
						e.Response.SetErrorResponse(new(HttpStatusCode.NotFound, "GameNotFound", "Game not found."));
						return;
					}
					lock (game.Players) {
						if (!apiGameHandlers.TryGetValue(path, out var entry2)) {
							e.Response.SetErrorResponse(new(HttpStatusCode.NotFound, "NotFound", "Endpoint not found."));
							return;
						}
						if ((e.Request.HttpMethod == "HEAD" ? "GET" : e.Request.HttpMethod) != entry2.attribute.AllowedMethod) {
							e.Response.AddHeader("Allow", entry2.attribute.AllowedMethod == "GET" ? "GET, HEAD" : entry2.attribute.AllowedMethod);
							e.Response.SetErrorResponse(new(HttpStatusCode.MethodNotAllowed, "MethodNotAllowed", "Invalid request method for this endpoint."));
							return;
						}
						if (e.Request.ContentLength64 >= 65536) {
							e.Response.SetErrorResponse(new(HttpStatusCode.RequestEntityTooLarge, "ContentTooLarge", "Request content is too large."));
							return;
						}
						entry2.handler(game, e.Request, e.Response);
					}
				}
			}
		}
	}
}
