-- This marker is checked by both integration suites before any spec runs.
CREATE TABLE public.phase0_test_guard (
  id integer PRIMARY KEY CHECK (id = 1),
  marker text NOT NULL CHECK (marker = 'dacho-phase0-disposable-v1')
);
INSERT INTO public.phase0_test_guard (id, marker)
VALUES (1, 'dacho-phase0-disposable-v1');
