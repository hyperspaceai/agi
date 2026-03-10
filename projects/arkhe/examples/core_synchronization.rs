use arkhe::temporal_engine::TemporalEngine;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    println!("=== EXPERIMENT 4: CORE SYNCHRONIZATION ===\n");

    // Scenario 1: With core sync (K_core = 0.1)
    let mut engine_core = TemporalEngine::new(10, 0.5, 0.1, false); // false to avoid real HTTP in example
    // Manually setting a theta_core for the simulation
    let theta_core = 1.23;

    for _ in 0..1000 {
        engine_core.evolve_with_core();
    }
    let coherence_core = engine_core.coherence();

    // Scenario 2: Without core sync (control)
    let mut engine_no_core = TemporalEngine::new(10, 0.5, 0.0, false);

    for _ in 0..1000 {
        engine_no_core.evolve_with_core();
    }
    let coherence_no_core = engine_no_core.coherence();

    println!("Coherence (with core):    {:.4}", coherence_core);
    println!("Coherence (without core): {:.4}", coherence_no_core);
    println!("Enhancement: {:.1}%",
        (coherence_core / coherence_no_core - 1.0) * 100.0);

    Ok(())
}
