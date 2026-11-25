-- One photo per item. Like business_avatars, the bytes live in their own table so loading items
-- never drags them along. updated_at is kept here rather than on items: it says when the photo
-- last changed, which goes in the photo's URL (?v=) so browsers fetch the new one.
-- Deleting the item deletes its photo.
CREATE TABLE item_photos (
  item_id      INTEGER PRIMARY KEY REFERENCES items (id) ON DELETE CASCADE,
  content_type TEXT        NOT NULL,
  data         BYTEA       NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
