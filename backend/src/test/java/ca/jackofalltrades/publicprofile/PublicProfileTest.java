package ca.jackofalltrades.publicprofile;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.jackofalltrades.PostgresTestBase;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/** Contract §2.2: the public business profile, and the owner's settings behind it. */
class PublicProfileTest extends PostgresTestBase {

    /** A slug no other test uses, so tests stay independent on the shared database. */
    private static String uniqueSlug() {
        return "shop-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private ResultActions setSlug(Cookie cookie, String slug) throws Exception {
        return mockMvc.perform(patch("/api/auth/me").cookie(cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"publicSlug": "%s"}
                        """.formatted(slug)));
    }

    private int createItem(Cookie cookie, String name, int quantity, boolean isPublic) throws Exception {
        String body = mockMvc.perform(post("/api/items").cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "%s", "quantity": %d, "unitPriceCents": 1500,
                                 "tags": ["supplier-x"], "note": "costs me $4", "isPublic": %b}
                                """.formatted(name, quantity, isPublic)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    /** A business with a public profile at {@code slug}. */
    private Cookie businessWithProfile(String slug) throws Exception {
        Cookie cookie = register("Jinuo's Jewelry", uniqueEmail(), "correct-horse");
        mockMvc.perform(patch("/api/auth/me").cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"publicSlug": "%s", "description": "Handmade rings", "city": "Toronto",
                                 "phone": "416-555-0100", "addressLine": "1 Secret St", "website": "example.com"}
                                """.formatted(slug)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.publicSlug").value(slug));
        return cookie;
    }

    // ---- GET /api/public/businesses/{slug} ----

    @Test
    void anyoneCanViewAProfileWithoutLoggingIn() throws Exception {
        String slug = uniqueSlug();
        businessWithProfile(slug);

        mockMvc.perform(get("/api/public/businesses/" + slug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value(slug))
                .andExpect(jsonPath("$.name").value("Jinuo's Jewelry"))
                .andExpect(jsonPath("$.description").value("Handmade rings"))
                .andExpect(jsonPath("$.city").value("Toronto"))
                .andExpect(jsonPath("$.website").value("https://example.com"))
                .andExpect(jsonPath("$.currency").value("CAD"))
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    void showsOnlyItemsMarkedPublic() throws Exception {
        String slug = uniqueSlug();
        Cookie cookie = businessWithProfile(slug);
        createItem(cookie, "Silver Ring", 3, true);
        createItem(cookie, "Prototype Ring", 3, false);
        createItem(cookie, "Gold Ring", 0, true);

        mockMvc.perform(get("/api/public/businesses/" + slug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].name", contains("Gold Ring", "Silver Ring")))
                .andExpect(jsonPath("$.items[0].inStock").value(false))
                .andExpect(jsonPath("$.items[1].inStock").value(true))
                .andExpect(jsonPath("$.items[1].unitPriceCents").value(1500));
    }

    @Test
    void neverShowsPrivateBusinessOrItemDetails() throws Exception {
        String slug = uniqueSlug();
        Cookie cookie = businessWithProfile(slug);
        createItem(cookie, "Silver Ring", 3, true);

        mockMvc.perform(get("/api/public/businesses/" + slug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").doesNotExist())
                .andExpect(jsonPath("$.email").doesNotExist())
                .andExpect(jsonPath("$.phone").doesNotExist())
                .andExpect(jsonPath("$.addressLine").doesNotExist())
                .andExpect(jsonPath("$.lastLoginAt").doesNotExist())
                .andExpect(jsonPath("$.items[0].quantity").doesNotExist())
                .andExpect(jsonPath("$.items[0].note").doesNotExist())
                .andExpect(jsonPath("$.items[0].tags").doesNotExist())
                .andExpect(jsonPath("$.items[0].businessId").doesNotExist());
    }

    @Test
    void neverShowsAnotherBusinessesItems() throws Exception {
        String slug = uniqueSlug();
        businessWithProfile(slug);
        Cookie other = businessWithProfile(uniqueSlug());
        createItem(other, "Someone Else's Ring", 3, true);

        mockMvc.perform(get("/api/public/businesses/" + slug))
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    void anUnknownAndATurnedOffProfileLookTheSame() throws Exception {
        String slug = uniqueSlug();
        Cookie cookie = businessWithProfile(slug);
        setSlug(cookie, "").andExpect(status().isOk()).andExpect(jsonPath("$.publicSlug").doesNotExist());

        mockMvc.perform(get("/api/public/businesses/" + slug))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.message").value("Public profile " + slug + " not found"));
        mockMvc.perform(get("/api/public/businesses/no-such-shop-anywhere"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.message").value("Public profile no-such-shop-anywhere not found"));
    }

    @Test
    void theLinkIsCaseInsensitive() throws Exception {
        String slug = uniqueSlug();
        businessWithProfile(slug);

        mockMvc.perform(get("/api/public/businesses/" + slug.toUpperCase()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value(slug));
    }

    @Test
    void servesTheLogoPublicly() throws Exception {
        String slug = uniqueSlug();
        Cookie cookie = businessWithProfile(slug);
        mockMvc.perform(get("/api/public/businesses/" + slug + "/logo")).andExpect(status().isNotFound());

        byte[] logo = {(byte) 0x89, 'P', 'N', 'G', 1, 2};
        mockMvc.perform(put("/api/auth/me/logo").cookie(cookie).contentType(MediaType.IMAGE_PNG).content(logo))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/public/businesses/" + slug))
                .andExpect(jsonPath("$.logoUrl").value(startsWith("/api/public/businesses/" + slug + "/logo?v=")));
        mockMvc.perform(get("/api/public/businesses/" + slug + "/logo"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andExpect(content().bytes(logo))
                .andExpect(header().string("Cache-Control", startsWith("max-age=")));
    }

    @Test
    void otherApiRoutesStillNeedALogin() throws Exception {
        mockMvc.perform(get("/api/items")).andExpect(status().isUnauthorized());
    }

    // ---- Owner settings: item visibility ----

    @Test
    void newItemsArePrivateUnlessMarkedPublic() throws Exception {
        Cookie cookie = registerAndLogin();
        String body = mockMvc.perform(post("/api/items").cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Ring", "quantity": 1, "unitPriceCents": 100}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.isPublic").value(false))
                .andReturn().getResponse().getContentAsString();
        int id = JsonPath.read(body, "$.id");

        mockMvc.perform(patch("/api/items/" + id).cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"isPublic": true}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isPublic").value(true))
                .andExpect(jsonPath("$.name").value("Ring"));
        mockMvc.perform(get("/api/items").cookie(cookie))
                .andExpect(jsonPath("$.data[0].isPublic").value(true));
    }

    // ---- Owner settings: the public link ----

    @Test
    void theLinkIsStoredLowercaseAndTrimmed() throws Exception {
        String slug = uniqueSlug();
        setSlug(registerAndLogin(), "  " + slug.toUpperCase() + " ")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.publicSlug").value(slug));
    }

    @Test
    void rejectsBadlyFormedLinks() throws Exception {
        Cookie cookie = registerAndLogin();
        for (String bad : new String[] {"ab", "has space", "under_score", "-leading", "trailing-", "double--hyphen",
                "émoji"}) {
            setSlug(cookie, bad)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.message")
                            .value("Public link must be 3-40 characters: lowercase letters, numbers and hyphens"));
        }
        setSlug(cookie, "a".repeat(41)).andExpect(status().isBadRequest());
    }

    @Test
    void aLinkCanOnlyBelongToOneBusiness() throws Exception {
        String slug = uniqueSlug();
        Cookie first = businessWithProfile(slug);

        setSlug(registerAndLogin(), slug)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.message").value("That public link is already taken"));
        // Saving your own link again is not a conflict.
        setSlug(first, slug).andExpect(status().isOk());
    }
}
