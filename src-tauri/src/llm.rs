// Cliente HTTP de los modelos: respuestas en streaming (SSE) y lista de modelos.
//
// Dos protocolos cubren a casi todos los proveedores:
//   · Anthropic Messages:       POST {base}/messages
//   · OpenAI chat/completions:  POST {base}/chat/completions (Groq, DeepSeek,
//     Gemini, OpenRouter, OpenAI, Ollama…)

use std::time::Duration;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::config::{Api, Config};

const ANTHROPIC_VERSION: &str = "2023-06-01";
/// Margen para respuestas largas; las consultas normales gastan muchísimo menos.
const MAX_TOKENS: u32 = 8192;

/// Tokens de una respuesta. `reported` = los dio el proveedor (si no, se estiman).
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Usage {
    pub input: u64,
    pub output: u64,
    pub reported: bool,
}

#[derive(Clone, Deserialize, Serialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

pub fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .user_agent(concat!("noteai/", env!("CARGO_PKG_VERSION")))
        .build()
        .expect("cliente HTTP")
}

fn request(http: &reqwest::Client, config: &Config, method: reqwest::Method, path: &str) -> reqwest::RequestBuilder {
    let url = format!("{}{}", config.base_url, path);
    let key = config.api_key.trim();
    let req = http.request(method, url);
    match config.api {
        Api::Anthropic => req.header("x-api-key", key).header("anthropic-version", ANTHROPIC_VERSION),
        Api::Openai if key.is_empty() => req, // Ollama y similares, sin clave
        Api::Openai => req.bearer_auth(key),
    }
}

/// `stream_usage`: pedir los tokens al final del streaming (OpenAI y compatibles).
fn body(config: &Config, messages: &[ChatMessage], stream_usage: bool) -> Value {
    let turns: Vec<&ChatMessage> = messages
        .iter()
        .filter(|m| (m.role == "user" || m.role == "assistant") && !m.content.trim().is_empty())
        .collect();
    match config.api {
        // Esfuerzo bajo: respuestas rápidas y baratas (el modelo apenas piensa
        // en preguntas sencillas). Los bloques de pensamiento no se muestran.
        Api::Anthropic => json!({
            "model": config.model,
            "max_tokens": MAX_TOKENS,
            "stream": true,
            "system": config.system_prompt(),
            "output_config": { "effort": "low" },
            "messages": turns,
        }),
        Api::Openai => {
            let mut all = vec![json!({ "role": "system", "content": config.system_prompt() })];
            all.extend(turns.iter().map(|m| json!(m)));
            let mut b = json!({
                "model": config.model,
                "max_tokens": MAX_TOKENS,
                "stream": true,
                "messages": all,
            });
            if stream_usage {
                b["stream_options"] = json!({ "include_usage": true });
            }
            b
        }
    }
}

/// Mensaje de error legible a partir de una respuesta HTTP fallida.
async fn http_error(res: reqwest::Response) -> String {
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    error_message(status, &text)
}

fn error_message(status: reqwest::StatusCode, text: &str) -> String {
    let detail = serde_json::from_str::<Value>(text)
        .ok()
        .and_then(|v| {
            let e = v.get("error").unwrap_or(&v);
            e.get("message").or_else(|| e.get("msg")).and_then(Value::as_str).map(str::to_string)
                .or_else(|| e.as_str().map(str::to_string))
        })
        .unwrap_or_else(|| text.chars().take(300).collect());
    let hint = match status.as_u16() {
        401 | 403 => "API key no válida o sin permisos. ",
        404 => "Modelo o URL no encontrados. ",
        429 => "Límite de uso alcanzado o sin saldo. ",
        _ => "",
    };
    format!("{hint}HTTP {}: {detail}", status.as_u16())
}

/// Tokens de entrada de un objeto `usage` de Anthropic (incluye los de caché).
fn anthropic_usage(u: &Value, usage: &mut Usage) {
    if let Some(input) = u["input_tokens"].as_u64() {
        let cached = u["cache_read_input_tokens"].as_u64().unwrap_or(0)
            + u["cache_creation_input_tokens"].as_u64().unwrap_or(0);
        usage.input = usage.input.max(input + cached);
        usage.reported = true;
    }
    if let Some(output) = u["output_tokens"].as_u64() {
        usage.output = usage.output.max(output);
        usage.reported = true;
    }
}

/// Texto que aporta un evento SSE, según el protocolo; anota en `usage` los
/// tokens que informe el proveedor. `Err` si el evento es un error.
fn delta(api: Api, data: &str, usage: &mut Usage) -> Result<Option<String>, String> {
    if data == "[DONE]" {
        return Ok(None);
    }
    let Ok(v) = serde_json::from_str::<Value>(data) else { return Ok(None) };
    if let Some(err) = v.get("error") {
        let msg = err.get("message").and_then(Value::as_str).unwrap_or("error del proveedor");
        return Err(msg.to_string());
    }
    let text = match api {
        Api::Anthropic => {
            // message_start trae la entrada; message_delta, la salida acumulada.
            match v["type"].as_str() {
                Some("message_start") => anthropic_usage(&v["message"]["usage"], usage),
                Some("message_delta") => anthropic_usage(&v["usage"], usage),
                _ => {}
            }
            (v["type"] == "content_block_delta" && v["delta"]["type"] == "text_delta")
                .then(|| v["delta"]["text"].as_str())
                .flatten()
        }
        Api::Openai => {
            // Último trozo con stream_options.include_usage; Groq lo pone en x_groq.
            let u = if v["usage"].is_object() { &v["usage"] } else { &v["x_groq"]["usage"] };
            if let (Some(input), Some(output)) = (u["prompt_tokens"].as_u64(), u["completion_tokens"].as_u64()) {
                *usage = Usage { input, output, reported: true };
            }
            v["choices"][0]["delta"]["content"].as_str()
        }
    };
    Ok(text.filter(|t| !t.is_empty()).map(str::to_string))
}

/// Envía la conversación y llama a `on_text` con cada trozo de respuesta.
/// `cancelled` se consulta entre trozos para poder detener la respuesta.
pub async fn stream_chat(
    http: &reqwest::Client,
    config: &Config,
    messages: &[ChatMessage],
    mut on_text: impl FnMut(String),
    cancelled: impl Fn() -> bool,
) -> Result<Usage, String> {
    let path = match config.api {
        Api::Anthropic => "/messages",
        Api::Openai => "/chat/completions",
    };
    let send = |stream_usage: bool| {
        request(http, config, reqwest::Method::POST, path)
            .json(&body(config, messages, stream_usage))
            .send()
    };
    let unreachable = |e: reqwest::Error| format!("Sin conexión con {}: {e}", config.base_url);
    let mut res = send(true).await.map_err(unreachable)?;
    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        // Algún compatible con OpenAI no acepta stream_options: reintentar sin él.
        if config.api == Api::Openai && status.as_u16() == 400 && text.contains("stream_options") {
            res = send(false).await.map_err(unreachable)?;
            if !res.status().is_success() {
                return Err(http_error(res).await);
            }
        } else {
            return Err(error_message(status, &text));
        }
    }

    let mut usage = Usage::default();
    let mut stream = res.bytes_stream();
    let mut buf: Vec<u8> = Vec::new();
    while let Some(chunk) = stream.next().await {
        if cancelled() {
            return Ok(usage);
        }
        buf.extend_from_slice(&chunk.map_err(|e| format!("Conexión interrumpida: {e}"))?);
        // Las líneas pueden llegar partidas entre trozos: se procesan solo las completas.
        while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
            let line: Vec<u8> = buf.drain(..=pos).collect();
            let line = String::from_utf8_lossy(&line);
            let Some(data) = line.trim_end().strip_prefix("data:") else { continue };
            if let Some(text) = delta(config.api, data.trim_start(), &mut usage)? {
                on_text(text);
            }
        }
    }
    Ok(usage)
}

/// Modelos disponibles para la clave configurada, ordenados.
pub async fn list_models(http: &reqwest::Client, config: &Config) -> Result<Vec<String>, String> {
    let path = match config.api {
        Api::Anthropic => "/models?limit=1000",
        Api::Openai => "/models",
    };
    let res = request(http, config, reqwest::Method::GET, path)
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("Sin conexión con {}: {e}", config.base_url))?;
    if !res.status().is_success() {
        return Err(http_error(res).await);
    }
    let v: Value = res.json().await.map_err(|e| e.to_string())?;
    let mut ids: Vec<String> = v["data"]
        .as_array()
        .or_else(|| v["models"].as_array())
        .map(|list| {
            list.iter()
                .filter_map(|m| m["id"].as_str().or_else(|| m["name"].as_str()))
                .map(|id| id.trim_start_matches("models/").to_string())
                .collect()
        })
        .unwrap_or_default();
    ids.sort();
    ids.dedup();
    Ok(ids)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_anthropic_deltas() {
        let u = &mut Usage::default();
        let text = r#"{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hola"}}"#;
        assert_eq!(delta(Api::Anthropic, text, u).unwrap().as_deref(), Some("Hola"));
        let thinking = r#"{"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"..."}}"#;
        assert_eq!(delta(Api::Anthropic, thinking, u).unwrap(), None);
        let err = r#"{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}"#;
        assert_eq!(delta(Api::Anthropic, err, u).unwrap_err(), "Overloaded");
    }

    #[test]
    fn parses_openai_deltas() {
        let u = &mut Usage::default();
        let text = r#"{"choices":[{"index":0,"delta":{"content":"Hola"}}]}"#;
        assert_eq!(delta(Api::Openai, text, u).unwrap().as_deref(), Some("Hola"));
        assert_eq!(delta(Api::Openai, "[DONE]", u).unwrap(), None);
        let role = r#"{"choices":[{"index":0,"delta":{"role":"assistant"}}]}"#;
        assert_eq!(delta(Api::Openai, role, u).unwrap(), None);
    }

    #[test]
    fn reads_anthropic_usage() {
        let mut u = Usage::default();
        let start = r#"{"type":"message_start","message":{"usage":{"input_tokens":30,"cache_read_input_tokens":10,"output_tokens":1}}}"#;
        delta(Api::Anthropic, start, &mut u).unwrap();
        let end = r#"{"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":85}}"#;
        delta(Api::Anthropic, end, &mut u).unwrap();
        assert_eq!(u, Usage { input: 40, output: 85, reported: true });
    }

    #[test]
    fn reads_openai_and_groq_usage() {
        let mut u = Usage::default();
        let last = r#"{"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":34,"total_tokens":46}}"#;
        assert_eq!(delta(Api::Openai, last, &mut u).unwrap(), None);
        assert_eq!(u, Usage { input: 12, output: 34, reported: true });
        let mut g = Usage::default();
        let groq = r#"{"choices":[{"delta":{}}],"x_groq":{"usage":{"prompt_tokens":5,"completion_tokens":6}}}"#;
        delta(Api::Openai, groq, &mut g).unwrap();
        assert_eq!(g, Usage { input: 5, output: 6, reported: true });
    }

    #[test]
    fn openai_body_has_system_first() {
        let config = Config {
            provider: "groq".into(),
            api: Api::Openai,
            base_url: "x".into(),
            model: "m".into(),
            api_key: String::new(),
            system_prompt: "S".into(),
            price_input: None,
            price_output: None,
        };
        let msgs = vec![ChatMessage { role: "user".into(), content: "hola".into() }];
        let b = body(&config, &msgs, true);
        assert_eq!(b["stream_options"]["include_usage"], true);
        assert!(body(&config, &msgs, false).get("stream_options").is_none());
        assert_eq!(b["messages"][0]["role"], "system");
        assert_eq!(b["messages"][1]["content"], "hola");
    }
}
