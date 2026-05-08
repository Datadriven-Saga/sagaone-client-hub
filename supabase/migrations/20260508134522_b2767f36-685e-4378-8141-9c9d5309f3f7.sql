
UPDATE public.follow_up_cadence_config SET max_attempts = 3 WHERE tel_agent = 'DEFAULT';
DELETE FROM public.follow_up_cadence_intervals WHERE tel_agent = 'DEFAULT';
INSERT INTO public.follow_up_cadence_intervals (tel_agent, from_attempt, wait_interval) VALUES
  ('DEFAULT', 0, interval '1 hour'),
  ('DEFAULT', 1, interval '1 hour'),
  ('DEFAULT', 2, interval '1 hour');
