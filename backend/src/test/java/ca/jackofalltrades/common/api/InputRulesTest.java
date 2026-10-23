package ca.jackofalltrades.common.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Plain unit tests (no Spring, no database) for the shared input rules. */
class InputRulesTest {

    private final IsoOffsetDateTime.Validator timestamp = new IsoOffsetDateTime.Validator();

    @Test
    void timestampNeedsAnOffset() {
        assertThat(timestamp.isValid("2026-10-18T15:30:00-04:00", null)).isTrue();
        assertThat(timestamp.isValid("2026-10-18T19:30:00.000Z", null)).isTrue();
        assertThat(timestamp.isValid(null, null)).isTrue();
        assertThat(timestamp.isValid("2026-10-18T15:30:00", null)).isFalse();
        assertThat(timestamp.isValid("2026-10-18", null)).isFalse();
        assertThat(timestamp.isValid("yesterday", null)).isFalse();
    }

    @Test
    void tagsAreTrimmedAndDeduplicated() {
        assertThat(Tags.normalize(List.of(" a ", "a", "b"))).containsExactly("a", "b");
        assertThat(Tags.normalize(null)).isEmpty();
        assertThat(Tags.normalize(Arrays.asList("a", null))).containsExactly("a", null);
    }
}
