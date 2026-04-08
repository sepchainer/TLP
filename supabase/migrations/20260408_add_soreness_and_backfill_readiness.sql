alter table public.wellness_logs
add column if not exists soreness integer;

update public.wellness_logs
set soreness = 5
where soreness is null;

alter table public.wellness_logs
alter column soreness set default 5;