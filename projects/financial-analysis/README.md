# financial-analysis

Autonomous financial backtesting — agents generate and evolve trading strategies scored by Sharpe ratio.

## Baseline

- **Strategy**: Simple momentum (SMA crossover)
- **Universe**: Synthetic price series (seeded PRNG for reproducibility)
- **Evaluator**: FinanceBacktestEvaluator — runs 252-day backtest, scores by Sharpe ratio
- **Baseline Sharpe**: ~0.0

## What to Explore

- Alternative momentum signals (EMA, MACD, RSI)
- Mean-reversion strategies for range-bound markets
- Volatility-adjusted position sizing
- Multi-factor combinations
- Regime detection (trending vs mean-reverting)

## Metric

**Sharpe Ratio** (higher is better). Experiment files: `finance-r{N}.json`.

## Leaderboard

See [LEADERBOARD.md](LEADERBOARD.md) (auto-updated every 6 hours).
