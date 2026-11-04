package ca.jackofalltrades.publicprofile;

import ca.jackofalltrades.common.api.NotFoundException;
import java.time.Duration;
import java.util.Locale;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public profile endpoints (contract §2.2). Under /api/public/**, which SecurityConfig lets anyone read. */
@RestController
@RequestMapping("/api/public/businesses/{slug}")
public class PublicProfileController {

    private final PublicProfileService publicProfileService;

    public PublicProfileController(PublicProfileService publicProfileService) {
        this.publicProfileService = publicProfileService;
    }

    /** Slugs are stored lowercase, so /p/My-Shop finds my-shop. */
    @GetMapping
    public PublicProfileResponse profile(@PathVariable String slug) {
        return publicProfileService.find(slug.toLowerCase(Locale.ROOT));
    }

    /** The logo for an {@code <img>}. Public cache: the URL changes (?v=) whenever the logo does. */
    @GetMapping("/logo")
    public ResponseEntity<byte[]> logo(@PathVariable String slug) {
        return publicProfileService.logo(slug.toLowerCase(Locale.ROOT))
                .map(found -> ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(found.contentType()))
                        .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePublic())
                        .body(found.data()))
                .orElseThrow(() -> new NotFoundException("Logo", slug));
    }
}
