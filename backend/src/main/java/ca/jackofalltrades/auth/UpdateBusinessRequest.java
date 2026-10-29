package ca.jackofalltrades.auth;

import jakarta.validation.constraints.Size;
import java.util.Locale;

/**
 * {@code PATCH /api/auth/me} body. Every field is optional: a missing (null) field is left alone.
 * For every optional text field (type, country, owner name, contact, links), an empty string clears the value. The compact
 * constructor trims before validation runs.
 */
public record UpdateBusinessRequest(
        @Size(max = 120, message = "Business name must be at most 120 characters")
        String name,

        @Size(max = 60, message = "Business type must be at most 60 characters")
        String businessType,

        @Size(max = 80, message = "Country must be at most 80 characters")
        String country,

        @Size(max = 64, message = "Time zone must be at most 64 characters")
        String timeZone,

        @Size(max = 3, message = "Currency must be a 3-letter code")
        String currency,

        @Size(max = 60, message = "First name must be at most 60 characters")
        String ownerFirstName,

        @Size(max = 60, message = "Last name must be at most 60 characters")
        String ownerLastName,

        @Size(max = 30, message = "Phone number must be at most 30 characters")
        String phone,

        @Size(max = 120, message = "Address must be at most 120 characters")
        String addressLine,

        @Size(max = 80, message = "City must be at most 80 characters")
        String city,

        @Size(max = 80, message = "Province or state must be at most 80 characters")
        String region,

        @Size(max = 20, message = "Postal code must be at most 20 characters")
        String postalCode,

        @Size(max = 300, message = "Description must be at most 300 characters")
        String description,

        @Size(max = 200, message = "Website must be at most 200 characters")
        String website,

        @Size(max = 200, message = "Instagram link must be at most 200 characters")
        String instagram,

        @Size(max = 200, message = "Facebook link must be at most 200 characters")
        String facebook,

        @Size(max = 200, message = "TikTok link must be at most 200 characters")
        String tiktok,

        @Size(max = 200, message = "Etsy link must be at most 200 characters")
        String etsy) {

    public UpdateBusinessRequest {
        name = strip(name);
        businessType = strip(businessType);
        country = strip(country);
        timeZone = strip(timeZone);
        currency = currency == null ? null : currency.strip().toUpperCase(Locale.ROOT);
        ownerFirstName = strip(ownerFirstName);
        ownerLastName = strip(ownerLastName);
        phone = strip(phone);
        addressLine = strip(addressLine);
        city = strip(city);
        region = strip(region);
        postalCode = strip(postalCode);
        description = strip(description);
        website = strip(website);
        instagram = strip(instagram);
        facebook = strip(facebook);
        tiktok = strip(tiktok);
        etsy = strip(etsy);
    }

    private static String strip(String value) {
        return value == null ? null : value.strip();
    }
}
