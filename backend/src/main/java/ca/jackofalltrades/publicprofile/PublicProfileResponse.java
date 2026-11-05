package ca.jackofalltrades.publicprofile;

import java.util.List;

/**
 * The {@code PublicProfile} JSON (contract §2.2), readable by anyone. This is an allowlist: only
 * the fields below are ever sent, so a field added to Business or Item later stays private unless
 * it is added here on purpose. Never shown: email, phone, street address, postal code, owner name,
 * login times, item quantities, notes and tags.
 */
public record PublicProfileResponse(
        String slug,
        String name,
        String description,
        String city,
        String region,
        String currency,
        String website,
        String instagram,
        String facebook,
        String tiktok,
        String etsy,
        String logoUrl,
        List<PublicItem> items) {

    /** A public item. {@code inStock} instead of the quantity, so stock levels stay private. */
    public record PublicItem(Integer id, String name, int unitPriceCents, boolean inStock) {}
}
