package ca.jackofalltrades.sales;

import ca.jackofalltrades.common.api.NotFoundException;
import ca.jackofalltrades.common.api.Paginated;
import ca.jackofalltrades.common.security.CurrentBusiness;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Business rules for sales (contract §4). The business id always comes from CurrentBusiness. */
@Service
public class SaleService {

    private final SaleRepository sales;
    private final SaleQueries queries;
    private final CurrentBusiness currentBusiness;

    public SaleService(SaleRepository sales, SaleQueries queries, CurrentBusiness currentBusiness) {
        this.sales = sales;
        this.queries = queries;
        this.currentBusiness = currentBusiness;
    }

    @Transactional(readOnly = true)
    public Paginated<SaleResponse> list(String search, String sort, String order, int page, int pageSize) {
        return queries.findPage(currentBusiness.id(), search, sort, order, page, pageSize);
    }

    @Transactional(readOnly = true)
    public SaleResponse get(int id) {
        return sales.findByIdAndBusinessId(id, currentBusiness.id())
                .map(SaleResponse::from)
                .orElseThrow(() -> new NotFoundException("Sale", id));
    }
}
