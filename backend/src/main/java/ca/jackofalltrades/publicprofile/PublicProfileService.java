package ca.jackofalltrades.publicprofile;

import ca.jackofalltrades.auth.AuthService;
import ca.jackofalltrades.auth.AvatarRepository;
import ca.jackofalltrades.auth.Business;
import ca.jackofalltrades.auth.BusinessRepository;
import ca.jackofalltrades.common.api.NotFoundException;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Public profiles (contract §2.2). Unlike every other service, the business comes from the
 * link's slug, not CurrentBusiness: there is no login. A business with no slug has no profile,
 * so an unknown slug and a turned-off profile give the same 404.
 */
@Service
public class PublicProfileService {

    private final BusinessRepository businesses;
    private final PublicProfileQueries queries;
    private final AuthService authService;

    public PublicProfileService(BusinessRepository businesses, PublicProfileQueries queries, AuthService authService) {
        this.businesses = businesses;
        this.queries = queries;
        this.authService = authService;
    }

    @Transactional(readOnly = true)
    public PublicProfileResponse find(String slug) {
        Business business = business(slug);
        String logoUrl = business.getLogoUpdatedAt() == null ? null
                : "/api/public/businesses/" + slug + "/logo?v=" + business.getLogoUpdatedAt().toEpochMilli();
        return new PublicProfileResponse(
                business.getPublicSlug(),
                business.getName(),
                business.getDescription(),
                business.getCity(),
                business.getRegion(),
                business.getCurrency(),
                business.getWebsite(),
                business.getInstagram(),
                business.getFacebook(),
                business.getTiktok(),
                business.getEtsy(),
                logoUrl,
                queries.publicItems(business.getId()));
    }

    @Transactional(readOnly = true)
    public Optional<AvatarRepository.Avatar> logo(String slug) {
        return authService.findLogo(business(slug).getId());
    }

    private Business business(String slug) {
        return businesses.findByPublicSlug(slug)
                .orElseThrow(() -> new NotFoundException("Public profile", slug));
    }
}
