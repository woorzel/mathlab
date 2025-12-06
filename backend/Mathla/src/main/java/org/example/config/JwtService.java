package org.example.config;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.example.model.UserRole;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

@Service
public class JwtService {
    @Value("${app.jwt.secret}")
    private String secret;

    @Value("${app.jwt.expHours:12}")
    private long expHours;

    private byte[] key() {
        return secret.getBytes(StandardCharsets.UTF_8);
    }

    public String generate(Long userId, String email, UserRole role) {
        Instant now = Instant.now();
        return Jwts.builder()
                .setSubject(email)
                .claim("uid", userId)
                .claim("role", role.name())
                .setIssuedAt(Date.from(now))
                .setExpiration(Date.from(now.plus(expHours, ChronoUnit.HOURS)))
                .signWith(Keys.hmacShaKeyFor(key()), SignatureAlgorithm.HS256)
                .compact();
    }

    public Jws<Claims> parse(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(Keys.hmacShaKeyFor(key()))
                .build()
                .parseClaimsJws(token);
    }
}
