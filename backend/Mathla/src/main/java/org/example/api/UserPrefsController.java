// src/main/java/org/example/api/UserPrefsController.java
package org.example.api;

import org.example.api.dto.UserPrefsDto;
import org.example.model.UserPrefs;
import org.example.repo.UserPrefsRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;

@RestController
@RequestMapping("/api/users/me/prefs")
public class UserPrefsController {

    private final UserPrefsRepository repo;

    public UserPrefsController(UserPrefsRepository repo) {
        this.repo = repo;
    }

    /** Bierzemy userId z principal ustawionego w JwtAuthFilter. */
    private Long currentUserId(Authentication auth) {
        if (auth == null || auth.getPrincipal() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "NO_AUTH");
        }
        Object p = auth.getPrincipal();
        if (p instanceof org.example.config.JwtAuthFilter.AuthUser au) {
            return au.id();
        }
        // awaryjnie brak identyfikatora → 401
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "NO_AUTH");
    }

    private static void validate(UserPrefsDto dto) {
        if (dto == null) return;
        if (dto.defaultFormat() != null) {
            String df = dto.defaultFormat().toUpperCase();
            if (!df.equals("ASCIIMATH") && !df.equals("TEX")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_DEFAULT_FORMAT");
            }
        }
        if (dto.theme() != null) {
            String th = dto.theme().toLowerCase();
            if (!(th.equals("auto") || th.equals("light") || th.equals("dark"))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_THEME");
            }
        }
    }

    private static UserPrefsDto toDto(UserPrefs p) {
        if (p == null) return UserPrefsDto.defaults();
        return new UserPrefsDto(
                p.isEmailOnSubmit(),
                p.isDailyDigest(),
                p.getDefaultFormat(),
                p.getTheme()
        );
    }

    @GetMapping
    public UserPrefsDto get(Authentication auth) {
        Long uid = currentUserId(auth);
        return repo.findById(uid).map(UserPrefsController::toDto).orElse(UserPrefsDto.defaults());
    }

    @PutMapping
    public UserPrefsDto update(Authentication auth, @RequestBody UserPrefsDto req) {
        Long uid = currentUserId(auth);
        validate(req);

        var entity = repo.findById(uid).orElseGet(() -> {
            var np = new UserPrefs();
            np.setUserId(uid);
            return np;
        });

        if (req.emailOnSubmit() != null) entity.setEmailOnSubmit(req.emailOnSubmit());
        if (req.dailyDigest()   != null) entity.setDailyDigest(req.dailyDigest());
        if (req.defaultFormat() != null) entity.setDefaultFormat(req.defaultFormat().toUpperCase());
        if (req.theme()         != null) entity.setTheme(req.theme().toLowerCase());
        entity.setUpdatedAt(OffsetDateTime.now());

        repo.save(entity);
        return toDto(entity);
    }
}
