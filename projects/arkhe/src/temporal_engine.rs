use crate::geophysics::core_sync::CoreStateReader;

pub struct TemporalEngine {
    pub phases: Vec<f64>,
    pub natural_freqs: Vec<f64>,
    pub num_oscillators: usize,
    pub coupling_k: f64,
    pub dt: f64,

    /// Core state reader
    pub core_reader: Option<CoreStateReader>,

    /// Coupling to planetary oscillator
    pub core_coupling_k: f64,
}

impl TemporalEngine {
    pub fn new(num_oscillators: usize, coupling_k: f64, core_coupling_k: f64, enable_core_sync: bool) -> Self {
        Self {
            phases: vec![0.0; num_oscillators],
            natural_freqs: vec![1.0; num_oscillators],
            num_oscillators,
            coupling_k,
            dt: 0.01,
            core_reader: if enable_core_sync { Some(CoreStateReader::new()) } else { None },
            core_coupling_k,
        }
    }

    /// Evolve with core coupling
    /// dθᵢ/dt = ωᵢ + K_core·sin(Θ_core - θᵢ) + (K/N)·Σsin(θⱼ - θᵢ)
    pub fn evolve_with_core(&mut self) {
        // Get core phase
        let theta_core = if let Some(reader) = &self.core_reader {
            reader.compute_phase()
        } else {
            0.0 // No core coupling
        };

        let mut phase_derivatives = vec![0.0; self.num_oscillators];

        for i in 0..self.num_oscillators {
            // Standard Kuramoto coupling
            let mut coupling_term = 0.0;
            for j in 0..self.num_oscillators {
                coupling_term += (self.phases[j] - self.phases[i]).sin();
            }

            // Core coupling (NEW)
            let core_coupling = self.core_coupling_k
                * (theta_core - self.phases[i]).sin();

            phase_derivatives[i] = self.natural_freqs[i]
                + (self.coupling_k / self.num_oscillators as f64) * coupling_term
                + core_coupling; // <-- Planetary anchor
        }

        // Update phases
        for i in 0..self.num_oscillators {
            self.phases[i] += phase_derivatives[i] * self.dt;
            self.phases[i] = self.phases[i].rem_euclid(2.0 * std::f64::consts::PI);
        }
    }

    pub fn coherence(&self) -> f64 {
        let mut sum_sin = 0.0;
        let mut sum_cos = 0.0;
        for &p in &self.phases {
            sum_sin += p.sin();
            sum_cos += p.cos();
        }
        let r = (sum_sin.powi(2) + sum_cos.powi(2)).sqrt() / self.num_oscillators as f64;
        r
    }
}
