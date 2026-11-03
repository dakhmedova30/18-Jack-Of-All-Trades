package ca.jackofalltrades.items;

import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.jackofalltrades.PostgresTestBase;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

/** GET, PUT and DELETE /api/items/tags: the tags in use, renaming and removing them across items. */
class ItemTagManagementTest extends PostgresTestBase {

    private void item(Cookie cookie, String name, String tagsJson) throws Exception {
        mockMvc.perform(post("/api/items").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"%s\", \"quantity\": 1, \"unitPriceCents\": 100, \"tags\": %s}"
                                .formatted(name, tagsJson)))
                .andExpect(status().isCreated());
    }

    @Test
    void requiresLogin() throws Exception {
        mockMvc.perform(get("/api/items/tags")).andExpect(status().isUnauthorized());
    }

    @Test
    void listsTagsInUseMostUsedFirst() throws Exception {
        Cookie cookie = registerAndLogin();
        item(cookie, "Candle", "[\"home\", \"gift\"]");
        item(cookie, "Soap", "[\"home\"]");
        item(cookie, "Plain", "[]");

        mockMvc.perform(get("/api/items/tags").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].name", contains("home", "gift")))
                .andExpect(jsonPath("$[0].itemCount").value(2))
                .andExpect(jsonPath("$[1].itemCount").value(1));
    }

    @Test
    void renamingATagChangesEveryItemAndMergesIntoAnExistingTag() throws Exception {
        Cookie cookie = registerAndLogin();
        item(cookie, "Candle", "[\"home\", \"gift\"]");
        item(cookie, "Soap", "[\"home\"]");

        mockMvc.perform(put("/api/items/tags").param("name", "home").cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\": \"  house  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("house"))
                .andExpect(jsonPath("$.itemCount").value(2));

        // Renaming onto a tag an item already has leaves that item with one copy, not two.
        mockMvc.perform(put("/api/items/tags").param("name", "house").cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\": \"gift\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.itemCount").value(2));
        mockMvc.perform(get("/api/items/tags").cookie(cookie))
                .andExpect(jsonPath("$[*].name", contains("gift")))
                .andExpect(jsonPath("$[0].itemCount").value(2));
        mockMvc.perform(get("/api/items").cookie(cookie))
                .andExpect(jsonPath("$.data[?(@.name == 'Candle')].tags.length()", contains(1)));
    }

    @Test
    void renameValidatesTheNameAndNeedsAnExistingTag() throws Exception {
        Cookie cookie = registerAndLogin();
        item(cookie, "Candle", "[\"home\"]");

        mockMvc.perform(put("/api/items/tags").param("name", "home").cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\": \"   \"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/items/tags").param("name", "nothing").cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\": \"x\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void deletingATagRemovesItFromItemsButKeepsTheItems() throws Exception {
        Cookie cookie = registerAndLogin();
        item(cookie, "Candle", "[\"home\", \"gift\"]");
        item(cookie, "Soap", "[\"home\"]");

        mockMvc.perform(delete("/api/items/tags").param("name", "home").cookie(cookie))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/items/tags").cookie(cookie))
                .andExpect(jsonPath("$[*].name", contains("gift")));
        mockMvc.perform(get("/api/items").cookie(cookie)).andExpect(jsonPath("$.total").value(2));
        mockMvc.perform(delete("/api/items/tags").param("name", "home").cookie(cookie))
                .andExpect(status().isNotFound());
    }

    @Test
    void tagsOfOtherBusinessesAreUntouched() throws Exception {
        Cookie mine = registerAndLogin();
        Cookie theirs = registerAndLogin();
        item(mine, "Candle", "[\"home\"]");
        item(theirs, "Soap", "[\"home\"]");

        mockMvc.perform(delete("/api/items/tags").param("name", "home").cookie(mine))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/items/tags").cookie(theirs))
                .andExpect(jsonPath("$[*].name", contains("home")));
    }
}
