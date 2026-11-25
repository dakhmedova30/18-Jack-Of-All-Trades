package ca.jackofalltrades.items;

import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.jackofalltrades.PostgresTestBase;
import ca.jackofalltrades.common.api.Images;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/** Contract §3.1: one photo per item. */
class ItemPhotoTest extends PostgresTestBase {

    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 1, 2, 3};
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 4, 5};

    private int createItem(Cookie cookie) throws Exception {
        String body = mockMvc.perform(post("/api/items").cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Mug", "quantity": 3, "unitPriceCents": 1800}
                                """))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    private String photoPath(int itemId) {
        return "/api/items/" + itemId + "/photo";
    }

    @Test
    void aPhotoCanBeUploadedFetchedReplacedAndRemoved() throws Exception {
        Cookie cookie = registerAndLogin();
        int itemId = createItem(cookie);
        mockMvc.perform(get(photoPath(itemId)).cookie(cookie)).andExpect(status().isNotFound());

        mockMvc.perform(put(photoPath(itemId)).cookie(cookie).contentType(MediaType.IMAGE_JPEG).content(JPEG))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.photoUrl").value(startsWith(photoPath(itemId) + "?v=")));
        mockMvc.perform(get(photoPath(itemId)).cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_JPEG))
                .andExpect(content().bytes(JPEG))
                .andExpect(header().string("Cache-Control", startsWith("max-age=")));

        // Uploading again replaces the photo, type and all.
        mockMvc.perform(put(photoPath(itemId)).cookie(cookie).contentType(MediaType.IMAGE_PNG).content(PNG))
                .andExpect(status().isOk());
        mockMvc.perform(get(photoPath(itemId)).cookie(cookie))
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andExpect(content().bytes(PNG));

        mockMvc.perform(delete(photoPath(itemId)).cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.photoUrl").value(nullValue()));
        mockMvc.perform(get(photoPath(itemId)).cookie(cookie)).andExpect(status().isNotFound());

        // Removing it again is fine.
        mockMvc.perform(delete(photoPath(itemId)).cookie(cookie)).andExpect(status().isOk());
    }

    @Test
    void aPhotoMustBeASmallJpegPngOrWebp() throws Exception {
        Cookie cookie = registerAndLogin();
        int itemId = createItem(cookie);

        mockMvc.perform(put(photoPath(itemId)).cookie(cookie).contentType(MediaType.IMAGE_GIF).content(PNG))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Image must be a JPEG, PNG or WebP file"));
        mockMvc.perform(put(photoPath(itemId)).cookie(cookie).contentType("image/webp").content(new byte[0]))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Image is empty"));
        mockMvc.perform(put(photoPath(itemId)).cookie(cookie)
                        .contentType(MediaType.IMAGE_PNG)
                        .content(new byte[Images.MAX_BYTES * 4]))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Image must be 512 KB or smaller"));

        mockMvc.perform(get(photoPath(itemId)).cookie(cookie)).andExpect(status().isNotFound());
    }

    @Test
    void needsALoginAndAValidItem() throws Exception {
        Cookie cookie = registerAndLogin();
        int itemId = createItem(cookie);

        mockMvc.perform(put(photoPath(itemId)).contentType(MediaType.IMAGE_JPEG).content(JPEG))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get(photoPath(itemId))).andExpect(status().isUnauthorized());

        mockMvc.perform(put(photoPath(999_999_999)).cookie(cookie).contentType(MediaType.IMAGE_JPEG).content(JPEG))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete(photoPath(999_999_999)).cookie(cookie)).andExpect(status().isNotFound());
        mockMvc.perform(put("/api/items/abc/photo").cookie(cookie).contentType(MediaType.IMAGE_JPEG).content(JPEG))
                .andExpect(status().isBadRequest());
    }

    @Test
    void anotherBusinessCannotSeeOrChangeThePhoto() throws Exception {
        Cookie owner = registerAndLogin();
        int itemId = createItem(owner);
        mockMvc.perform(put(photoPath(itemId)).cookie(owner).contentType(MediaType.IMAGE_JPEG).content(JPEG))
                .andExpect(status().isOk());

        Cookie other = registerAndLogin();
        mockMvc.perform(get(photoPath(itemId)).cookie(other)).andExpect(status().isNotFound());
        mockMvc.perform(put(photoPath(itemId)).cookie(other).contentType(MediaType.IMAGE_PNG).content(PNG))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete(photoPath(itemId)).cookie(other)).andExpect(status().isNotFound());

        // The owner's photo is untouched.
        mockMvc.perform(get(photoPath(itemId)).cookie(owner)).andExpect(content().bytes(JPEG));
    }

    @Test
    void deletingAnItemDeletesItsPhoto() throws Exception {
        Cookie cookie = registerAndLogin();
        int itemId = createItem(cookie);
        mockMvc.perform(put(photoPath(itemId)).cookie(cookie).contentType(MediaType.IMAGE_JPEG).content(JPEG))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/items/" + itemId).cookie(cookie)).andExpect(status().isNoContent());
        mockMvc.perform(get(photoPath(itemId)).cookie(cookie)).andExpect(status().isNotFound());

        int another = createItem(cookie);
        mockMvc.perform(put(photoPath(another)).cookie(cookie).contentType(MediaType.IMAGE_JPEG).content(JPEG))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/items/bulk-delete").cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ids\": [" + another + "]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(1));
    }
}
