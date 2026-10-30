// Configuración del proveedor de IA: ~/.noteai/config.json (permisos 600).
//
// La API key nunca sale de Rust: el frontend solo recibe sus últimos
// caracteres para mostrar que hay una guardada.

use std::{
    fs, io,
    io::Write,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};

const CONFIG_FILE: &str = "config.json";

/// Instrucciones por defecto: respuestas breves, pensadas para consultas rápidas.
pub const DEFAULT_SYSTEM_PROMPT: &str = "Eres un asistente de consulta rápida. Responde en el idioma \
del usuario, de forma breve y directa: primero la respuesta, luego, solo si aporta, un ejemplo o \
un matiz. Si te preguntan qué significa una palabra o expresión, da la definición, el contexto en \
que se usa y un ejemplo corto. Usa Markdown sencillo.";

pub fn root() -> PathBuf {
    if let Some(dir) = std::env::var_os("NOTEAI_DIR") {
        return PathBuf::from(dir);
    }
    let home = std::env::var_os("HOME").map(PathBuf::from).unwrap_or_else(|| PathBuf::from("."));
    home.join(".noteai")
}

/// Protocolo de la API: Anthropic (Messages) u OpenAI (chat/completions),
/// que usan casi todos los proveedores baratos (Groq, DeepSeek, Gemini, OpenRouter…).
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Api {
    Anthropic,
    Openai,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    /// Identificador del preset elegido en la interfaz (anthropic, groq…).
    pub provider: String,
    pub api: Api,
    pub base_url: String,
    pub model: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub system_prompt: String,
    /// Precio en US$ por millón de tokens de entrada / salida (para estimar el coste).
    #[serde(default)]
    pub price_input: Option<f64>,
    #[serde(default)]
    pub price_output: Option<f64>,
}

impl Config {
    pub fn system_prompt(&self) -> &str {
        if self.system_prompt.trim().is_empty() {
            DEFAULT_SYSTEM_PROMPT
        } else {
            &self.system_prompt
        }
    }
}

/// Lo que ve el frontend: todo menos la clave.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicConfig {
    pub provider: String,
    pub api: Api,
    pub base_url: String,
    pub model: String,
    pub system_prompt: String,
    pub default_system_prompt: &'static str,
    pub price_input: Option<f64>,
    pub price_output: Option<f64>,
    /// Últimos 4 caracteres de la clave, o `None` si no hay ninguna.
    pub key_hint: Option<String>,
}

impl From<&Config> for PublicConfig {
    fn from(c: &Config) -> Self {
        let key = c.api_key.trim();
        PublicConfig {
            provider: c.provider.clone(),
            api: c.api,
            base_url: c.base_url.clone(),
            model: c.model.clone(),
            system_prompt: c.system_prompt.clone(),
            default_system_prompt: DEFAULT_SYSTEM_PROMPT,
            price_input: c.price_input,
            price_output: c.price_output,
            key_hint: (!key.is_empty()).then(|| {
                let tail: String = key.chars().rev().take(4).collect::<Vec<_>>().into_iter().rev().collect();
                format!("…{tail}")
            }),
        }
    }
}

/// Cambios enviados desde el formulario. `api_key: None` = conservar la actual.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigInput {
    pub provider: String,
    pub api: Api,
    pub base_url: String,
    pub model: String,
    pub api_key: Option<String>,
    #[serde(default)]
    pub system_prompt: String,
    #[serde(default)]
    pub price_input: Option<f64>,
    #[serde(default)]
    pub price_output: Option<f64>,
}

impl ConfigInput {
    /// Aplica los cambios sobre la configuración actual (para conservar la clave).
    pub fn merge(self, current: Option<&Config>) -> Config {
        let api_key = match self.api_key.map(|k| k.trim().to_string()) {
            Some(k) if !k.is_empty() => k,
            _ => current.map(|c| c.api_key.clone()).unwrap_or_default(),
        };
        Config {
            provider: self.provider,
            api: self.api,
            base_url: self.base_url.trim().trim_end_matches('/').to_string(),
            model: self.model.trim().to_string(),
            api_key,
            system_prompt: self.system_prompt,
            price_input: self.price_input.filter(|p| p.is_finite() && *p >= 0.0),
            price_output: self.price_output.filter(|p| p.is_finite() && *p >= 0.0),
        }
    }
}

pub fn load() -> Option<Config> {
    let data = fs::read_to_string(root().join(CONFIG_FILE)).ok()?;
    serde_json::from_str(&data).ok()
}

pub fn save(config: &Config) -> io::Result<()> {
    let dir = root();
    fs::create_dir_all(&dir)?;
    let data = serde_json::to_vec_pretty(config).map_err(io::Error::other)?;
    write_private(&dir.join(CONFIG_FILE), &data)
}

/// Escritura atómica con permisos 600: la clave solo la lee el usuario.
fn write_private(path: &Path, data: &[u8]) -> io::Result<()> {
    let tmp = path.with_file_name(format!(".{CONFIG_FILE}.tmp"));
    {
        let mut options = fs::OpenOptions::new();
        options.write(true).create(true).truncate(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options.open(&tmp)?;
        file.write_all(data)?;
        file.sync_all()?;
    }
    fs::rename(&tmp, path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input(key: Option<&str>) -> ConfigInput {
        ConfigInput {
            provider: "groq".into(),
            api: Api::Openai,
            base_url: " https://api.groq.com/openai/v1/ ".into(),
            model: " llama ".into(),
            api_key: key.map(Into::into),
            system_prompt: String::new(),
            price_input: Some(0.1),
            price_output: Some(-1.0),
        }
    }

    #[test]
    fn merge_keeps_existing_key_and_normalizes_url() {
        let first = input(Some(" sk-123456 ")).merge(None);
        assert_eq!(first.api_key, "sk-123456");
        assert_eq!(first.base_url, "https://api.groq.com/openai/v1");
        assert_eq!(first.model, "llama");
        assert_eq!(first.price_input, Some(0.1));
        assert_eq!(first.price_output, None);
        let second = input(None).merge(Some(&first));
        assert_eq!(second.api_key, "sk-123456");
        let third = input(Some("")).merge(Some(&first));
        assert_eq!(third.api_key, "sk-123456");
    }

    #[test]
    fn public_config_hides_key() {
        let c = input(Some("sk-abcdefgh")).merge(None);
        let p = PublicConfig::from(&c);
        assert_eq!(p.key_hint.as_deref(), Some("…efgh"));
        assert!(!serde_json::to_string(&p).unwrap().contains("sk-abcdefgh"));
    }
}
