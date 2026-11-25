package ca.jackofalltrades.common.api;

import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;
import java.util.Set;

/**
 * The rules for an uploaded picture: profile picture, logo or product photo. Each is sent as the
 * raw request body with its own Content-Type, and stored as bytes in Postgres.
 */
public final class Images {

    /** Pictures are resized in the browser, so a real one is far smaller than this. */
    public static final int MAX_BYTES = 512 * 1024;
    private static final Set<String> TYPES = Set.of("image/jpeg", "image/png", "image/webp");

    private Images() {}

    /** Reads one byte past the size limit at most, so an oversized upload is rejected without buffering all of it. */
    public static byte[] read(HttpServletRequest request) throws IOException {
        try (InputStream in = request.getInputStream()) {
            return in.readNBytes(MAX_BYTES + 1);
        }
    }

    /** The media type to store, e.g. "image/png"; 400 unless the upload is a JPEG, PNG or WebP of at most 512 KB. */
    public static String check(String contentType, byte[] data) {
        String type = contentType == null ? "" : contentType.split(";")[0].strip().toLowerCase(Locale.ROOT);
        if (!TYPES.contains(type)) {
            throw new BadRequestException("Image must be a JPEG, PNG or WebP file");
        }
        if (data.length == 0) {
            throw new BadRequestException("Image is empty");
        }
        if (data.length > MAX_BYTES) {
            throw new BadRequestException("Image must be 512 KB or smaller");
        }
        return type;
    }
}
