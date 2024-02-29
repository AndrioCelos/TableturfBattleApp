using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Net;
using System.Text;
using System.Web;
using Newtonsoft.Json;
using HttpListenerRequest = WebSocketSharp.Net.HttpListenerRequest;
using HttpListenerResponse = WebSocketSharp.Net.HttpListenerResponse;

namespace TableturfBattleServer;
internal static class HttpRequestHelper {
   	internal static readonly char[] DELIMITERS = [',', ' '];
	internal const int CUSTOM_CARD_START = -10000;
	internal const int RECEIVED_CUSTOM_CARD_START = -20000;

	internal static void SetErrorResponse(this HttpListenerResponse response, Error error) {
		var bytes = Encoding.UTF8.GetBytes(JsonUtils.Serialise(error));
		SetResponse(response, error.HttpStatusCode, "application/json", bytes);
	}
	internal static void SetResponse(this HttpListenerResponse response, HttpStatusCode statusCode, string contentType, string content) {
		var bytes = Encoding.UTF8.GetBytes(content);
		SetResponse(response, statusCode, contentType, bytes);
	}
	internal static void SetResponse(this HttpListenerResponse response, HttpStatusCode statusCode, string contentType, byte[] content) {
		response.StatusCode = (int) statusCode;
		response.ContentType = contentType;
		response.ContentLength64 = content.Length;
		response.Close(content, true);
	}

	internal static Dictionary<string, string> DecodeFormData(Stream stream) => DecodeFormData(new StreamReader(stream).ReadToEnd());
	internal static Dictionary<string, string> DecodeFormData(TextReader reader) => DecodeFormData(reader.ReadToEnd());
	internal static Dictionary<string, string> DecodeFormData(string s) {
		if (s.StartsWith('?')) s = s[1..];
		return s != ""
			? s.Split(['&']).Select(s => s.Split('=')).Select(a => a.Length == 2 ? a : throw new ArgumentException("Invalid form data"))
				.ToDictionary(a => HttpUtility.UrlDecode(a[0]), a => HttpUtility.UrlDecode(a[1]))
			: [];
	}

	internal static void SetStaticResponse(HttpListenerRequest request, HttpListenerResponse response, string jsonContent, string eTag, DateTime lastModified) {
		if (request.HttpMethod is not ("GET" or "HEAD")) {
			response.AddHeader("Allow", "GET, HEAD");
			SetErrorResponse(response, new(HttpStatusCode.MethodNotAllowed, "MethodNotAllowed", "Invalid request method for this endpoint."));
			return;
		}
		response.AppendHeader("Cache-Control", "max-age=86400");
		response.AppendHeader("ETag", eTag);
		response.AppendHeader("Last-Modified", lastModified.ToString("ddd, dd MMM yyyy HH:mm:ss \"GMT\""));

		var ifNoneMatch = request.Headers["If-None-Match"];
		if (ifNoneMatch != null) {
			if (request.Headers["If-None-Match"] == eTag)
				response.StatusCode = (int) HttpStatusCode.NotModified;
			else
				SetResponse(response, HttpStatusCode.OK, "application/json", jsonContent);
		} else {
			if (DateTime.TryParseExact(request.Headers["If-Modified-Since"], "ddd, dd MMM yyyy HH:mm:ss \"GMT\"", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var dateTime)
				&& dateTime >= lastModified.ToUniversalTime())
				response.StatusCode = (int) HttpStatusCode.NotModified;
			else
				SetResponse(response, HttpStatusCode.OK, "application/json", jsonContent);
		}
	}

	internal static bool TryParseStageSelectionRule(string json, int maxPlayers, [MaybeNullWhen(false)] out StageSelectionRules stageSelectionRule) {
		try {
			stageSelectionRule = JsonUtils.Deserialise<StageSelectionRules>(json);
			if (stageSelectionRule == null) return false;
			stageSelectionRule.AddUnavailableStages(maxPlayers);
			// Check that at least one stage is allowed.
			for (var i = 0; i < StageDatabase.Stages.Count; i++) {
				if (!stageSelectionRule.BannedStages.Contains(i)) return true;
			}
			return false;
		} catch (JsonSerializationException) {
			stageSelectionRule = null;
			return false;
		}
	}
}
