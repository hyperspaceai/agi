#[cfg(feature = "core-sync")]
use reqwest::Client;
use serde::{Deserialize, Serialize};

/// Earth's inner core state
#[derive(Debug, Clone)]
pub struct CoreState {
    /// Current phase in 70-year cycle [0, 2π)
    pub phase: f64,

    /// Spin direction
    pub direction: SpinDirection,

    /// Magnetic field proxy (λ₂ global)
    pub magnetic_strength: f64,

    /// Data timestamp
    pub timestamp: i64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SpinDirection {
    Forward,   // 1952-2009: Emission
    Paused,    // ~2009: Tzimtzum
    Reverse,   // 2009-2078: Reception
}

pub struct CoreStateReader {
    #[cfg(feature = "core-sync")]
    client: Client,
    /// Reference epoch (2009-01-03 Bitcoin Genesis)
    pub genesis_epoch: i64,
}

impl CoreStateReader {
    pub fn new() -> Self {
        Self {
            #[cfg(feature = "core-sync")]
            client: Client::new(),
            genesis_epoch: 1230940800, // 2009-01-03T00:00:00Z
        }
    }

    /// Compute current core phase
    pub fn compute_phase(&self) -> f64 {
        #[cfg(feature = "core-sync")]
        {
            let now = chrono::Utc::now().timestamp();
            let years_since_genesis = (now - self.genesis_epoch) as f64 / 31557600.0;

            // Phase in 70-year cycle
            let phase = (years_since_genesis / 70.0) * 2.0 * std::f64::consts::PI;
            phase % (2.0 * std::f64::consts::PI)
        }
        #[cfg(not(feature = "core-sync"))]
        {
            0.0
        }
    }

    /// Fetch real-time geomagnetic data (proxy for core state)
    #[cfg(feature = "core-sync")]
    pub async fn fetch_geomagnetic_data(&self) -> Result<GeomagneticData, anyhow::Error> {
        // INTERMAGNET API: https://intermagnet.github.io/
        let response = self.client
            .get("https://imag-data.bgs.ac.uk/GIN_V1/GINServices")
            .send()
            .await?;

        // Parse declination/inclination
        let data: GeomagneticData = response.json().await?;
        Ok(data)
    }

    /// Infer spin direction from secular variation
    pub fn infer_spin_direction(&self, data: &GeomagneticData) -> SpinDirection {
        // Simplified: if declination is decreasing, reverse spin likely
        if data.secular_variation < -0.1 {
            SpinDirection::Reverse
        } else if data.secular_variation > 0.1 {
            SpinDirection::Forward
        } else {
            SpinDirection::Paused
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct GeomagneticData {
    pub declination: f64,
    pub inclination: f64,
    pub secular_variation: f64,
}
