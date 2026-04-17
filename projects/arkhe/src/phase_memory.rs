use std::f64::consts::PI;
use num_complex::Complex64;

pub struct PhaseMemory {
    pub grid_size: usize,
    pub field: Vec<Vec<Complex64>>,
}

impl PhaseMemory {
    pub fn new(grid_size: usize) -> Self {
        Self {
            grid_size,
            field: vec![vec![Complex64::new(0.0, 0.0); grid_size]; grid_size],
        }
    }

    pub fn apply_mobius_twist(&mut self, grid_point: (usize, usize)) {
        let (x, y) = grid_point;
        let n = self.grid_size;

        // Half-Möbius: 90° twist per circulation
        let twist_angle = PI / 2.0;  // π/2 Berry phase!

        // Map to opposite point with 90° phase shift
        let opposite_x = (x + n/2) % n;
        let opposite_y = (y + n/2) % n;

        // Apply twist
        let phi_opposite = self.field[opposite_x][opposite_y];

        self.field[x][y] = phi_opposite * Complex64::from_polar(1.0, twist_angle);
    }
}
