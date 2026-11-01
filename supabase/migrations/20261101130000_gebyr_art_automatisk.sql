-- #74: the four automatic Gebyr kinds. Shared by #77 (Dos-bonus), #78
-- (Catch-up), #79 (Sen betaling) and #80 (Tilbagevendende Gebyr), so each
-- value is added only if it is missing. A new enum value can't be used in the
-- transaction that adds it, so this file holds nothing else.
alter type public.gebyr_art add value if not exists 'dos_bonus';
alter type public.gebyr_art add value if not exists 'catch_up';
alter type public.gebyr_art add value if not exists 'sen_betaling';
alter type public.gebyr_art add value if not exists 'tilbagevendende';
