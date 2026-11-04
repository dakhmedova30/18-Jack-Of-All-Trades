-- The public business profile (D1's US3/US4): customers browse a business's chosen items
-- at /p/<public_slug> without logging in.
--
-- Both start "off": existing items stay private, and a business has no public profile
-- until its owner picks a link name (NULL = no profile). UNIQUE allows many NULLs.
ALTER TABLE items
  ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE businesses
  ADD COLUMN public_slug TEXT UNIQUE
    CHECK (public_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(public_slug) BETWEEN 3 AND 40);
