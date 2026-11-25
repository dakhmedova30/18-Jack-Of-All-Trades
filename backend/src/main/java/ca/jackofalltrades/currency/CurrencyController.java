package ca.jackofalltrades.currency;

import ca.jackofalltrades.auth.BusinessResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Currency", description = "Preview and apply a change of the account currency, converting stored amounts.")
@RestController
@RequestMapping("/api/auth/me/currency")
public class CurrencyController {

    private final CurrencyChangeService currencies;

    public CurrencyController(CurrencyChangeService currencies) {
        this.currencies = currencies;
    }

    @PostMapping("/preview")
    public CurrencyPreview preview(@Valid @RequestBody CurrencyChangeRequest request) {
        return currencies.preview(request.currency(), Boolean.TRUE.equals(request.convertPrices()));
    }

    @PostMapping
    public CurrencyChangeResponse change(@Valid @RequestBody CurrencyChangeRequest request) {
        CurrencyChangeResult result = currencies.change(request);
        return new CurrencyChangeResponse(
                BusinessResponse.from(result.business()),
                result.rate(),
                result.rateDate(),
                result.source(),
                result.asOf(),
                result.notice());
    }
}
