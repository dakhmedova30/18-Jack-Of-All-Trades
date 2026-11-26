package ca.jackofalltrades.publicprofile;

import java.util.List;

/**
 * The {@code PublicProfile} JSON (contract §2.2), readable by anyone. This is an allowlist: only
 * the fields below are ever sent, so a field added to Business or Item later stays private unless
 * it is added here on purpose. Never shown: the login email, street address, postal code, owner name,
 * login times, item quantities, notes and tags. Contact details are opt-in: {@code email} is the
 * separate public contact email, and {@code phone} is null unless the owner chose to show it.
 */
public record PublicProfileResponse(
        String slug,
        String name,
        String description,
        String city,
        String region,
        String currency,
        String email,
        String phone,
        String website,
        String instagram,
        String facebook,
        String tiktok,
        String etsy,
        String logoUrl,
        List<PublicItem> items) {

    /**
     * A public item. {@code inStock} instead of the quantity, so stock levels stay private.
     * {@code photoUrl} is null when the item has no photo.
     */
    public record PublicItem(Integer id, String name, int unitPriceCents, boolean inStock, String photoUrl) {}
}
