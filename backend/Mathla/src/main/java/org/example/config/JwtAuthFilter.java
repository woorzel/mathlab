package org.example.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Filtr JWT — wyciąga dane użytkownika z tokena i ustawia je w kontekście Spring Security.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwt;

    public JwtAuthFilter(JwtService jwt) {
        this.jwt = jwt;
    }

    // Prosty model użytkownika, który potem można odczytać w kontrolerze
    public record AuthUser(Long id, String email, String role) {}

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {

        String auth = req.getHeader("Authorization");

        if (auth != null && auth.startsWith("Bearer ")) {
            String token = auth.substring(7);
            try {
                // Parsowanie tokena JWT
                Jws<Claims> jws = jwt.parse(token);
                Claims claims = jws.getBody();

                String email = claims.getSubject();                    // subject = e-mail
                String role  = String.valueOf(claims.get("role"));     // np. TEACHER, STUDENT
                Long uid     = claims.get("uid", Number.class).longValue(); // ID użytkownika

                // Tworzymy principal (AuthUser) i token autoryzacyjny
                var principal = new AuthUser(uid, email, role);
                var authToken = new UsernamePasswordAuthenticationToken(
                        principal,
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + role))
                );

                // Ustawiamy kontekst bezpieczeństwa
                SecurityContextHolder.getContext().setAuthentication(authToken);

            } catch (Exception e) {
                // Token nieprawidłowy, pomijamy — brak kontekstu => 401/403 dalej w łańcuchu
                SecurityContextHolder.clearContext();
            }
        }

        // Przekazujemy dalej żądanie
        chain.doFilter(req, res);
    }
}
