-- Contact details on the public profile, both opt-in so existing profiles show nothing new.
--
-- public_email is a separate address for customers, never the login email: publishing that
-- would hand out half of the account's credentials. NULL means no email is shown.
-- show_phone_publicly lets the owner show the phone they already entered in their profile.
-- The street address and postal code stay private; the profile only shows the city and region.
ALTER TABLE businesses
  ADD COLUMN public_email TEXT CHECK (length(public_email) <= 255),
  ADD COLUMN show_phone_publicly BOOLEAN NOT NULL DEFAULT false;
