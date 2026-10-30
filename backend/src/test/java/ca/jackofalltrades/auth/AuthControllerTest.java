package ca.jackofalltrades.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ca.jackofalltrades.PostgresTestBase;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/** Contract §2: register, login, logout, me. */
class AuthControllerTest extends PostgresTestBase {

    private static String json(String email, String password) {
        return """
                {"email": "%s", "password": "%s"}
                """.formatted(email, password);
    }

    @Test
    void registerReturnsTheBusinessAndASessionCookie() throws Exception {
        String email = uniqueEmail();
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Allie's Prints", "email": "%s", "password": "correct-horse"}
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.name").value("Allie's Prints"))
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.createdAt").isString())
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andReturn();

        String setCookie = result.getResponse().getHeaders("Set-Cookie").stream()
                .filter(value -> value.startsWith(SESSION_COOKIE + "="))
                .findFirst()
                .orElseThrow();
        assertThat(setCookie).contains("HttpOnly").contains("SameSite=Lax").contains("Max-Age=2592000");
    }

    @Test
    void registeringTheSameEmailTwiceIsRejected() throws Exception {
        String email = uniqueEmail();
        register("First", email, "correct-horse");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Second", "email": "%s", "password": "correct-horse"}
                                """.formatted(email)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("An account with that email already exists"));
    }

    @Test
    void emailIsTrimmedAndLowercased() throws Exception {
        String local = "Mixed-" + System.nanoTime();
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Shop", "email": "  %s@Example.COM ", "password": "correct-horse"}
                                """.formatted(local)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value(local.toLowerCase() + "@example.com"));
    }

    @Test
    void shortPasswordFailsValidationWithFieldDetails() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Shop", "email": "%s", "password": "seven77"}
                                """.formatted(uniqueEmail())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Validation failed"))
                .andExpect(jsonPath("$.error.details[0].field").value("password"))
                .andExpect(jsonPath("$.error.details[0].message").value("Password must be at least 8 characters"));
    }

    @Test
    void wrongPasswordIsRejected() throws Exception {
        String email = uniqueEmail();
        register("Shop", email, "correct-horse");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(email, "wrong-horse")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.message").value("Incorrect email or password"));
    }

    @Test
    void loginCookieWorksForMe() throws Exception {
        String email = uniqueEmail();
        register("Shop", email, "correct-horse");

        MvcResult login = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(email, "correct-horse")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andReturn();

        mockMvc.perform(get("/api/auth/me").cookie(sessionCookie(login)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email));
    }

    @Test
    void meWithoutACookieIsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.message").value("Not logged in"));
    }

    @Test
    void patchMeRenamesTheBusiness() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(patch("/api/auth/me")
                        .cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "  Allie's Candles  "}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Allie's Candles"));

        mockMvc.perform(get("/api/auth/me").cookie(cookie))
                .andExpect(jsonPath("$.name").value("Allie's Candles"));
    }

    @Test
    void patchMeRejectsABlankNameAndAnonymousCallers() throws Exception {
        mockMvc.perform(patch("/api/auth/me")
                        .cookie(registerAndLogin())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "   "}
                                """))
                .andExpect(status().isBadRequest());

        mockMvc.perform(patch("/api/auth/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Nope"}
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void patchMeUpdatesBusinessDetailsAndLeavesOtherFieldsAlone() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(patch("/api/auth/me")
                        .cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"businessType": "Candles", "country": "Canada",
                                 "timeZone": "America/Toronto", "currency": "usd"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Test Business"))
                .andExpect(jsonPath("$.businessType").value("Candles"))
                .andExpect(jsonPath("$.country").value("Canada"))
                .andExpect(jsonPath("$.timeZone").value("America/Toronto"))
                .andExpect(jsonPath("$.currency").value("USD"));

        // An empty string clears an optional field.
        mockMvc.perform(patch("/api/auth/me")
                        .cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"businessType": ""}
                                """))
                .andExpect(jsonPath("$.businessType").doesNotExist())
                .andExpect(jsonPath("$.country").value("Canada"));
    }

    @Test
    void patchMeRejectsAnUnknownTimeZoneOrCurrency() throws Exception {
        Cookie cookie = registerAndLogin();
        for (String body : new String[] {"{\"timeZone\": \"Mars/Base\"}", "{\"currency\": \"XYZ\"}"}) {
            mockMvc.perform(patch("/api/auth/me")
                            .cookie(cookie)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void newBusinessesDefaultToUtcAndCad() throws Exception {
        mockMvc.perform(get("/api/auth/me").cookie(registerAndLogin()))
                .andExpect(jsonPath("$.timeZone").value("UTC"))
                .andExpect(jsonPath("$.currency").value("CAD"))
                .andExpect(jsonPath("$.lastLoginAt").isString());
    }

    @Test
    void changingEmailNeedsTheCurrentPasswordAndAUniqueEmail() throws Exception {
        String taken = uniqueEmail();
        register("Other", taken, "correct-horse");
        Cookie cookie = registerAndLogin();
        String fresh = uniqueEmail();

        mockMvc.perform(put("/api/auth/me/email")
                        .cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(fresh, "wrong-password")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Incorrect password"));

        mockMvc.perform(put("/api/auth/me/email")
                        .cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(taken, "correct-horse")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("An account with that email already exists"));

        mockMvc.perform(put("/api/auth/me/email")
                        .cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(fresh, "correct-horse")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(fresh));

        // The new email now logs in.
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(fresh, "correct-horse")))
                .andExpect(status().isOk());
    }

    @Test
    void aProfilePictureCanBeUploadedFetchedAndRemoved() throws Exception {
        Cookie cookie = registerAndLogin();
        byte[] picture = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 1, 2, 3};

        mockMvc.perform(get("/api/auth/me").cookie(cookie))
                .andExpect(jsonPath("$.avatarUrl").doesNotExist());
        mockMvc.perform(get("/api/auth/me/avatar").cookie(cookie))
                .andExpect(status().isNotFound());

        mockMvc.perform(put("/api/auth/me/avatar")
                        .cookie(cookie)
                        .contentType(MediaType.IMAGE_JPEG)
                        .content(picture))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").value(org.hamcrest.Matchers.startsWith("/api/auth/me/avatar?v=")));

        mockMvc.perform(get("/api/auth/me/avatar").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_JPEG))
                .andExpect(content().bytes(picture));

        mockMvc.perform(delete("/api/auth/me/avatar").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").doesNotExist());
        mockMvc.perform(get("/api/auth/me/avatar").cookie(cookie))
                .andExpect(status().isNotFound());
    }

    @Test
    void aProfilePictureMustBeASmallJpegPngOrWebp() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(put("/api/auth/me/avatar")
                        .cookie(cookie)
                        .contentType(MediaType.IMAGE_GIF)
                        .content(new byte[] {1, 2, 3}))
                .andExpect(status().isBadRequest());

        mockMvc.perform(put("/api/auth/me/avatar")
                        .cookie(cookie)
                        .contentType(MediaType.IMAGE_PNG)
                        .content(new byte[AuthService.MAX_IMAGE_BYTES + 1]))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Image must be 512 KB or smaller"));

        mockMvc.perform(put("/api/auth/me/avatar")
                        .contentType(MediaType.IMAGE_PNG)
                        .content(new byte[] {1, 2, 3}))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void profileDetailsAreSavedTrimmedAndCanBeCleared() throws Exception {
        Cookie cookie = registerAndLogin();

        mockMvc.perform(patch("/api/auth/me")
                        .cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"ownerFirstName": " Allie ", "ownerLastName": "Chen",
                                 "phone": "+1 (604) 555-0199", "addressLine": "12 Main St",
                                 "city": "Vancouver", "region": "BC", "postalCode": "V6B 1A1",
                                 "description": "Hand-poured candles.",
                                 "website": "alliescandles.ca", "instagram": "https://instagram.com/allie"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ownerFirstName").value("Allie"))
                .andExpect(jsonPath("$.phone").value("+1 (604) 555-0199"))
                .andExpect(jsonPath("$.city").value("Vancouver"))
                .andExpect(jsonPath("$.website").value("https://alliescandles.ca"))
                .andExpect(jsonPath("$.instagram").value("https://instagram.com/allie"))
                .andExpect(jsonPath("$.facebook").doesNotExist());

        mockMvc.perform(patch("/api/auth/me")
                        .cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"phone": "", "website": ""}
                                """))
                .andExpect(jsonPath("$.phone").doesNotExist())
                .andExpect(jsonPath("$.website").doesNotExist())
                .andExpect(jsonPath("$.city").value("Vancouver"));
    }

    @Test
    void profileDetailsRejectABadPhoneNumberOrWebAddress() throws Exception {
        Cookie cookie = registerAndLogin();
        for (String body : new String[] {
            "{\"phone\": \"call me\"}", "{\"website\": \"not a url\"}", "{\"etsy\": \"ftp://etsy.com/x\"}"
        }) {
            mockMvc.perform(patch("/api/auth/me")
                            .cookie(cookie)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void aLogoIsStoredSeparatelyFromTheProfilePicture() throws Exception {
        Cookie cookie = registerAndLogin();
        byte[] logo = {(byte) 0x89, 'P', 'N', 'G', 1, 2};

        mockMvc.perform(put("/api/auth/me/logo")
                        .cookie(cookie)
                        .contentType(MediaType.IMAGE_PNG)
                        .content(logo))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.logoUrl").value(org.hamcrest.Matchers.startsWith("/api/auth/me/logo?v=")))
                .andExpect(jsonPath("$.avatarUrl").doesNotExist());

        mockMvc.perform(get("/api/auth/me/logo").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andExpect(content().bytes(logo));
        mockMvc.perform(get("/api/auth/me/avatar").cookie(cookie))
                .andExpect(status().isNotFound());

        mockMvc.perform(delete("/api/auth/me/logo").cookie(cookie))
                .andExpect(jsonPath("$.logoUrl").doesNotExist());
        mockMvc.perform(get("/api/auth/me/logo").cookie(cookie))
                .andExpect(status().isNotFound());
    }

    @Test
    void changingThePasswordNeedsTheCurrentOneAndLogsOutOtherDevices() throws Exception {
        String email = uniqueEmail();
        Cookie thisDevice = register("Test Business", email, "correct-horse");
        Cookie otherDevice = sessionCookie(mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(email, "correct-horse")))
                .andExpect(status().isOk())
                .andReturn());

        mockMvc.perform(put("/api/auth/me/password")
                        .cookie(thisDevice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"currentPassword": "wrong", "newPassword": "a-new-password"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Incorrect password"));

        mockMvc.perform(put("/api/auth/me/password")
                        .cookie(thisDevice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"currentPassword": "correct-horse", "newPassword": "short"}
                                """))
                .andExpect(status().isBadRequest());

        mockMvc.perform(put("/api/auth/me/password")
                        .cookie(thisDevice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"currentPassword": "correct-horse", "newPassword": "a-new-password"}
                                """))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/auth/me").cookie(thisDevice)).andExpect(status().isOk());
        mockMvc.perform(get("/api/auth/me").cookie(otherDevice)).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(email, "correct-horse")))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(email, "a-new-password")))
                .andExpect(status().isOk());
    }

    @Test
    void sessionsListEveryDeviceAndOthersCanBeLoggedOut() throws Exception {
        String email = uniqueEmail();
        Cookie laptop = sessionCookie(mockMvc.perform(post("/api/auth/register")
                        .header("User-Agent", "Laptop Browser")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Test Business", "email": "%s", "password": "correct-horse"}
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn());
        Cookie phone = sessionCookie(mockMvc.perform(post("/api/auth/login")
                        .header("User-Agent", "Phone Browser")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(email, "correct-horse")))
                .andExpect(status().isOk())
                .andReturn());

        mockMvc.perform(get("/api/auth/sessions").cookie(laptop))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[?(@.current == true)].userAgent").value("Laptop Browser"))
                .andExpect(jsonPath("$[?(@.current == false)].userAgent").value("Phone Browser"));

        mockMvc.perform(post("/api/auth/sessions/logout-others").cookie(laptop))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/auth/me").cookie(phone)).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/auth/sessions").cookie(laptop))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].current").value(true));
    }

    @Test
    void loginActivityListsRegistrationAndLoginsNewestFirst() throws Exception {
        String email = uniqueEmail();
        register("Test Business", email, "correct-horse");
        mockMvc.perform(post("/api/auth/login")
                        .header("User-Agent", "Second Browser")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(email, "correct-horse")))
                .andExpect(status().isOk());
        Cookie cookie = sessionCookie(mockMvc.perform(post("/api/auth/login")
                        .header("User-Agent", "Third Browser")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(email, "correct-horse")))
                .andReturn());

        mockMvc.perform(get("/api/auth/login-activity").cookie(cookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].userAgent").value("Third Browser"))
                .andExpect(jsonPath("$[1].userAgent").value("Second Browser"))
                .andExpect(jsonPath("$[0].at").isString());
        mockMvc.perform(get("/api/auth/login-activity?limit=1").cookie(cookie))
                .andExpect(jsonPath("$.length()").value(1));
        mockMvc.perform(get("/api/auth/login-activity")).andExpect(status().isUnauthorized());
    }

    @Test
    void deletingTheAccountNeedsThePasswordAndRemovesEverything() throws Exception {
        String email = uniqueEmail();
        Cookie cookie = register("Doomed Business", email, "correct-horse");
        Cookie otherDevice = sessionCookie(mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(email, "correct-horse")))
                .andReturn());
        mockMvc.perform(put("/api/auth/me/avatar")
                        .cookie(cookie)
                        .contentType(MediaType.IMAGE_PNG)
                        .content(new byte[] {1, 2, 3}))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/items")
                        .cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Candle", "quantity": 3, "unitPriceCents": 1200}
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(delete("/api/auth/me")
                        .cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"currentPassword": "wrong"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Incorrect password"));
        mockMvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isOk());

        mockMvc.perform(delete("/api/auth/me")
                        .cookie(cookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"currentPassword": "correct-horse"}
                                """))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/auth/me").cookie(otherDevice)).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(email, "correct-horse")))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/auth/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"currentPassword": "correct-horse"}
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutEndsTheSession() throws Exception {
        Cookie cookie = registerAndLogin();
        mockMvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/logout").cookie(cookie))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/auth/me").cookie(cookie))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.message").value("Not logged in"));
    }

    @Test
    void malformedJsonIsRejected() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.message").value("Request body is not valid JSON"))
                .andExpect(jsonPath("$.error.details").doesNotExist());
    }

    @Test
    void theLowStockThresholdDefaultsToFiveAndDrivesTheLowStockList() throws Exception {
        Cookie cookie = registerAndLogin();
        mockMvc.perform(get("/api/auth/me").cookie(cookie))
                .andExpect(jsonPath("$.lowStockThreshold").value(5));
        for (int quantity : new int[] {2, 8}) {
            mockMvc.perform(post("/api/items").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\": \"Item %d\", \"quantity\": %d, \"unitPriceCents\": 100}"
                                    .formatted(quantity, quantity)))
                    .andExpect(status().isCreated());
        }
        mockMvc.perform(get("/api/items/low-stock").cookie(cookie))
                .andExpect(jsonPath("$.threshold").value(5))
                .andExpect(jsonPath("$.count").value(1));

        mockMvc.perform(patch("/api/auth/me").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lowStockThreshold\": 10}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lowStockThreshold").value(10));
        mockMvc.perform(get("/api/items/low-stock").cookie(cookie))
                .andExpect(jsonPath("$.threshold").value(10))
                .andExpect(jsonPath("$.count").value(2));

        mockMvc.perform(patch("/api/auth/me").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lowStockThreshold\": -1}"))
                .andExpect(status().isBadRequest());
    }
}
