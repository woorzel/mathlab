package org.example.api;

import jakarta.validation.Valid;
import org.example.api.dto.*;
import org.example.config.JwtService;
import org.example.model.User;
import org.example.model.UserRole;
import org.example.repo.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public AuthController(UserRepository users, PasswordEncoder encoder, JwtService jwt) {
        this.users = users;
        this.encoder = encoder;
        this.jwt = jwt;
    }

    // Prosty rate-limiter w pamięci: max 5 prób / 5 minut per (email+ip)
    private final java.util.concurrent.ConcurrentHashMap<String, java.util.Deque<Long>> attempts = new java.util.concurrent.ConcurrentHashMap<>();
    private static final long WINDOW_MS = 5 * 60 * 1000L;
    private static final int MAX_ATTEMPTS = 5;

    private boolean blocked(String key) {
        long now = System.currentTimeMillis();
        var dq = attempts.computeIfAbsent(key, k -> new java.util.ArrayDeque<>());
        // usuwamy stare wpisy
        while (!dq.isEmpty() && now - dq.peekFirst() > WINDOW_MS) dq.removeFirst();
        return dq.size() >= MAX_ATTEMPTS;
    }
    private void record(String key) {
        long now = System.currentTimeMillis();
        var dq = attempts.computeIfAbsent(key, k -> new java.util.ArrayDeque<>());
        dq.addLast(now);
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest req) {
        if (users.existsByEmail(req.email())) {
            return error(HttpStatus.CONFLICT, "EMAIL_ALREADY_USED", "Email already used");
        }
        var role = (req.role() == null || req.role().isBlank())
                ? UserRole.STUDENT
                : UserRole.valueOf(req.role().toUpperCase());

        // w realu: ogranicz tworzenie TEACHER do ADMIN-a
        var u = new User();
        u.setEmail(req.email());
        u.setPasswordHash(encoder.encode(req.password()));
        u.setRole(role);
        u.setName(req.name());
        users.save(u);

        String token = jwt.generate(u.getId(), u.getEmail(), u.getRole());
        return ResponseEntity.ok(new TokenResponse(token, u.getRole().name(), u.getId(), u.getEmail()));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req, @RequestHeader(value = "X-Forwarded-For", required = false) String xff, @RequestHeader(value = "X-Real-IP", required = false) String xrip, HttpServletRequest http) {
        String ip = xrip != null ? xrip : (xff != null ? xff.split(",")[0].trim() : http.getRemoteAddr());
        String key = (req.email() == null ? "" : req.email().toLowerCase()) + "|" + ip;
        if (blocked(key)) {
            return error(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMIT", "Too many attempts. Please try again later.");
        }

        var uOpt = users.findByEmail(req.email());
        if (uOpt.isEmpty()) {
            record(key);
            return error(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_CREDENTIALS", "Invalid credentials");
        }
        var u = uOpt.get();
        if (!encoder.matches(req.password(), u.getPasswordHash())) {
            record(key);
            return error(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_CREDENTIALS", "Invalid credentials");
        }
        String token = jwt.generate(u.getId(), u.getEmail(), u.getRole());
        return ResponseEntity.ok(new TokenResponse(token, u.getRole().name(), u.getId(), u.getEmail()));
    }

    private ResponseEntity<Map<String, Object>> error(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status.value()).body(Map.of(
                "code", code,
                "message", message
        ));
    }
}
