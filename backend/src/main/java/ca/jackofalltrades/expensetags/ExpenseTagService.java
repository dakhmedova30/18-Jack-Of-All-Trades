package ca.jackofalltrades.expensetags;

import ca.jackofalltrades.common.api.ConflictException;
import ca.jackofalltrades.common.security.CurrentBusiness;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExpenseTagService {

    /** Every new business starts with these (contract §2, §5.1), as in the demo's starterNamedLists.ts. */
    public static final List<String> STARTER_TAGS = List.of("supplier", "supplies", "rent", "utilities", "market");

    private final ExpenseTagRepository tags;
    private final CurrentBusiness currentBusiness;

    public ExpenseTagService(ExpenseTagRepository tags, CurrentBusiness currentBusiness) {
        this.tags = tags;
        this.currentBusiness = currentBusiness;
    }

    @Transactional(readOnly = true)
    public List<ExpenseTagResponse> list() {
        return tags.findByBusinessIdOrderByIdAsc(currentBusiness.id()).stream()
                .map(ExpenseTagResponse::from)
                .toList();
    }

    @Transactional
    public ExpenseTagResponse create(ExpenseTagRequest request) {
        Integer businessId = currentBusiness.id();
        if (tags.existsByBusinessIdAndNameIgnoreCase(businessId, request.name())) {
            throw alreadyExists(request.name());
        }
        try {
            // IDENTITY ids make save() insert immediately, so a concurrent duplicate fails here.
            return ExpenseTagResponse.from(tags.save(new ExpenseTag(businessId, request.name())));
        } catch (DataIntegrityViolationException e) {
            throw alreadyExists(request.name());
        }
    }

    /** Called when a business is created (register and the demo seeder). */
    @Transactional
    public void createStarterTags(Integer businessId) {
        for (String name : STARTER_TAGS) {
            tags.save(new ExpenseTag(businessId, name));
        }
    }

    private static ConflictException alreadyExists(String name) {
        return new ConflictException("Tag \"" + name + "\" already exists");
    }
}
