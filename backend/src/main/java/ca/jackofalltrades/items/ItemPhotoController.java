package ca.jackofalltrades.items;

import ca.jackofalltrades.common.api.Ids;
import ca.jackofalltrades.common.api.Images;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.time.Duration;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** An item's photo (contract §3.1), with the same upload rules as the profile picture and logo. */
@Tag(name = "Inventory")
@RestController
@RequestMapping("/api/items/{id}/photo")
public class ItemPhotoController {

    private final ItemPhotoService itemPhotoService;

    public ItemPhotoController(ItemPhotoService itemPhotoService) {
        this.itemPhotoService = itemPhotoService;
    }

    /** Sets or replaces the photo. The body is the raw image (JPEG, PNG or WebP), up to 512 KB. */
    @PutMapping
    public ItemPhotoResponse set(
            @PathVariable String id,
            HttpServletRequest request,
            @RequestHeader(value = "Content-Type", required = false) String contentType) throws IOException {
        return itemPhotoService.set(Ids.parse(id, "item id"), contentType, Images.read(request));
    }

    @DeleteMapping
    public ItemPhotoResponse remove(@PathVariable String id) {
        return itemPhotoService.remove(Ids.parse(id, "item id"));
    }

    /** The photo itself, for an {@code <img>}. Cached privately: the URL changes (?v=) whenever the photo does. */
    @GetMapping
    public ResponseEntity<byte[]> photo(@PathVariable String id) {
        ItemPhotoRepository.Photo photo = itemPhotoService.find(Ids.parse(id, "item id"));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(photo.contentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePrivate())
                .body(photo.data());
    }
}
