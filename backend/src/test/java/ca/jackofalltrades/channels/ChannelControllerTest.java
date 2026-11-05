package ca.jackofalltrades.channels;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.jackofalltrades.PostgresTestBase;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/** Contract §4.1: GET and POST /api/channels, scoped to the logged-in business. */
class ChannelControllerTest extends PostgresTestBase {

    private ResultActions create(Cookie cookie, String json) throws Exception {
        return mockMvc.perform(post("/api/channels").cookie(cookie)
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    @Test
    void requiresLogin() throws Exception {
        mockMvc.perform(get("/api/channels"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.message").value("Log in to continue"));
    }

    @Test
    void newBusinessStartsWithTheStarterChannels() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(get("/api/channels").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].name", contains("In person", "Online", "Commission", "Misc")))
                .andExpect(jsonPath("$[0].id").isNumber())
                .andExpect(jsonPath("$[0].businessId").doesNotExist());
    }

    @Test
    void createTrimsTheNameAndAppendsIt() throws Exception {
        Cookie cookie = registerAndLogin();

        create(cookie, "{\"name\": \"  Etsy  \"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.name").value("Etsy"));
        mockMvc.perform(get("/api/channels").cookie(cookie))
                .andExpect(jsonPath("$[*].name", contains("In person", "Online", "Commission", "Misc", "Etsy")));
    }

    @Test
    void duplicateNameIgnoringCaseIs409() throws Exception {
        Cookie cookie = registerAndLogin();

        create(cookie, "{\"name\": \"online\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.message").value("Channel \"online\" already exists"));
    }

    @Test
    void sameNameIsFineForAnotherBusiness() throws Exception {
        Cookie mine = registerAndLogin();
        Cookie theirs = registerAndLogin();
        create(theirs, "{\"name\": \"Etsy\"}").andExpect(status().isCreated());

        create(mine, "{\"name\": \"Etsy\"}").andExpect(status().isCreated());
        mockMvc.perform(get("/api/channels").cookie(mine))
                .andExpect(jsonPath("$[*].name", contains("In person", "Online", "Commission", "Misc", "Etsy")));
    }

    @Test
    void invalidNamesAreValidationErrors() throws Exception {
        Cookie cookie = registerAndLogin();

        create(cookie, "{\"name\": \"   \"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Validation failed"))
                .andExpect(jsonPath("$.error.details[0].field").value("name"))
                .andExpect(jsonPath("$.error.details[0].message").value("Name is required"));
        create(cookie, "{\"name\": \"" + "x".repeat(41) + "\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].message").value("Name must be at most 40 characters"));
        mockMvc.perform(get("/api/channels").cookie(cookie))
                .andExpect(jsonPath("$[*].name", not(hasItem("   "))));
    }

    @Test
    void renameChangesTheNameAndRejectsADuplicate() throws Exception {
        Cookie cookie = registerAndLogin();
        int id = channelIdByName(cookie, "Misc");

        mockMvc.perform(put("/api/channels/" + id).cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\": \"  Etsy  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Etsy"));
        mockMvc.perform(put("/api/channels/" + id).cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\": \"online\"}"))
                .andExpect(status().isConflict());
        // Only the capitalisation changes: allowed.
        mockMvc.perform(put("/api/channels/" + id).cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\": \"ETSY\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/channels/999999").cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\": \"Nope\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteRemovesAnUnusedChannelButNotOneWithSales() throws Exception {
        Cookie cookie = registerAndLogin();
        int misc = channelIdByName(cookie, "Misc");
        int online = channelIdByName(cookie, "Online");

        mockMvc.perform(post("/api/items").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Candle\", \"quantity\": 5, \"unitPriceCents\": 1000}"))
                .andExpect(status().isCreated());
        int itemId = com.jayway.jsonpath.JsonPath.read(
                mockMvc.perform(get("/api/items").cookie(cookie)).andReturn().getResponse().getContentAsString(),
                "$.data[0].id");
        mockMvc.perform(post("/api/sales").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"soldAt\": \"2026-10-18T15:30:00Z\", \"channelId\": %d, \"items\": [{\"itemId\": %d, \"quantity\": 1}]}"
                                .formatted(online, itemId)))
                .andExpect(status().isCreated());

        mockMvc.perform(delete("/api/channels/" + online).cookie(cookie))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.message").value(
                        "Channel \"Online\" is used by 1 sale, so it can't be deleted. Rename it instead."));

        mockMvc.perform(delete("/api/channels/" + misc).cookie(cookie)).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/channels").cookie(cookie))
                .andExpect(jsonPath("$[*].name", not(hasItem("Misc"))));
        mockMvc.perform(delete("/api/channels/" + misc).cookie(cookie)).andExpect(status().isNotFound());
    }

    @Test
    void anotherBusinessCannotRenameOrDeleteMyChannel() throws Exception {
        Cookie mine = registerAndLogin();
        Cookie theirs = registerAndLogin();
        int id = channelIdByName(mine, "Misc");

        mockMvc.perform(put("/api/channels/" + id).cookie(theirs)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\": \"Hacked\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/channels/" + id).cookie(theirs)).andExpect(status().isNotFound());
    }

    private int channelIdByName(Cookie cookie, String name) throws Exception {
        String body = mockMvc.perform(get("/api/channels").cookie(cookie)).andReturn().getResponse()
                .getContentAsString();
        return com.jayway.jsonpath.JsonPath.<java.util.List<Integer>>read(body, "$[?(@.name == '" + name + "')].id")
                .get(0);
    }
}
