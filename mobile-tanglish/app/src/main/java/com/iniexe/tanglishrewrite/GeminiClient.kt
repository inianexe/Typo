package com.iniexe.tanglishrewrite

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

object GeminiClient {
    data class Result(val text: String, val segments: List<Pair<String, String>>)
    fun rewrite(apiKey: String, model: String, input: String, mode: String, tone: String): Result {
        require(input.isNotBlank()) { "Type a sentence first." }
        val prompt = """Convert the input into clear, natural English. The input may be Tanglish (Tamil words written in Latin letters), Tamil-English code switching, or English.
Preserve the meaning, names, intent, and language-specific cultural context. Do not add facts or answer the message.
Mode: $mode
Tone: $tone
Return only JSON with this exact shape: {"rewrite":"...","segments":[{"text":"...","kind":"same|changed"}]}
Mark words/phrases that changed as changed and unchanged words as same. Input: $input"""
        val body = JSONObject().put("contents", JSONArray().put(JSONObject().put("parts", JSONArray().put(JSONObject().put("text", prompt)))))
            .put("generationConfig", JSONObject().put("responseMimeType", "application/json"))
        val url = URL("https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent?key=$apiKey")
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"; connectTimeout = 20000; readTimeout = 45000; doOutput = true
            setRequestProperty("Content-Type", "application/json")
        }
        try {
            conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val response = stream.bufferedReader().use { it.readText() }
            if (code !in 200..299) error("Gemini request failed ($code). Check the API key and model.")
            val raw = JSONObject(response).getJSONArray("candidates").getJSONObject(0)
                .getJSONObject("content").getJSONArray("parts").getJSONObject(0).getString("text")
            val json = JSONObject(raw)
            val segments = mutableListOf<Pair<String,String>>()
            val arr = json.optJSONArray("segments") ?: JSONArray()
            for (i in 0 until arr.length()) {
                val item = arr.getJSONObject(i)
                segments += item.optString("text") to item.optString("kind", "same")
            }
            return Result(json.getString("rewrite"), segments)
        } finally { conn.disconnect() }
    }
}
