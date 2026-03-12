// opu_topology.v - Half-Möbius phase memory

module phase_memory_cell(
    input wire clk,
    input wire [7:0] phase_in,
    output reg [7:0] phase_out,
    input wire topology_mode  // 0=planar, 1=half-Mobius
);

parameter BERRY_PHASE = 8'h40;  // π/2 in fixed-point

always @(posedge clk) begin
    if (topology_mode) begin
        // Half-Möbius: add Berry phase
        phase_out <= phase_in + BERRY_PHASE;
    end else begin
        // Planar: direct pass-through
        phase_out <= phase_in;
    end
end

endmodule
