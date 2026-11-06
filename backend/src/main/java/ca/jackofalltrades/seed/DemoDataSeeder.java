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
 * With the "demo" profile, makes sure the demo business from contract §2 exists, and gives it
 * sample items, sales and expenses ({@link DemoSampleData}) if it has no items yet. A demo account
 * that already has data, like the live one, is left exactly as it is.
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
    private final DemoSampleData sampleData;

    public DemoDataSeeder(BusinessRepository businesses, PasswordEncoder passwordEncoder,
            ChannelService channelService, ExpenseTagService expenseTagService, DemoSampleData sampleData) {
        this.businesses = businesses;
        this.passwordEncoder = passwordEncoder;
        this.channelService = channelService;
        this.expenseTagService = expenseTagService;
        this.sampleData = sampleData;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        Business demo = businesses.findByEmail(DEMO_EMAIL).orElseGet(this::createDemoBusiness);
        if (sampleData.addIfEmpty(demo.getId())) {
            log.info("Added sample items, sales and expenses to {}", DEMO_EMAIL);
        }
    }

    private Business createDemoBusiness() {
        Business demo = businesses.save(new Business(DEMO_NAME, DEMO_EMAIL, passwordEncoder.encode(DEMO_PASSWORD)));
        channelService.createStarterChannels(demo.getId());
        expenseTagService.createStarterTags(demo.getId());
        log.info("Created demo business {}", DEMO_EMAIL);
        return demo;
    }
}
