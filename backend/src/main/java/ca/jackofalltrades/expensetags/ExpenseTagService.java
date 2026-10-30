package ca.jackofalltrades.expensetags;

import ca.jackofalltrades.common.api.ConflictException;
import ca.jackofalltrades.common.api.NotFoundException;
import ca.jackofalltrades.common.security.CurrentBusiness;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExpenseTagService {

    /** Every new business starts with these (contract §2, §5.1), as in the demo's starterNamedLists.ts. */
    public static final List<String> STARTER_TAGS = List.of("supplier", "supplies", "rent", "utilities", "market");

    private final ExpenseTagRepository tags;
    private final CurrentBusiness currentBusiness;
    private final JdbcClient jdbcClient;

    public ExpenseTagService(ExpenseTagRepository tags, CurrentBusiness currentBusiness, JdbcClient jdbcClient) {
        this.tags = tags;
        this.currentBusiness = currentBusiness;
        this.jdbcClient = jdbcClient;
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

    @Transactional
    public ExpenseTagResponse rename(int id, ExpenseTagRequest request) {
        Integer businessId = currentBusiness.id();
        ExpenseTag tag = tags.findByIdAndBusinessId(id, businessId)
                .orElseThrow(() -> new NotFoundException("Tag", id));
        String oldName = tag.getName();
        boolean sameName = oldName.equalsIgnoreCase(request.name());
        if (!sameName && tags.existsByBusinessIdAndNameIgnoreCase(businessId, request.name())) {
            throw alreadyExists(request.name());
        }
        tag.setName(request.name());
        ExpenseTagResponse saved = ExpenseTagResponse.from(tags.save(tag));
        // Expenses store their tags as text, so carry the new name over to the ones that had the old.
        jdbcClient.sql("""
                        UPDATE expenses SET tags = array_replace(tags, :oldName, :newName)
                        WHERE business_id = :businessId AND :oldName = ANY(tags)
                        """)
                .param("oldName", oldName)
                .param("newName", request.name())
                .param("businessId", businessId)
                .update();
        return saved;
    }

    @Transactional
    public void delete(int id) {
        ExpenseTag tag = tags.findByIdAndBusinessId(id, currentBusiness.id())
                .orElseThrow(() -> new NotFoundException("Tag", id));
        tags.delete(tag);
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
