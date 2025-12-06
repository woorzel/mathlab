package org.example.api;

import org.example.api.dto.ChangePasswordRequest;
import org.example.api.dto.UpdateMeRequest;
import org.example.api.dto.UserMeResponse;
import org.example.config.JwtAuthFilter;
import org.example.model.User;
import org.example.repo.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/users/me")
public class UserMeController {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    public UserMeController(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    /** Pobiera bieżącego użytkownika korzystając z principal ustawionego w JwtAuthFilter. */
    private User requireCurrent(Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "NO_AUTH");
        }

        Object principal = auth.getPrincipal();
        Long uid = null;
        String emailFallback = null;

        if (principal instanceof JwtAuthFilter.AuthUser au) {
            uid = au.id();
            emailFallback = au.email();
        } else {
            emailFallback = auth.getName();
        }

        if (uid != null) {
            return users.findById(uid)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND"));
        }
        if (emailFallback != null && !emailFallback.isBlank()) {
            return users.findByEmailIgnoreCase(emailFallback)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND"));
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "NO_AUTH");
    }

    @GetMapping
    public UserMeResponse getMe(Authentication auth) {
        var u = requireCurrent(auth);
        return new UserMeResponse(u.getId(), u.getName(), u.getEmail());
    }

    @PutMapping
    public UserMeResponse updateMe(Authentication auth, @RequestBody UpdateMeRequest req) {
        var u = requireCurrent(auth);

        if (req.name() != null) {
            u.setName(req.name().trim());
        }
        if (req.email() != null) {
            String newEmail = req.email().trim();
            if (!newEmail.equalsIgnoreCase(u.getEmail())) {
                if (users.existsByEmailIgnoreCase(newEmail)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "EMAIL_TAKEN");
                }
                u.setEmail(newEmail);
            }
        }
        users.save(u);
        return new UserMeResponse(u.getId(), u.getName(), u.getEmail());
    }

    @PutMapping("/password")
    public ResponseEntity<Void> changePassword(Authentication auth,
                                               @RequestBody ChangePasswordRequest req) {
        var u = requireCurrent(auth);

        String currentHash = u.getPasswordHash();
        if (req.oldPassword() == null || !passwordEncoder.matches(req.oldPassword(), currentHash)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "BAD_OLD_PASSWORD");
        }
        if (req.newPassword() == null || req.newPassword().length() < 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "WEAK_PASSWORD");
        }

        u.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        users.save(u);
        return ResponseEntity.noContent().build();
    }
}
