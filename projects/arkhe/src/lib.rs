pub mod geophysics;
pub mod temporal_engine;

pub struct OrbVMConfig {
    pub num_oscillators: usize,
    pub coupling_k: f64,
    pub core_coupling_k: f64,
    pub enable_core_sync: bool,
}

impl Default for OrbVMConfig {
    fn default() -> Self {
        Self {
            num_oscillators: 10,
            coupling_k: 0.5,
            core_coupling_k: 0.1,
            enable_core_sync: false,
        }
    }
}
