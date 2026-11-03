-- Profile pictures. The image bytes live in their own table so loading a business never drags
-- them along; businesses.avatar_updated_at says whether there is one (and busts browser caches).
ALTER TABLE businesses ADD COLUMN avatar_updated_at TIMESTAMPTZ;

CREATE TABLE business_avatars (
  business_id  INTEGER PRIMARY KEY REFERENCES businesses (id) ON DELETE CASCADE,
  content_type TEXT  NOT NULL,
  data         BYTEA NOT NULL
);
