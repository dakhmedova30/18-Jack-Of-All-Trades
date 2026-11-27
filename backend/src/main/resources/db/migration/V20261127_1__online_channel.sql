ALTER TABLE channels ADD COLUMN is_online BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE channels SET is_online = TRUE WHERE lower(name) = 'online';

CREATE UNIQUE INDEX idx_channels_business_online ON channels (business_id) WHERE is_online;
