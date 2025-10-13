"""Monte Carlo simulation for PitchGuard annual usage and value generation.

This script models adoption, premium conversions, and analyst time savings over
one year to evaluate product impact and identify improvement levers.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass
from statistics import mean
from typing import Iterable, List


@dataclass
class SimulationConfig:
    days: int = 365
    trials: int = 10000
    initial_daily_users: int = 60
    weekly_growth_mean: float = 0.08  # 8% avg weekly growth from campus evangelism
    weekly_growth_std: float = 0.05
    retention_mean: float = 0.88  # proportion returning next week
    retention_std: float = 0.04
    premium_conversion_mean: float = 0.11
    premium_conversion_std: float = 0.025
    premium_arpu_monthly: float = 49.0
    analyses_per_user_mean: float = 2.6
    analyses_per_user_std: float = 0.5
    hours_saved_per_analysis: float = 1.8
    internship_win_rate_uplift: float = 0.12  # incremental placement probability


@dataclass
class SimulationResult:
    total_analyses: float
    total_hours_saved: float
    annual_recurring_revenue: float
    premium_users: float
    internship_offers_delta: float
    daily_user_peak: float


@dataclass
class SummaryStats:
    mean: float
    p10: float
    p90: float


def bounded_gauss(mean_value: float, std_dev: float, lower: float, upper: float) -> float:
    value = random.gauss(mean_value, std_dev)
    return min(max(value, lower), upper)


def percentile(sorted_values: List[float], pct: float) -> float:
    if not sorted_values:
        return 0.0
    k = (len(sorted_values) - 1) * pct
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_values[int(k)]
    d0 = sorted_values[f] * (c - k)
    d1 = sorted_values[c] * (k - f)
    return d0 + d1


def run_trial(config: SimulationConfig) -> SimulationResult:
    weekly_period = 7
    weeks = math.ceil(config.days / weekly_period)

    weekly_growth = [random.gauss(config.weekly_growth_mean, config.weekly_growth_std) for _ in range(weeks)]
    weekly_retention = [
        bounded_gauss(config.retention_mean, config.retention_std, 0.4, 0.98) for _ in range(weeks)
    ]

    daily_users: List[float] = []
    current_users = float(config.initial_daily_users)

    for day in range(config.days):
        week_idx = min(day // weekly_period, weeks - 1)
        if day % weekly_period == 0 and day > 0:
            current_users *= 1 + weekly_growth[week_idx]
            current_users *= weekly_retention[week_idx]
        noise = random.gauss(0, current_users * 0.05)
        today_users = max(current_users + noise, 5.0)
        daily_users.append(today_users)

    total_users = sum(daily_users)
    analyses_per_user = max(0.5, random.gauss(config.analyses_per_user_mean, config.analyses_per_user_std))
    total_analyses = analyses_per_user * total_users

    hours_saved = total_analyses * config.hours_saved_per_analysis

    premium_conversion = bounded_gauss(config.premium_conversion_mean, config.premium_conversion_std, 0.02, 0.3)
    premium_users = premium_conversion * (total_users / config.days)
    arr = premium_users * config.premium_arpu_monthly * 12

    internship_offers_delta = (total_users / config.days) * config.internship_win_rate_uplift

    return SimulationResult(
        total_analyses=total_analyses,
        total_hours_saved=hours_saved,
        annual_recurring_revenue=arr,
        premium_users=premium_users,
        internship_offers_delta=internship_offers_delta,
        daily_user_peak=max(daily_users),
    )


def summarise(values: Iterable[float]) -> SummaryStats:
    collected = list(values)
    collected.sort()
    return SummaryStats(
        mean=mean(collected) if collected else 0.0,
        p10=percentile(collected, 0.10),
        p90=percentile(collected, 0.90),
    )


def run_simulation(config: SimulationConfig = SimulationConfig()) -> dict[str, SummaryStats]:
    results = [run_trial(config) for _ in range(config.trials)]
    return {
        "total_analyses": summarise(result.total_analyses for result in results),
        "total_hours_saved": summarise(result.total_hours_saved for result in results),
        "annual_recurring_revenue": summarise(result.annual_recurring_revenue for result in results),
        "premium_users": summarise(result.premium_users for result in results),
        "internship_offers_delta": summarise(result.internship_offers_delta for result in results),
        "daily_user_peak": summarise(result.daily_user_peak for result in results),
    }


def format_summary(stats: dict[str, SummaryStats]) -> str:
    lines = [
        "PitchGuard Monte Carlo Usage Forecast (1-year horizon, 10,000 trials)",
        "------------------------------------------------------------------",
    ]
    for metric, summary in stats.items():
        if summary.mean >= 100:
            fmt = "{name}: mean={mean:,.0f}, p10={p10:,.0f}, p90={p90:,.0f}"
        else:
            fmt = "{name}: mean={mean:,.1f}, p10={p10:,.1f}, p90={p90:,.1f}"
        lines.append(
            fmt.format(
                name=metric.replace('_', ' ').title(),
                mean=summary.mean,
                p10=summary.p10,
                p90=summary.p90,
            )
        )
    return "\n".join(lines)


if __name__ == "__main__":
    summaries = run_simulation()
    print(format_summary(summaries))
