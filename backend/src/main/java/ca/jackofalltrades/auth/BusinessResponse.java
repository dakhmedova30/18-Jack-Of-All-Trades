package ca.jackofalltrades.auth;

import java.time.Instant;

/** The {@code Business} JSON in contract §2. */
public record BusinessResponse(
        Integer id,
        String name,
        String email,
        String businessType,
        String country,
        String timeZone,
        String currency,
        Instant lastLoginAt,
        String avatarUrl,
        String ownerFirstName,
        String ownerLastName,
        String phone,
        String addressLine,
        String city,
        String region,
        String postalCode,
        String description,
        String website,
        String instagram,
        String facebook,
        String tiktok,
        String etsy,
        String logoUrl,
        Instant createdAt) {

    /** An image's URL, or null. The version in the query string makes browsers refetch a new image. */
    private static String imageUrl(Instant updatedAt, String name) {
        return updatedAt == null ? null : "/api/auth/me/" + name + "?v=" + updatedAt.toEpochMilli();
    }

    static BusinessResponse from(Business business) {
        return new BusinessResponse(
                business.getId(),
                business.getName(),
                business.getEmail(),
                business.getBusinessType(),
                business.getCountry(),
                business.getTimeZone(),
                business.getCurrency(),
                business.getLastLoginAt(),
                imageUrl(business.getAvatarUpdatedAt(), "avatar"),
                business.getOwnerFirstName(),
                business.getOwnerLastName(),
                business.getPhone(),
                business.getAddressLine(),
                business.getCity(),
                business.getRegion(),
                business.getPostalCode(),
                business.getDescription(),
                business.getWebsite(),
                business.getInstagram(),
                business.getFacebook(),
                business.getTiktok(),
                business.getEtsy(),
                imageUrl(business.getLogoUpdatedAt(), "logo"),
                business.getCreatedAt());
    }
}
