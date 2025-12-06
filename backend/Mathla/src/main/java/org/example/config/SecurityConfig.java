package org.example.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class SecurityConfig {

    private final JwtAuthFilter jwtFilter;

    public SecurityConfig(JwtAuthFilter jwtFilter) {
        this.jwtFilter = jwtFilter;
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/api/health", "/api/auth/**").permitAll()

                        // ---- USTAWIENIA KONTA (/me) ----
                        .requestMatchers(HttpMethod.GET, "/api/users/me", "/api/users/me/**").authenticated()
                        .requestMatchers(HttpMethod.PUT, "/api/users/me", "/api/users/me/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/users/me/prefs").authenticated()
                        .requestMatchers(HttpMethod.PUT, "/api/users/me/prefs").authenticated()

                        // ---- POZOSTALI UŻYTKOWNICY ----
                        .requestMatchers(HttpMethod.GET, "/api/users/**").hasRole("TEACHER")
                        .requestMatchers(HttpMethod.PUT, "/api/users/**").hasRole("TEACHER")

                        // ---- ASSIGNMENTS, SUBMISSIONS, GRUPY itd. (jak masz) ----
                        .requestMatchers(HttpMethod.GET, "/api/assignments/**").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/assignments/**").hasRole("TEACHER")
                        .requestMatchers(HttpMethod.PUT, "/api/assignments/**").hasRole("TEACHER")
                        .requestMatchers(HttpMethod.DELETE, "/api/assignments/**").hasRole("TEACHER")
                        .requestMatchers(HttpMethod.POST, "/api/assignments/*/students").hasRole("TEACHER")
                        .requestMatchers(HttpMethod.GET, "/api/assignments/*/submissions").hasRole("TEACHER")

                        // TEMP: relax to authenticated() for debugging 403 source; revert to hasRole("TEACHER") later
                        .requestMatchers(HttpMethod.PUT, "/api/submissions/*/grade").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/submissions/grade-missing").hasRole("TEACHER")
                        .requestMatchers(HttpMethod.PUT, "/api/submissions/*/submit").hasRole("STUDENT")
                        .requestMatchers(HttpMethod.DELETE, "/api/submissions/*/by-teacher").hasRole("TEACHER")
                        .requestMatchers(HttpMethod.POST, "/api/submissions/start").hasAnyRole("STUDENT","TEACHER")
                        .requestMatchers(HttpMethod.GET, "/api/submissions/**").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/submissions/**").hasAnyRole("STUDENT","TEACHER")
                        .requestMatchers(HttpMethod.PUT, "/api/submissions/**").hasAnyRole("STUDENT","TEACHER")
                        .requestMatchers(HttpMethod.DELETE, "/api/submissions/**").hasAnyRole("STUDENT","TEACHER")

                        .requestMatchers(HttpMethod.GET, "/api/groups/**").hasAnyRole("STUDENT","TEACHER")
                        .requestMatchers(HttpMethod.POST, "/api/groups/**").hasRole("TEACHER")
                        .requestMatchers(HttpMethod.PUT, "/api/groups/**").hasRole("TEACHER")
                        .requestMatchers(HttpMethod.DELETE, "/api/groups/**").hasRole("TEACHER")

                        .requestMatchers("/api/formulas/**").authenticated()
                        .requestMatchers("/api/stats/**").hasAnyRole("STUDENT","TEACHER")

                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        var cfg = new CorsConfiguration();
        // w dev może zostać *, w prod lepiej podać konkretny origin
        cfg.setAllowedOriginPatterns(List.of("*"));
        cfg.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS"));
        cfg.setAllowedHeaders(List.of("Authorization","Content-Type","Accept","X-Requested-With"));
        cfg.setExposedHeaders(List.of("Authorization"));
        cfg.setAllowCredentials(false);

        var src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/**", cfg);
        return src;
    }
}
