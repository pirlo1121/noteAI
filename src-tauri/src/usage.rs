// Registro de consumo: una línea JSON por respuesta en ~/.noteai/usage.jsonl.
//
// El coste se calcula al guardar con los precios configurados en ese momento,
// así cambiar de precio o de modelo no reescribe el pasado. Es una estimación
// local: la factura real está en la consola de cada proveedor.

use std::{
    fs, io,
    io::Write,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};

use crate::config::{self, Config};

const USAGE_FILE: &str = "usage.jsonl";
/// Aproximación habitual cuando el proveedor no informa de los tokens.
const CHARS_PER_TOKEN: usize = 4;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Record {
    /// Milisegundos desde 1970.
    pub at: i64,
    pub provider: String,
    pub model: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    /// `true` si los tokens se estimaron a partir del texto (el proveedor no los dio).
    pub estimated: bool,
    /// US$; `None` si no hay precios configurados.
    pub cost: Option<f64>,
}

fn path() -> PathBuf {
    config::root().join(USAGE_FILE)
}

pub fn estimate_tokens(chars: usize) -> u64 {
    chars.div_ceil(CHARS_PER_TOKEN) as u64
}

pub fn cost(config: &Config, input: u64, output: u64) -> Option<f64> {
    let (pi, po) = (config.price_input?, config.price_output?);
    Some((input as f64 * pi + output as f64 * po) / 1_000_000.0)
}

pub fn record(config: &Config, input: u64, output: u64, estimated: bool) -> Record {
    let at = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0);
    Record {
        at,
        provider: config.provider.clone(),
        model: config.model.clone(),
        input_tokens: input,
        output_tokens: output,
        estimated,
        cost: cost(config, input, output),
    }
}

pub fn append(r: &Record) -> io::Result<()> {
    let mut line = serde_json::to_string(r).map_err(io::Error::other)?;
    line.push('\n');
    fs::OpenOptions::new().create(true).append(true).open(path())?.write_all(line.as_bytes())
}

/// Todos los registros; las líneas dañadas se ignoran.
pub fn read_all() -> Vec<Record> {
    fs::read_to_string(path())
        .map(|s| s.lines().filter_map(|l| serde_json::from_str(l).ok()).collect())
        .unwrap_or_default()
}

pub fn clear() -> io::Result<()> {
    match fs::remove_file(path()) {
        Err(e) if e.kind() != io::ErrorKind::NotFound => Err(e),
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Api;

    #[test]
    fn cost_needs_both_prices() {
        let mut c = Config {
            provider: "anthropic".into(),
            api: Api::Anthropic,
            base_url: String::new(),
            model: "m".into(),
            api_key: String::new(),
            system_prompt: String::new(),
            price_input: Some(0.10),
            price_output: Some(0.50),
        };
        let total = cost(&c, 1_000_000, 2_000_000).unwrap();
        assert!((total - 1.10).abs() < 1e-9);
        c.price_output = None;
        assert_eq!(cost(&c, 10, 10), None);
    }

    #[test]
    fn estimates_round_up() {
        assert_eq!(estimate_tokens(0), 0);
        assert_eq!(estimate_tokens(1), 1);
        assert_eq!(estimate_tokens(8), 2);
    }
}
