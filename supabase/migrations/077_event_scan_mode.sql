-- Migration 077: per-event scan mode - which deck of cards the game runs on.
--
-- The choice between a combined card (one scan scores) and split cards (a
-- participant card, then a task card) used to be made in a modal at print time
-- and lived in component state, so nothing remembered it. Reopening the wizard
-- offered 'combined' again, and an operator who had printed split decks got no
-- hint of that anywhere. The wizard now asks for it in a step of its own, so
-- the answer has to outlive the page.
--
-- NULL means nobody has chosen yet. Existing games are deliberately left NULL
-- rather than backfilled: we do not know which deck they printed, and being
-- asked once is better than being told a wrong answer. Printing falls back to
-- 'combined' while it is NULL, exactly as it did before this column existed.
--
-- The scanner reads both kinds of card regardless - like barcode_type (070),
-- this governs only how cards are laid out for printing.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS scan_mode TEXT
  CHECK (scan_mode IS NULL OR scan_mode IN ('combined', 'split'));

-- No new policy: the owner's own UPDATE policy (001) already covers this
-- column, and the wizard is the only thing that writes it.
