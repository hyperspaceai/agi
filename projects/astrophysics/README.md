# astrophysics

Train a small language model on astrophysics papers. Character-level tokenization, explore architecture and training hyperparameters to minimize validation loss on scientific text.

## Baseline

- **Architecture**: 2 layers, 64 dim, 2 heads, 128 context, GELU, LayerNorm
- **Optimizer**: AdamW, lr=3e-4, wd=0.01
- **Schedule**: Cosine, 100 warmup steps
- **Training**: batch 8, 500 steps, 300s max
- **Baseline val_loss**: ~4.0

## What to Explore

- Scientific text has different statistical properties than stories — may benefit from different architectures
- Larger context windows for longer paper abstracts
- RMSNorm vs LayerNorm for scientific text stability
- Rotary position encoding for longer sequences
- Higher learning rates with warmup for faster convergence
- Weight tying effects on specialized vocabulary

## Dataset

Astrophysics paper abstracts from arXiv. Character-level tokenization (ASCII-128 vocab).

## Leaderboard

See [LEADERBOARD.md](LEADERBOARD.md) (auto-updated every 6 hours).
