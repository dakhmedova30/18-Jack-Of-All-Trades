package ca.jackofalltrades.items;

import ca.jackofalltrades.common.api.Images;
import ca.jackofalltrades.common.api.NotFoundException;
import ca.jackofalltrades.common.security.CurrentBusiness;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** One photo per item, for the inventory and the public profile (contract §3.1). */
@Service
public class ItemPhotoService {

    private final ItemPhotoRepository photos;
    private final ItemRepository items;
    private final CurrentBusiness currentBusiness;

    public ItemPhotoService(ItemPhotoRepository photos, ItemRepository items, CurrentBusiness currentBusiness) {
        this.photos = photos;
        this.items = items;
        this.currentBusiness = currentBusiness;
    }

    @Transactional
    public ItemPhotoResponse set(int itemId, String contentType, byte[] data) {
        String type = Images.check(contentType, data);
        return photos.save(itemId, currentBusiness.id(), type, data)
                .map(savedAt -> new ItemPhotoResponse(ItemPhotoResponse.url(itemId, savedAt)))
                .orElseThrow(() -> new NotFoundException("Item", itemId));
    }

    /** Removing a photo that isn't there is fine; an item that isn't there is a 404. */
    @Transactional
    public ItemPhotoResponse remove(int itemId) {
        int businessId = currentBusiness.id();
        items.findByIdAndBusinessId(itemId, businessId).orElseThrow(() -> new NotFoundException("Item", itemId));
        photos.delete(itemId, businessId);
        return new ItemPhotoResponse(null);
    }

    @Transactional(readOnly = true)
    public ItemPhotoRepository.Photo find(int itemId) {
        return photos.find(itemId, currentBusiness.id())
                .orElseThrow(() -> new NotFoundException("Photo for item", itemId));
    }
}
