package ca.jackofalltrades.seed;

import ca.jackofalltrades.auth.Business;
import ca.jackofalltrades.auth.BusinessRepository;
import ca.jackofalltrades.channels.ChannelService;
import ca.jackofalltrades.expensetags.ExpenseTagService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * With the "demo" profile, makes sure the demo business from contract §2 exists.
 * Sample items, sales and expenses are not seeded yet (see the design doc's "Demo data" row).
 */
@Component
@Profile("demo")
public class DemoDataSeeder implements ApplicationRunner {

    public static final String DEMO_NAME = "Demo Business";
    public static final String DEMO_EMAIL = "demo@jackofalltrades.test";
    public static final String DEMO_PASSWORD = "ChangeMe123!";

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);

    private final BusinessRepository businesses;
    private final PasswordEncoder passwordEncoder;
    private final ChannelService channelService;
    private final ExpenseTagService expenseTagService;

    public DemoDataSeeder(BusinessRepository businesses, PasswordEncoder passwordEncoder,
            ChannelService channelService, ExpenseTagService expenseTagService) {
        this.businesses = businesses;
        this.passwordEncoder = passwordEncoder;
        this.channelService = channelService;
        this.expenseTagService = expenseTagService;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (businesses.existsByEmail(DEMO_EMAIL)) {
            return;
        }
        Business demo = businesses.save(new Business(DEMO_NAME, DEMO_EMAIL, passwordEncoder.encode(DEMO_PASSWORD)));
        channelService.createStarterChannels(demo.getId());
        expenseTagService.createStarterTags(demo.getId());
        log.info("Created demo business {}", DEMO_EMAIL);
    }
}
