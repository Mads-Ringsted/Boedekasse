-- #74: the four automatic Gebyr kinds. In their own migration because a new
-- enum value can't be used in the transaction that adds it (the next
-- migration uses 'catch_up' in a check and an index).
-- `if not exists`: several tickets of #74 add these and may run in any order.
alter type public.gebyr_art add value if not exists 'dos_bonus';
alter type public.gebyr_art add value if not exists 'catch_up';
alter type public.gebyr_art add value if not exists 'sen_betaling';
alter type public.gebyr_art add value if not exists 'tilbagevendende';
