select
  count(*) as current_score_rows,
  min(date) as earliest_date,
  max(date) as latest_date,
  min(score_value) as min_score,
  max(score_value) as max_score,
  round(avg(score_value)::numeric, 2) as avg_score
from public.readiness_scores;

select
  current_scores.date,
  round(avg(current_scores.score_value)::numeric, 2) as avg_new_score,
  count(*) as row_count
from public.readiness_scores current_scores
group by current_scores.date
order by current_scores.date desc
limit 30;

with score_context as (
  select
    current_scores.user_id,
    current_scores.date,
    current_scores.score_value as readiness_score,
    wellness.mood,
    wellness.recovery,
    wellness.health_status,
    wellness.physical,
    wellness.sleep,
    wellness.stress,
    coalesce(wellness.soreness, 5) as soreness,
    wellness.is_sick,
    wellness.is_injured,
    wellness.hrv,
    wellness.sleep_hours,
    wellness.resting_hr,
    (
      coalesce(wellness.mood, 5) +
      coalesce(wellness.recovery, 5) +
      coalesce(wellness.health_status, 5) +
      coalesce(wellness.physical, 5) +
      coalesce(wellness.sleep, 5) +
      (11 - coalesce(wellness.stress, 5)) +
      (11 - coalesce(wellness.soreness, 5))
    ) / 7.0 as subjective_balance,
    (case when wellness.hrv is not null then 1 else 0 end) +
    (case when wellness.sleep_hours is not null then 1 else 0 end) +
    (case when wellness.resting_hr is not null then 1 else 0 end) as objective_metric_count,
    coalesce(loads.current_day_load, 0) as current_day_load,
    coalesce(loads.past_six_days_load, 0) as past_six_days_load,
    coalesce(loads.past_thirteen_days_load, 0) as past_thirteen_days_load,
    coalesce(loads.acute_average, 0) as acute_average,
    coalesce(loads.chronic_average, 0) as chronic_average,
    case
      when coalesce(loads.protected_baseline, 0) > 0 then round((loads.current_day_load / loads.protected_baseline)::numeric, 2)
      else null
    end as daily_spike_ratio,
    case
      when coalesce(loads.chronic_average, 0) > 0 then round((loads.acute_average / loads.chronic_average)::numeric, 2)
      else null
    end as load_ramp_ratio
  from public.readiness_scores current_scores
  left join public.wellness_logs wellness
    on wellness.user_id = current_scores.user_id
   and wellness.date = current_scores.date
  left join lateral (
    select
      coalesce(sum(case when wl.date::date = current_scores.date::date then wl.calculated_load else 0 end), 0)::numeric as current_day_load,
      coalesce(sum(case when wl.date::date between (current_scores.date::date - interval '6 day')::date and (current_scores.date::date - interval '1 day')::date then wl.calculated_load else 0 end), 0)::numeric as past_six_days_load,
      coalesce(sum(case when wl.date::date between (current_scores.date::date - interval '13 day')::date and (current_scores.date::date - interval '1 day')::date then wl.calculated_load else 0 end), 0)::numeric as past_thirteen_days_load,
      ((coalesce(sum(case when wl.date::date between (current_scores.date::date - interval '6 day')::date and current_scores.date::date then wl.calculated_load else 0 end), 0)) / 7.0)::numeric as acute_average,
      (case
        when coalesce(sum(case when wl.date::date between (current_scores.date::date - interval '13 day')::date and (current_scores.date::date - interval '1 day')::date then wl.calculated_load else 0 end), 0) > 0
          then (coalesce(sum(case when wl.date::date between (current_scores.date::date - interval '13 day')::date and (current_scores.date::date - interval '1 day')::date then wl.calculated_load else 0 end), 0) / 13.0)::numeric
        else ((coalesce(sum(case when wl.date::date between (current_scores.date::date - interval '6 day')::date and current_scores.date::date then wl.calculated_load else 0 end), 0)) / 7.0)::numeric
      end) as chronic_average,
      greatest(
        (case
          when coalesce(sum(case when wl.date::date between (current_scores.date::date - interval '6 day')::date and (current_scores.date::date - interval '1 day')::date then wl.calculated_load else 0 end), 0) > 0
            then (coalesce(sum(case when wl.date::date between (current_scores.date::date - interval '6 day')::date and (current_scores.date::date - interval '1 day')::date then wl.calculated_load else 0 end), 0) / 6.0)::numeric
          when coalesce(sum(case when wl.date::date between (current_scores.date::date - interval '13 day')::date and (current_scores.date::date - interval '1 day')::date then wl.calculated_load else 0 end), 0) > 0
            then (coalesce(sum(case when wl.date::date between (current_scores.date::date - interval '13 day')::date and (current_scores.date::date - interval '1 day')::date then wl.calculated_load else 0 end), 0) / 13.0)::numeric
          else 0::numeric
        end),
        (case
          when coalesce(sum(case when wl.date::date = current_scores.date::date then wl.calculated_load else 0 end), 0) > 0 then 75::numeric
          else 0::numeric
        end)
      ) as protected_baseline
    from public.workout_logs wl
    where wl.user_id = current_scores.user_id
      and wl.date::date between (current_scores.date::date - interval '13 day')::date and current_scores.date::date
  ) loads on true
)
select
  case
    when subjective_balance >= 8 then '8.0_plus'
    when subjective_balance >= 7 then '7.0_to_7.99'
    when subjective_balance >= 6 then '6.0_to_6.99'
    when subjective_balance >= 5 then '5.0_to_5.99'
    else 'below_5.0'
  end as subjective_bucket,
  count(*) as row_count,
  round(avg(readiness_score)::numeric, 2) as avg_readiness,
  round(avg(current_day_load)::numeric, 2) as avg_current_load,
  round(avg(coalesce(daily_spike_ratio, 1))::numeric, 2) as avg_spike_ratio
from score_context
group by 1
order by 1 desc;

with score_context as (
  select
    current_scores.user_id,
    current_scores.date,
    current_scores.score_value as readiness_score,
    coalesce(loads.current_day_load, 0) as current_day_load,
    case
      when coalesce(loads.protected_baseline, 0) > 0 then (loads.current_day_load / loads.protected_baseline)
      else null
    end as daily_spike_ratio,
    case
      when coalesce(loads.chronic_average, 0) > 0 then (loads.acute_average / loads.chronic_average)
      else null
    end as load_ramp_ratio
  from public.readiness_scores current_scores
  left join lateral (
    select
      coalesce(sum(case when wl.date::date = current_scores.date::date then wl.calculated_load else 0 end), 0)::numeric as current_day_load,
      ((coalesce(sum(case when wl.date::date between (current_scores.date::date - interval '6 day')::date and current_scores.date::date then wl.calculated_load else 0 end), 0)) / 7.0)::numeric as acute_average,
      (case
        when coalesce(sum(case when wl.date::date between (current_scores.date::date - interval '13 day')::date and (current_scores.date::date - interval '1 day')::date then wl.calculated_load else 0 end), 0) > 0
          then (coalesce(sum(case when wl.date::date between (current_scores.date::date - interval '13 day')::date and (current_scores.date::date - interval '1 day')::date then wl.calculated_load else 0 end), 0) / 13.0)::numeric
        else ((coalesce(sum(case when wl.date::date between (current_scores.date::date - interval '6 day')::date and current_scores.date::date then wl.calculated_load else 0 end), 0)) / 7.0)::numeric
      end) as chronic_average,
      greatest(
        (case
          when coalesce(sum(case when wl.date::date between (current_scores.date::date - interval '6 day')::date and (current_scores.date::date - interval '1 day')::date then wl.calculated_load else 0 end), 0) > 0
            then (coalesce(sum(case when wl.date::date between (current_scores.date::date - interval '6 day')::date and (current_scores.date::date - interval '1 day')::date then wl.calculated_load else 0 end), 0) / 6.0)::numeric
          when coalesce(sum(case when wl.date::date between (current_scores.date::date - interval '13 day')::date and (current_scores.date::date - interval '1 day')::date then wl.calculated_load else 0 end), 0) > 0
            then (coalesce(sum(case when wl.date::date between (current_scores.date::date - interval '13 day')::date and (current_scores.date::date - interval '1 day')::date then wl.calculated_load else 0 end), 0) / 13.0)::numeric
          else 0::numeric
        end),
        (case
          when coalesce(sum(case when wl.date::date = current_scores.date::date then wl.calculated_load else 0 end), 0) > 0 then 75::numeric
          else 0::numeric
        end)
      ) as protected_baseline
    from public.workout_logs wl
    where wl.user_id = current_scores.user_id
      and wl.date::date between (current_scores.date::date - interval '13 day')::date and current_scores.date::date
  ) loads on true
)
select
  case
    when current_day_load = 0 then 'rest_day'
    when daily_spike_ratio >= 1.5 then 'spike_1.5_plus'
    when daily_spike_ratio >= 1.25 then 'spike_1.25_to_1.49'
    when load_ramp_ratio >= 1.1 then 'ramp_1.10_plus'
    when current_day_load >= 300 then 'high_load_no_spike'
    else 'normal_load_day'
  end as load_bucket,
  count(*) as row_count,
  round(avg(readiness_score)::numeric, 2) as avg_readiness,
  round(avg(current_day_load)::numeric, 2) as avg_current_load,
  round(avg(coalesce(daily_spike_ratio, 1))::numeric, 2) as avg_spike_ratio,
  round(avg(coalesce(load_ramp_ratio, 1))::numeric, 2) as avg_ramp_ratio
from score_context
group by 1
order by 1;

with score_context as (
  select
    current_scores.user_id,
    current_scores.date,
    current_scores.score_value as readiness_score,
    wellness.mood,
    wellness.recovery,
    wellness.health_status,
    wellness.physical,
    wellness.sleep,
    wellness.stress,
    coalesce(wellness.soreness, 5) as soreness,
    (case when wellness.hrv is not null then 1 else 0 end) +
    (case when wellness.sleep_hours is not null then 1 else 0 end) +
    (case when wellness.resting_hr is not null then 1 else 0 end) as objective_metric_count,
    (
      coalesce(wellness.mood, 5) +
      coalesce(wellness.recovery, 5) +
      coalesce(wellness.health_status, 5) +
      coalesce(wellness.physical, 5) +
      coalesce(wellness.sleep, 5) +
      (11 - coalesce(wellness.stress, 5)) +
      (11 - coalesce(wellness.soreness, 5))
    ) / 7.0 as subjective_balance
  from public.readiness_scores current_scores
  left join public.wellness_logs wellness
    on wellness.user_id = current_scores.user_id
   and wellness.date = current_scores.date
)
select
  objective_metric_count,
  count(*) as row_count,
  round(avg(readiness_score)::numeric, 2) as avg_readiness,
  round(avg(subjective_balance)::numeric, 2) as avg_subjective_balance
from score_context
group by objective_metric_count
order by objective_metric_count desc;

with score_context as (
  select
    current_scores.user_id,
    current_scores.date,
    current_scores.score_value as readiness_score,
    wellness.mood,
    wellness.recovery,
    wellness.health_status,
    wellness.physical,
    wellness.sleep,
    wellness.stress,
    coalesce(wellness.soreness, 5) as soreness,
    wellness.is_sick,
    wellness.is_injured,
    (
      coalesce(wellness.mood, 5) +
      coalesce(wellness.recovery, 5) +
      coalesce(wellness.health_status, 5) +
      coalesce(wellness.physical, 5) +
      coalesce(wellness.sleep, 5) +
      (11 - coalesce(wellness.stress, 5)) +
      (11 - coalesce(wellness.soreness, 5))
    ) / 7.0 as subjective_balance,
    coalesce(loads.current_day_load, 0) as current_day_load,
    case
      when coalesce(loads.protected_baseline, 0) > 0 then round((loads.current_day_load / loads.protected_baseline)::numeric, 2)
      else null
    end as daily_spike_ratio
  from public.readiness_scores current_scores
  left join public.wellness_logs wellness
    on wellness.user_id = current_scores.user_id
   and wellness.date = current_scores.date
  left join lateral (
    select
      coalesce(sum(case when wl.date::date = current_scores.date::date then wl.calculated_load else 0 end), 0)::numeric as current_day_load,
      greatest(
        (case
          when coalesce(sum(case when wl.date::date between (current_scores.date::date - interval '6 day')::date and (current_scores.date::date - interval '1 day')::date then wl.calculated_load else 0 end), 0) > 0
            then (coalesce(sum(case when wl.date::date between (current_scores.date::date - interval '6 day')::date and (current_scores.date::date - interval '1 day')::date then wl.calculated_load else 0 end), 0) / 6.0)::numeric
          when coalesce(sum(case when wl.date::date between (current_scores.date::date - interval '13 day')::date and (current_scores.date::date - interval '1 day')::date then wl.calculated_load else 0 end), 0) > 0
            then (coalesce(sum(case when wl.date::date between (current_scores.date::date - interval '13 day')::date and (current_scores.date::date - interval '1 day')::date then wl.calculated_load else 0 end), 0) / 13.0)::numeric
          else 0::numeric
        end),
        (case
          when coalesce(sum(case when wl.date::date = current_scores.date::date then wl.calculated_load else 0 end), 0) > 0 then 75::numeric
          else 0::numeric
        end)
      ) as protected_baseline
    from public.workout_logs wl
    where wl.user_id = current_scores.user_id
      and wl.date::date between (current_scores.date::date - interval '13 day')::date and current_scores.date::date
  ) loads on true
)
select
  user_id,
  date,
  readiness_score,
  round(subjective_balance::numeric, 2) as subjective_balance,
  current_day_load,
  daily_spike_ratio,
  mood,
  recovery,
  health_status,
  physical,
  sleep,
  stress,
  soreness,
  is_sick,
  is_injured
from score_context
where subjective_balance >= 7.5
  and readiness_score <= 65
order by subjective_balance desc, readiness_score asc, date desc
limit 25;