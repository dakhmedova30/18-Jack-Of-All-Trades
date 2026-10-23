package ca.jackofalltrades.common.web;

import java.io.IOException;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * Serves the built React app from classpath:/static/ (the Docker image copies it there).
 * A path that isn't a file and doesn't start with api/ (e.g. /inventory) gets index.html,
 * so React Router can handle it. Unknown /api/... paths and missing files (anything with a
 * dot, e.g. /favicon.ico) resolve to nothing and get the JSON 404.
 */
@Configuration
public class SpaResourceConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String resourcePath, Resource location) throws IOException {
                        if (!resourcePath.isEmpty()) {
                            // super also checks that the file is inside the static folder.
                            Resource requested = super.getResource(resourcePath, location);
                            if (requested != null) {
                                return requested;
                            }
                            if (resourcePath.startsWith("api/") || resourcePath.contains(".")) {
                                return null;
                            }
                        }
                        Resource index = location.createRelative("index.html");
                        return index.exists() ? index : null;
                    }
                });
    }
}
